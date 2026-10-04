// OpenDeck / Stream Deck plugin: shows Claude subscription usage and Claude Code status.
// No dependencies: uses Node >= 22 built-in WebSocket and fetch.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { STATE_DIR } = require('./hooks/state-dir');
const { Version: VERSION } = require('./manifest.json');

const USAGE_ACTION = 'com.verso.claudeusage.usage';
const STATUS_ACTION = 'com.verso.claudeusage.status';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const POLL_MS = 60_000;
const CREDENTIALS = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), '.credentials.json');

const METRICS = {
	five_hour: { label: 'SESSION 5H', field: 'five_hour' },
	seven_day: { label: 'HEBDO', field: 'seven_day' },
	seven_day_opus: { label: 'HEBDO OPUS', field: 'seven_day_opus' },
	seven_day_sonnet: { label: 'HEBDO SONNET', field: 'seven_day_sonnet' },
};

// --- SDK arguments: -port X -pluginUUID Y -registerEvent Z -info {...}
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-/, '')] = process.argv[i + 1];

const contexts = new Map(); // context -> { action, settings }
let usage = null;
let error = null;
let lastFetch = 0;
const RESET_VIEW_MS = 5_000;
const resetView = new Map(); // context -> timer: shows the time until reset after a key press

// --- Usage fetching

function readToken() {
	const creds = JSON.parse(fs.readFileSync(CREDENTIALS, 'utf8'));
	const oauth = creds.claudeAiOauth;
	if (!oauth || !oauth.accessToken) throw new Error('NO LOGIN');
	if (oauth.expiresAt && oauth.expiresAt < Date.now()) throw new Error('TOKEN EXPIRÉ');
	return oauth.accessToken;
}

async function fetchUsage() {
	try {
		// Re-read every time: Claude Code refreshes the token on its own.
		const token = readToken();
		const res = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				'anthropic-beta': 'oauth-2025-04-20',
				'User-Agent': `opendeck-claude-usage/${VERSION}`,
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
	renderAll(USAGE_ACTION);
}

// --- SVG rendering (144x144)

const DEFAULT_BG = '#1f1e1d';
const DEFAULT_RING = '#d97757';

// Colors come from user settings: only accept #rrggbb since they are injected into the SVG.
const hexOr = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback);

function isLight(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function themeFor(settings) {
	const bg = hexOr(settings.bgColor, DEFAULT_BG);
	const light = isLight(bg);
	return {
		bg,
		ring: hexOr(settings.ringColor, DEFAULT_RING),
		// Text and ring track adapt to stay readable on a light background.
		text: light ? '#1f1e1d' : '#f5f4ef',
		muted: light ? '#57534e' : '#a8a29e',
		track: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)',
	};
}

function color(pct, theme) {
	if (pct >= 90) return '#e5484d';
	if (pct >= 70) return '#f5a524';
	return theme.ring;
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

function svgImage(theme, inner) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" fill="${theme.bg}"/>${inner}</svg>`;
	return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function text(x, y, size, fill, content, weight = 400) {
	return `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${esc(content)}</text>`;
}

function renderRing(theme, window, showReset) {
	const pct = Math.max(0, Math.min(100, Math.round(window.utilization)));
	const r = 50;
	const circ = 2 * Math.PI * r;
	const dash = (pct / 100) * circ;
	return svgImage(theme, `
<circle cx="72" cy="72" r="${r}" fill="none" stroke="${theme.track}" stroke-width="10"/>
<circle cx="72" cy="72" r="${r}" fill="none" stroke="${color(pct, theme)}" stroke-width="10" stroke-linecap="round"
 stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 72 72)"/>
${showReset
	? text(72, 62, 13, theme.muted, 'RESET', 600) + text(72, 92, 26, theme.text, formatReset(window.resets_at), 700)
	: text(72, 84, 34, theme.text, `${pct}%`, 700)}`);
}

function renderBoth(theme, showReset) {
	const row = (y, label, window) => {
		if (!window) return text(72, y + 20, 14, theme.muted, `${label} —`);
		const pct = Math.max(0, Math.min(100, Math.round(window.utilization)));
		return `
${text(20, y + 14, 14, theme.muted, label, 600).replace('text-anchor="middle"', 'text-anchor="start"')}
${text(124, y + 16, showReset ? 18 : 22, theme.text, showReset ? formatReset(window.resets_at) : `${pct}%`, 700).replace('text-anchor="middle"', 'text-anchor="end"')}
<rect x="20" y="${y + 24}" width="104" height="10" rx="5" fill="${theme.track}"/>
<rect x="20" y="${y + 24}" width="${(104 * pct) / 100}" height="10" rx="5" fill="${color(pct, theme)}"/>`;
	};
	return svgImage(theme, row(18, '5H', usage.five_hour) + row(80, '7J', usage.seven_day));
}

function renderMessage(theme, title, msg) {
	return svgImage(theme, `${text(72, 62, 14, theme.muted, title, 600)}${text(72, 88, 16, '#e5484d', msg, 700)}`);
}

function renderUsage(context, settings) {
	const metric = settings.metric || 'five_hour';
	const theme = themeFor(settings);
	const showReset = resetView.has(context);
	let image;
	if (error && !usage) image = renderMessage(theme, 'CLAUDE', error);
	else if (!usage) image = renderMessage(theme, 'CLAUDE', '…');
	else if (metric === 'both') image = renderBoth(theme, showReset);
	else {
		const m = METRICS[metric] || METRICS.five_hour;
		const window = usage[m.field];
		image = window ? renderRing(theme, window, showReset) : renderMessage(theme, m.label, 'N/A');
	}
	return image;
}

// --- Claude Code status (written by hooks/claude-status.js)

const STATUS = {
	waiting: { label: 'À TOI', setting: 'waitingColor', color: '#ef4444' },
	working: { label: 'RÉFLÉCHIT', setting: 'workingColor', color: '#3b82f6' },
	done: { label: 'FINI', setting: 'doneColor', color: '#22c55e' },
	idle: { label: '', setting: 'idleColor', color: '#1f1e1d' },
};
// When several sessions run at once, the key shows the one that matters most.
const PRIORITY = ['waiting', 'working', 'done'];
// A "working" session without news for this long was probably interrupted (Stop doesn't fire on Esc).
const WORKING_STALE_MS = 30 * 60_000;
const SESSION_STALE_MS = 24 * 3600_000;

function readSessions() {
	let files = [];
	try {
		files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.json'));
	} catch {
		return [];
	}
	const now = Date.now();
	const sessions = [];
	for (const f of files) {
		try {
			const s = JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
			const age = now - s.updatedAt;
			if (age > SESSION_STALE_MS || (s.state === 'working' && age > WORKING_STALE_MS)) continue;
			sessions.push({ file: f, ...s });
		} catch {
			// Being rewritten or corrupted: skip it this time.
		}
	}
	return sessions;
}

function currentStatus() {
	const states = new Set(readSessions().map((s) => s.state));
	return PRIORITY.find((p) => states.has(p)) || 'idle';
}

function renderStatus(settings) {
	const status = STATUS[currentStatus()];
	const bg = hexOr(settings[status.setting], status.color);
	const fg = isLight(bg) ? '#1f1e1d' : '#f5f4ef';
	return svgImage({ bg }, status.label ? text(72, 80, 22, fg, status.label, 700) : '');
}

// Pressing the status key acknowledges finished sessions: the key goes back to idle.
function acknowledgeDone() {
	for (const s of readSessions()) {
		if (s.state === 'done') fs.rmSync(path.join(STATE_DIR, s.file), { force: true });
	}
}

let watchDebounce;
function watchStatus() {
	fs.mkdirSync(STATE_DIR, { recursive: true });
	fs.watch(STATE_DIR, () => {
		clearTimeout(watchDebounce);
		watchDebounce = setTimeout(() => renderAll(STATUS_ACTION), 100);
	});
}

// --- Dispatch

function render(context) {
	const entry = contexts.get(context);
	if (!entry) return;
	const image = entry.action === STATUS_ACTION ? renderStatus(entry.settings) : renderUsage(context, entry.settings);
	send({ event: 'setImage', context, payload: { image, target: 0 } });
	send({ event: 'setTitle', context, payload: { title: '', target: 0 } });
}

function renderAll(action) {
	for (const [context, entry] of contexts) if (!action || entry.action === action) render(context);
}

// --- WebSocket connection to OpenDeck

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
			contexts.set(msg.context, { action: msg.action, settings: msg.payload?.settings || {} });
			render(msg.context);
			break;
		case 'willDisappear':
			contexts.delete(msg.context);
			clearTimeout(resetView.get(msg.context));
			resetView.delete(msg.context);
			break;
		case 'keyDown': {
			if (msg.action === STATUS_ACTION) {
				acknowledgeDone();
				renderAll(STATUS_ACTION);
				break;
			}
			// Show the time until reset for a few seconds, then go back to the percentage.
			const ctx = msg.context;
			clearTimeout(resetView.get(ctx));
			resetView.set(ctx, setTimeout(() => {
				resetView.delete(ctx);
				render(ctx);
			}, RESET_VIEW_MS));
			render(ctx);
			// Throttle: at most one request every 5 s.
			if (Date.now() - lastFetch > 5_000) fetchUsage();
			break;
		}
	}
});

ws.addEventListener('close', () => process.exit(0));

watchStatus();
setInterval(fetchUsage, POLL_MS);
// Re-render between network calls so the reset countdown stays current
// and stale "working" sessions expire.
setInterval(renderAll, 15_000);
