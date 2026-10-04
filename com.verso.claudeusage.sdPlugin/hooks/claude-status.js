#!/usr/bin/env node
// Claude Code hook: records the session state so the OpenDeck plugin can show it.
// Reads the hook payload on stdin and writes <state dir>/<session_id>.json.
// Must never fail or slow Claude Code down: every error is swallowed.
'use strict';

const fs = require('fs');
const { STATE_DIR } = require('./state-dir');

function stateFor(input) {
	switch (input.hook_event_name) {
		case 'UserPromptSubmit':
		case 'PostToolUse':
			return 'working';
		case 'PreToolUse':
			// Claude asking a question waits on the user, like a permission prompt.
			return input.tool_name === 'AskUserQuestion' ? 'waiting' : 'working';
		case 'Notification':
			// "idle_prompt" fires a while after Claude finished: keep the "done" state.
			return input.notification_type === 'idle_prompt' ? null : 'waiting';
		case 'Stop':
			return 'done';
		case 'SessionEnd':
			return 'ended';
		default:
			return null;
	}
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
	try {
		const input = JSON.parse(raw);
		const state = stateFor(input);
		const id = String(input.session_id || '').replace(/[^\w-]/g, '');
		if (!state || !id) return;

		const file = `${STATE_DIR}/${id}.json`;
		if (state === 'ended') {
			fs.rmSync(file, { force: true });
			return;
		}
		fs.mkdirSync(STATE_DIR, { recursive: true });
		// Write then rename so the plugin never reads a half-written file.
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify({ state, cwd: input.cwd, updatedAt: Date.now() }));
		fs.renameSync(tmp, file);
	} catch {
		// Ignore: a broken status key is better than a broken Claude Code.
	}
});
