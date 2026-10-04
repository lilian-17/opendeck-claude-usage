#!/usr/bin/env node
// Adds (or removes with --uninstall) the status hooks in Claude Code's settings.json.
// Idempotent: existing claude-status.js entries are replaced, other hooks are left untouched.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsFile = path.join(configDir, 'settings.json');
const script = path.join(fs.realpathSync(__dirname), 'claude-status.js');
const command = `node "${script}"`;
const uninstall = process.argv.includes('--uninstall');

// event -> matcher (null = all)
const EVENTS = {
	UserPromptSubmit: null,
	PreToolUse: 'AskUserQuestion',
	PostToolUse: null,
	Notification: null,
	Stop: null,
	SessionEnd: null,
};

const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
if (fs.existsSync(settingsFile)) fs.copyFileSync(settingsFile, `${settingsFile}.bak`);

const hooks = settings.hooks || {};
const isOurs = (h) => typeof h.command === 'string' && h.command.includes('claude-status.js');

for (const event of Object.keys(EVENTS)) {
	// Drop our previous entries, keep everything else.
	const groups = (hooks[event] || [])
		.map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
		.filter((g) => g.hooks.length > 0);

	if (!uninstall) {
		const group = { hooks: [{ type: 'command', command, timeout: 5 }] };
		if (EVENTS[event]) group.matcher = EVENTS[event];
		groups.push(group);
	}

	if (groups.length) hooks[event] = groups;
	else delete hooks[event];
}

if (Object.keys(hooks).length) settings.hooks = hooks;
else delete settings.hooks;

fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');

console.log(uninstall ? `Hooks removed from ${settingsFile}` : `Hooks installed in ${settingsFile}\n  -> ${command}`);
