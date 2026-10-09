#!/usr/bin/env bash
# Copies the plugin into the OpenDeck plugins folder, like a marketplace install.
# No symlink: OpenDeck then records paths outside its folder and can't load the
# settings pages and icons. Restart OpenDeck afterwards to load the new copy.
set -euo pipefail
cd "$(dirname "$0")"

PLUGIN=com.verso.claudeusage.sdPlugin
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/opendeck/plugins/$PLUGIN"

node --check "$PLUGIN/plugin.js"

# Removes the previous copy, or an old symlink (only the link, not its target).
rm -rf "$DEST"
cp -a "$PLUGIN" "$DEST"

echo "$DEST updated, restart OpenDeck to load it."
