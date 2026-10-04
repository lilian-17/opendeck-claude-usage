// Shared between the hook and the plugin: where Claude Code session states are stored.
'use strict';

const os = require('os');
const path = require('path');

const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');

module.exports = { STATE_DIR: path.join(base, 'opendeck-claude', 'sessions') };
