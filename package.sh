#!/usr/bin/env bash
# Construit dist/com.verso.claudeusage.sdPlugin.zip, prêt à attacher à une release GitHub.
set -euo pipefail
cd "$(dirname "$0")"

PLUGIN=com.verso.claudeusage.sdPlugin
VERSION=$(node -p "require('./$PLUGIN/manifest.json').Version")

node --check "$PLUGIN/plugin.js"
chmod +x "$PLUGIN/bin/claude-usage"

mkdir -p dist
rm -f "dist/$PLUGIN.zip"
zip -rq "dist/$PLUGIN.zip" "$PLUGIN"

echo "dist/$PLUGIN.zip (v$VERSION)"
