# Claude Usage for OpenDeck

[Français](README.fr.md)

An [OpenDeck](https://github.com/nekename/OpenDeck) plugin that shows your Claude subscription usage (Pro / Max) on a Stream Deck key.

![Usage view](docs/preview.png)

Press the key to see the time left until the limit resets:

![Reset view](docs/preview-reset.png)

> **Not affiliated with Anthropic.** This is an unofficial community plugin. It relies on an undocumented endpoint used by Claude Code, which may change or stop working at any time.

## Features

- Ring showing the usage percentage, colored by level (orange → yellow at 70% → red at 90%)
- Choose per key: 5-hour session, weekly, both, weekly Opus or weekly Sonnet
- Customizable background and ring colors per key (text adapts to light backgrounds)
- Press: shows the time left before the reset for 5 seconds and refreshes the data
- Auto-refresh every minute
- No dependencies: a single Node.js file

## Requirements

- **Linux** (macOS and Windows are not supported yet, see below)
- [OpenDeck](https://github.com/nekename/OpenDeck)
- **Node.js ≥ 22** (for the built-in `WebSocket` and `fetch`). The launcher finds `node` in the `PATH`, in [mise](https://mise.jdx.dev) or in nvm.
- [Claude Code](https://claude.com/claude-code) logged in with your Claude account (`claude` then `/login`)

## Installation

1. Download `com.verso.claudeusage.sdPlugin.zip` from the [Releases](../../releases) page.
2. Extract it into the OpenDeck plugins folder:
   ```sh
   unzip com.verso.claudeusage.sdPlugin.zip -d ~/.config/opendeck/plugins/
   ```
3. Restart OpenDeck, then drag the **Claude → Claude Usage** action onto a key.

### From source

```sh
git clone https://github.com/lilian-17/opendeck-claude-usage.git
ln -s "$PWD/opendeck-claude-usage/com.verso.claudeusage.sdPlugin" ~/.config/opendeck/plugins/
```

## How it works & privacy

The plugin reads the OAuth token that Claude Code stores in `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR/.credentials.json`) and calls `https://api.anthropic.com/api/oauth/usage`, the same endpoint Claude Code uses for `/usage`.

- The token is **only sent to `api.anthropic.com`**. Nothing is sent anywhere else, and nothing is written to disk.
- The plugin **never refreshes the token** itself, so it can't interfere with Claude Code's session. If the token has expired, the key shows `TOKEN EXPIRÉ`: just run `claude` once to renew it.
- All the logic lives in [`plugin.js`](com.verso.claudeusage.sdPlugin/plugin.js) (~200 lines). Feel free to read it.

## Limitations

- **macOS**: Claude Code stores its credentials in the Keychain, not in a file. Not supported yet.
- **Windows**: the launcher is a bash script. Not supported yet.
- Undocumented endpoint: if Anthropic changes it, the plugin will break until it's updated.

Contributions are welcome.

## Building a release

```sh
./package.sh   # → dist/com.verso.claudeusage.sdPlugin.zip
```

## License

[MIT](LICENSE)
