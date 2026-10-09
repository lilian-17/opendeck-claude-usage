# Claude Usage for OpenDeck

[Français](README.fr.md)

An [OpenDeck](https://github.com/nekename/OpenDeck) plugin that shows your Claude subscription usage (Pro / Max) on a Stream Deck key, plus a second key that shows what Claude Code is doing.

![Usage view](docs/preview.png)

Press the key to see the time left until the limit resets:

![Reset view](docs/preview-reset.png)

> **Not affiliated with Anthropic.** This is an unofficial community plugin. It relies on an undocumented endpoint used by Claude Code, which may change or stop working at any time.

## Features

- Ring showing the usage percentage, colored by level (orange → yellow at 70% → red at 90%)
- Choose per key: 5-hour session, weekly, both, weekly Opus or weekly Sonnet
- Press: shows the time left before the reset for 5 seconds and refreshes the data
- Customizable background and ring colors per key (text adapts to light backgrounds)
- One-click pure black **OLED** background: the pixels stay off around the ring
- **Claude Code status key**: thinking, needs you, done (see [below](#claude-code-status-key))
- English and French, following the OpenDeck language setting
- Gentle on the API: refresh every 3 minutes, backoff when rate limited, last values cached so restarts are instant
- No dependencies: a single Node.js file

## Requirements

- **Linux** (macOS and Windows are not supported yet, see [Limitations](#limitations))
- [OpenDeck](https://github.com/nekename/OpenDeck)
- **Node.js ≥ 22**. Distribution packages are often older (Debian 12, Ubuntu 22.04 and 24.04 ship 18 or 20): use [NodeSource](https://github.com/nodesource/distributions) or a version manager. The launcher finds `node` in the `PATH` or in [mise](https://mise.jdx.dev), nvm, fnm, volta or asdf, and picks the newest suitable version.
- [Claude Code](https://claude.com/claude-code) logged in with your Claude account (`claude` then `/login`)

## Installation

**From OpenDeck**: open the plugin list, search for **Claude Usage** and install it.

**Manually**: download `com.verso.claudeusage.sdPlugin.zip` from the [Releases](../../releases) page, then either install it from OpenDeck, or extract it into the plugins folder:

```sh
unzip com.verso.claudeusage.sdPlugin.zip -d ~/.config/opendeck/plugins/
```

Restart OpenDeck, then drag the **Claude → Claude Usage** action onto a key. Click the key in OpenDeck to open its settings.

## Key settings

| Setting | Options |
|---|---|
| Displayed limit | 5-hour session, weekly, both, weekly Opus, weekly Sonnet |
| Background / Ring | any color; **OLED black** sets a pure black background |
| Default colors | back to the original look |

A small orange dot in the corner means the numbers are more than 15 minutes old (network issue, rate limit or expired token).

## Claude Code status key

A second action, **Claude Code Status**, colors the key according to what Claude Code is doing:

| State | Default color | When |
|---|---|---|
| Thinking | blue | after you send a prompt, while tools run |
| Needs you | red | permission prompt or a question from Claude |
| Done | green | Claude finished its answer |
| Idle | dark | no active session, or after you press the key |

Press the key to acknowledge "done" (back to idle). Each color can be changed in the key settings, and **OLED black when idle** turns the idle key fully off. With several sessions open, the most urgent state wins (needs you > thinking > done).

It relies on [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks). Install them once:

```sh
node ~/.config/opendeck/plugins/com.verso.claudeusage.sdPlugin/hooks/install.js
```

This adds entries to `~/.claude/settings.json` (a backup is saved as `settings.json.bak`; your other hooks are kept). The hook only writes the session state to `~/.local/state/opendeck-claude/sessions/`, nothing leaves your machine.

Before uninstalling the plugin, remove the hooks, otherwise Claude Code keeps calling a missing script:

```sh
node ~/.config/opendeck/plugins/com.verso.claudeusage.sdPlugin/hooks/install.js --uninstall
```

## Troubleshooting

| The key shows | Meaning |
|---|---|
| `NO LOGIN` | No Claude Code credentials found: run `claude` then `/login`. |
| `TOKEN EXPIRED` | Claude Code hasn't renewed its token: run `claude` once, then press the key. |
| `RATE LIMITED` | The API asked to slow down: the plugin waits longer between refreshes (up to 30 min) and recovers on its own. |
| `TIMEOUT` / `HTTP …` | Network or API issue: the plugin retries on its own. |
| Orange dot | The numbers shown are more than 15 minutes old. |

- **Nothing shows up, or the plugin doesn't start**: check that Node.js ≥ 22 is installed. The log is in `~/.local/share/opendeck/logs/plugins/com.verso.claudeusage.sdPlugin.log`.
- **The status key never changes**: the hooks aren't installed (see above).
- **The settings panel is empty and the icons show "?"**: the plugin folder is a symlink. Install a real copy instead (see [Development](#development)).

## How it works & privacy

The plugin reads the OAuth token that Claude Code stores in `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR/.credentials.json`) and calls `https://api.anthropic.com/api/oauth/usage`, the same endpoint Claude Code uses for `/usage`.

- The token is **only sent to `api.anthropic.com`**. It is never logged, cached or sent anywhere else.
- Only the last usage numbers are cached, in `~/.local/state/opendeck-claude/usage.json`, so a restart doesn't need a new request.
- The plugin **never refreshes the token** itself, so it can't interfere with Claude Code's session.
- All the logic lives in [`plugin.js`](com.verso.claudeusage.sdPlugin/plugin.js). Feel free to read it.

## Limitations

- **macOS**: Claude Code stores its credentials in the Keychain, not in a file. Not supported yet.
- **Windows**: the launcher is a bash script. Not supported yet.
- Undocumented endpoint: if Anthropic changes it, the plugin will break until it's updated.

Contributions are welcome.

## Development

```sh
git clone https://github.com/lilian-17/opendeck-claude-usage.git
cd opendeck-claude-usage
./dev-sync.sh   # copies the plugin into ~/.config/opendeck/plugins/
```

Run `./dev-sync.sh` again after each change, then restart OpenDeck. Don't symlink the folder instead: OpenDeck then can't load the key settings and the icons.

To build a release:

```sh
./package.sh   # → dist/com.verso.claudeusage.sdPlugin.zip
```

## License

[MIT](LICENSE)
