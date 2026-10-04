// Plugin OpenDeck / Stream Deck : affiche l'utilisation de l'abonnement Claude.
// Aucune dépendance : utilise le WebSocket et fetch natifs de Node >= 22.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const POLL_MS = 60_000;
const CREDENTIALS = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), '.credentials.json');

const METRICS = {
	five_hour: { label: 'SESSION 5H', field: 'five_hour' },
	seven_day: { label: 'HEBDO', field: 'seven_day' },
	seven_day_opus: { label: 'HEBDO OPUS', field: 'seven_day_opus' },
	seven_day_sonnet: { label: 'HEBDO SONNET', field: 'seven_day_sonnet' },
};

// --- Arguments du SDK : -port X -pluginUUID Y -registerEvent Z -info {...}
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-/, '')] = process.argv[i + 1];

const contexts = new Map(); // context -> settings
let usage = null;
let error = null;
let lastFetch = 0;
const RESET_VIEW_MS = 5_000;
const resetView = new Map(); // context -> timer : affichage du temps avant reset après un clic

// --- Récupération de l'usage

function readToken() {
	const creds = JSON.parse(fs.readFileSync(CREDENTIALS, 'utf8'));
	const oauth = creds.claudeAiOauth;
	if (!oauth || !oauth.accessToken) throw new Error('NO LOGIN');
	if (oauth.expiresAt && oauth.expiresAt < Date.now()) throw new Error('TOKEN EXPIRÉ');
	return oauth.accessToken;
}

async function fetchUsage() {
	try {
		// Relu à chaque fois : Claude Code rafraîchit le token de son côté.
		const token = readToken();
		const res = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				'anthropic-beta': 'oauth-2025-04-20',
				'User-Agent': 'opendeck-claude-usage/0.1.0',
			},
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 401) throw new Error('TOKEN EXPIRÉ');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		usage = await res.json();
		error = null;
	} catch (e) {
		error = e.code === 'ENOENT' ? 'NO LOGIN' : e.name === 'TimeoutError' ? 'TIMEOUT' : e.message;
		console.error('fetchUsage:', e);
	}
	lastFetch = Date.now();
	renderAll();
}

// --- Rendu SVG 144x144

function color(pct) {
	if (pct >= 90) return '#e5484d';
	if (pct >= 70) return '#f5a524';
	return '#d97757';
}

function formatReset(iso) {
	if (!iso) return '';
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return '…';
	const min = Math.round(ms / 60_000);
	const d = Math.floor(min / 1440);
	const h = Math.floor((min % 1440) / 60);
	const m = min % 60;
	if (d > 0) return `${d}j ${h}h`;
	if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
	return `${m} min`;
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

function svgImage(inner) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" fill="#1f1e1d"/>${inner}</svg>`;
	return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function text(x, y, size, fill, content, weight = 400) {
	return `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${esc(content)}</text>`;
}

function renderRing(window, showReset) {
	const pct = Math.max(0, Math.min(100, Math.round(window.utilization)));
	const r = 50;
	const circ = 2 * Math.PI * r;
	const dash = (pct / 100) * circ;
	return svgImage(`
<circle cx="72" cy="72" r="${r}" fill="none" stroke="#3a3836" stroke-width="10"/>
<circle cx="72" cy="72" r="${r}" fill="none" stroke="${color(pct)}" stroke-width="10" stroke-linecap="round"
 stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 72 72)"/>
${showReset
	? text(72, 62, 13, '#a8a29e', 'RESET', 600) + text(72, 92, 26, '#f5f4ef', formatReset(window.resets_at), 700)
	: text(72, 84, 34, '#f5f4ef', `${pct}%`, 700)}`);
}

function renderBoth(showReset) {
	const row = (y, label, window) => {
		if (!window) return text(72, y + 20, 14, '#a8a29e', `${label} —`);
		const pct = Math.max(0, Math.min(100, Math.round(window.utilization)));
		return `
${text(20, y + 14, 14, '#a8a29e', label, 600).replace('text-anchor="middle"', 'text-anchor="start"')}
${text(124, y + 16, showReset ? 18 : 22, '#f5f4ef', showReset ? formatReset(window.resets_at) : `${pct}%`, 700).replace('text-anchor="middle"', 'text-anchor="end"')}
<rect x="20" y="${y + 24}" width="104" height="10" rx="5" fill="#3a3836"/>
<rect x="20" y="${y + 24}" width="${(104 * pct) / 100}" height="10" rx="5" fill="${color(pct)}"/>`;
	};
	return svgImage(row(18, '5H', usage.five_hour) + row(80, '7J', usage.seven_day));
}

function renderMessage(title, msg) {
	return svgImage(`${text(72, 62, 14, '#a8a29e', title, 600)}${text(72, 88, 16, '#e5484d', msg, 700)}`);
}

function render(context) {
	const settings = contexts.get(context) || {};
	const metric = settings.metric || 'five_hour';
	const showReset = resetView.has(context);
	let image;
	if (error && !usage) image = renderMessage('CLAUDE', error);
	else if (!usage) image = renderMessage('CLAUDE', '…');
	else if (metric === 'both') image = renderBoth(showReset);
	else {
		const m = METRICS[metric] || METRICS.five_hour;
		const window = usage[m.field];
		image = window ? renderRing(window, showReset) : renderMessage(m.label, 'N/A');
	}
	send({ event: 'setImage', context, payload: { image, target: 0 } });
	send({ event: 'setTitle', context, payload: { title: '', target: 0 } });
}

function renderAll() {
	for (const context of contexts.keys()) render(context);
}

// --- Connexion WebSocket à OpenDeck

const ws = new WebSocket(`ws://127.0.0.1:${args.port}`);

function send(msg) {
	if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

ws.addEventListener('open', () => {
	send({ event: args.registerEvent, uuid: args.pluginUUID });
	fetchUsage();
});

ws.addEventListener('message', (ev) => {
	const msg = JSON.parse(ev.data);
	switch (msg.event) {
		case 'willAppear':
		case 'didReceiveSettings':
			contexts.set(msg.context, msg.payload?.settings || {});
			render(msg.context);
			break;
		case 'willDisappear':
			contexts.delete(msg.context);
			clearTimeout(resetView.get(msg.context));
			resetView.delete(msg.context);
			break;
		case 'keyDown': {
			// Affiche le temps avant reset quelques secondes, puis revient au pourcentage.
			const ctx = msg.context;
			clearTimeout(resetView.get(ctx));
			resetView.set(ctx, setTimeout(() => {
				resetView.delete(ctx);
				render(ctx);
			}, RESET_VIEW_MS));
			render(ctx);
			// Anti-spam : pas plus d'un appel toutes les 5 s.
			if (Date.now() - lastFetch > 5_000) fetchUsage();
			break;
		}
	}
});

ws.addEventListener('close', () => process.exit(0));

setInterval(fetchUsage, POLL_MS);
// Le compte à rebours du reset est re-rendu entre deux appels réseau.
setInterval(renderAll, 15_000);
