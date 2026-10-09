# Claude Usage pour OpenDeck

[English](README.md)

Plugin [OpenDeck](https://github.com/nekename/OpenDeck) qui affiche le pourcentage d'utilisation de ton abonnement Claude (Pro / Max) sur une touche de Stream Deck, avec une deuxième touche qui montre ce que fait Claude Code.

![Vue utilisation](docs/preview.png)

Un appui sur la touche affiche le temps restant avant la remise à zéro :

![Vue reset](docs/preview-reset.png)

> **Non affilié à Anthropic.** Plugin communautaire non officiel. Il utilise un endpoint non documenté de Claude Code, qui peut changer ou cesser de fonctionner à tout moment.

## Fonctionnalités

- Anneau avec le pourcentage d'utilisation, coloré selon le niveau (orange, puis jaune à 70 %, puis rouge à 90 %)
- Choix par touche : session 5 h, hebdomadaire, les deux, hebdo Opus ou hebdo Sonnet
- Appui : affiche le temps avant le reset pendant 5 secondes et rafraîchit les données
- Couleurs du fond et du cercle personnalisables par touche (le texte s'adapte aux fonds clairs)
- Fond noir pur **OLED** en un clic : les pixels restent éteints autour de l'anneau
- **Touche de statut Claude Code** : réfléchit, a besoin de toi, a fini (voir [plus bas](#touche-de-statut-claude-code))
- En français et en anglais, selon la langue choisie dans OpenDeck
- Économe avec l'API : rafraîchissement toutes les 3 minutes, temporisation si l'API est saturée, dernières valeurs en cache pour un redémarrage instantané
- Aucune dépendance : un seul fichier Node.js

## Prérequis

- **Linux** (macOS et Windows pas encore supportés, voir [Limites](#limites))
- [OpenDeck](https://github.com/nekename/OpenDeck)
- **Node.js ≥ 22**. Les paquets des distributions sont souvent plus anciens (Debian 12, Ubuntu 22.04 et 24.04 fournissent la 18 ou la 20) : passe par [NodeSource](https://github.com/nodesource/distributions) ou un gestionnaire de versions. Le lanceur cherche `node` dans le `PATH` ou dans [mise](https://mise.jdx.dev), nvm, fnm, volta ou asdf, et prend la version compatible la plus récente.
- [Claude Code](https://claude.com/claude-code) connecté avec ton compte Claude (`claude` puis `/login`)

## Installation

**Depuis OpenDeck** : ouvre la liste des plugins, cherche **Claude Usage** et installe-le.

**À la main** : télécharge `com.verso.claudeusage.sdPlugin.zip` depuis la page [Releases](../../releases), puis installe-le depuis OpenDeck, ou décompresse-le dans le dossier des plugins :

```sh
unzip com.verso.claudeusage.sdPlugin.zip -d ~/.config/opendeck/plugins/
```

Redémarre OpenDeck, puis glisse l'action **Claude → Utilisation Claude** sur une touche. Clique sur la touche dans OpenDeck pour ouvrir ses réglages.

## Réglages de la touche

| Réglage | Choix |
|---|---|
| Limite affichée | session 5 h, hebdomadaire, les deux, hebdo Opus, hebdo Sonnet |
| Fond / Cercle | n'importe quelle couleur ; **Noir OLED** met un fond noir pur |
| Couleurs par défaut | retour à l'apparence d'origine |

Un petit point orange dans le coin signale que les chiffres datent de plus de 15 minutes (problème réseau, API saturée ou jeton expiré).

## Touche de statut Claude Code

Une deuxième action, **Statut Claude Code**, colore la touche selon ce que fait Claude Code :

| État | Couleur par défaut | Quand |
|---|---|---|
| Réfléchit | bleu | après l'envoi d'un prompt, pendant l'exécution des outils |
| A besoin de toi | rouge | demande de permission ou question de Claude |
| A fini | vert | Claude a terminé sa réponse |
| Inactif | sombre | aucune session active, ou après un appui sur la touche |

Un appui sur la touche marque « fini » comme vu (retour à inactif). Chaque couleur se change dans les réglages de la touche, et **Inactif noir OLED** éteint complètement la touche au repos. Avec plusieurs sessions ouvertes, l'état le plus urgent l'emporte (à toi > réfléchit > fini).

Ça repose sur les [hooks de Claude Code](https://docs.claude.com/en/docs/claude-code/hooks). Installe-les une fois :

```sh
node ~/.config/opendeck/plugins/com.verso.claudeusage.sdPlugin/hooks/install.js
```

Ça ajoute des entrées dans `~/.claude/settings.json` (une sauvegarde est faite dans `settings.json.bak`, tes autres hooks sont conservés). Le hook écrit seulement l'état de la session dans `~/.local/state/opendeck-claude/sessions/`, rien ne sort de ta machine.

Avant de désinstaller le plugin, retire les hooks, sinon Claude Code continue d'appeler un script qui n'existe plus :

```sh
node ~/.config/opendeck/plugins/com.verso.claudeusage.sdPlugin/hooks/install.js --uninstall
```

## Dépannage

| La touche affiche | Signification |
|---|---|
| `NO LOGIN` | Aucun identifiant Claude Code trouvé : lance `claude` puis `/login`. |
| `TOKEN EXPIRÉ` | Claude Code n'a pas renouvelé son jeton : lance `claude` une fois, puis appuie sur la touche. |
| `API SATURÉE` | L'API demande de ralentir : le plugin espace ses rafraîchissements (jusqu'à 30 min) et repart tout seul. |
| `TIMEOUT` / `HTTP …` | Problème réseau ou API : le plugin réessaie tout seul. |
| Point orange | Les chiffres affichés datent de plus de 15 minutes. |

- **Rien ne s'affiche, ou le plugin ne démarre pas** : vérifie que Node.js ≥ 22 est installé. Le log est dans `~/.local/share/opendeck/logs/plugins/com.verso.claudeusage.sdPlugin.log`.
- **La touche de statut ne change jamais** : les hooks ne sont pas installés (voir plus haut).
- **Le panneau de réglages est vide et les icônes affichent « ? »** : le dossier du plugin est un lien symbolique. Installe une vraie copie à la place (voir [Développement](#développement)).

## Fonctionnement et confidentialité

Le plugin lit le jeton OAuth que Claude Code enregistre dans `~/.claude/.credentials.json` (ou `$CLAUDE_CONFIG_DIR/.credentials.json`) et appelle `https://api.anthropic.com/api/oauth/usage`, l'endpoint qu'utilise Claude Code pour `/usage`.

- Le jeton est **envoyé uniquement à `api.anthropic.com`**. Il n'est jamais écrit dans les logs, mis en cache ni envoyé ailleurs.
- Seuls les derniers chiffres d'utilisation sont gardés en cache, dans `~/.local/state/opendeck-claude/usage.json`, pour qu'un redémarrage ne refasse pas de requête.
- Le plugin **ne renouvelle jamais le jeton** lui-même, pour ne pas perturber la session de Claude Code.
- Toute la logique est dans [`plugin.js`](com.verso.claudeusage.sdPlugin/plugin.js). N'hésite pas à le lire.

## Limites

- **macOS** : Claude Code range ses identifiants dans le Trousseau, pas dans un fichier. Pas encore supporté.
- **Windows** : le lanceur est un script bash. Pas encore supporté.
- Endpoint non documenté : si Anthropic le modifie, le plugin cassera jusqu'à sa mise à jour.

Les contributions sont bienvenues.

## Développement

```sh
git clone https://github.com/lilian-17/opendeck-claude-usage.git
cd opendeck-claude-usage
./dev-sync.sh   # copie le plugin dans ~/.config/opendeck/plugins/
```

Relance `./dev-sync.sh` après chaque modification, puis redémarre OpenDeck. Ne fais pas de lien symbolique à la place : OpenDeck ne peut alors pas charger les réglages des touches ni les icônes.

Pour construire une release :

```sh
./package.sh   # → dist/com.verso.claudeusage.sdPlugin.zip
```

## Licence

[MIT](LICENSE)
