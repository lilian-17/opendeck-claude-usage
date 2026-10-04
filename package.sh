#!/usr/bin/env bash
# Builds dist/com.verso.claudeusage.sdPlugin.zip, ready to attach to a GitHub release.
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
