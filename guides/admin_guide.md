# MCP Admin Runbook (2025-10-03)

This concise guide captures the current operational state of the MCP platform with the secure configuration overlay available for production use.

## 1. Platform snapshot
- **Modes**: `npm start` boots the Web terminal (Express + WebSocket). `node app/start.mjs cli` (or `npm start -- cli`) launches the console CLI. Both surfaces operate as the same single user defined in `global-user.json`.
- **Secure config overlay**: Defining `BITCORE_CONFIG_SECRET` activates AES-GCM encrypted storage for API keys and GitHub tokens. When enabled, `/keys set` persists sensitive fields in the encrypted overlay instead of plaintext disk.
- **Session snapshots**: Research results and related session metadata are cached under `~/.bitcore-terminal/sessions/session.json`, allowing `/export` and `/storage` to resume after restarts.
- **Default telemetry**: New WebSocket sessions auto-subscribe to GitHub activity and status feeds. Keep repos internal until access controls land.

## 2. Prerequisites
- Node.js 20 LTS (>=16 supported, but upgrade recommended).
- npm 8+
- Brave Search + Venice API keys (store via `/keys set`, not in git).
- Optional secure overlay: set `BITCORE_CONFIG_SECRET` and either allow writes via `BITCORE_ALLOW_CONFIG_WRITES=1` or toggle `terminal.experimental.allowConfigWrites=true` from the encrypted config. Without the flag, the overlay loads in read-only mode.
- Disk layout: plaintext operator profile under `~/.bitcore-terminal/global-user.json`; research artefacts checked into the repo.

### `.env` starter
```
PORT=3000
NODE_ENV=development
BRAVE_API_KEY=...
VENICE_API_KEY=...
# Optional encrypted config
BITCORE_CONFIG_SECRET=...
# Allow CLI writes when the secure overlay is active (omit in prod unless needed)
BITCORE_ALLOW_CONFIG_WRITES=1
```

## 3. Install & validate
```bash
git clone <repo>
cd BITcore_Terminal
npm install
```
Run the test suite:
```bash
npm test
```
_Status as of 2025-10-03: 78 suites pass, 0 fail._

## 4. Operating the stack
### Web terminal
```bash
npm start
```
- Serves `app/public/index.html`
- WebSocket endpoint: `ws://<host>:3000/api/research/ws`

### Console CLI
```bash
node app/start.mjs cli
# or
npm start -- cli
```
- Uses the shared command registry via `interactiveCLI`.

### Logs & monitoring
- Dev: read stdout/stderr directly.
- Prod (PM2 example):
  ```bash
  pm2 start ecosystem.config.js
  pm2 logs mcp
  pm2 status
  ```
- WebSocket telemetry is emitted through GitHub activity and research status channels—scrub secrets before exposing to clients.

## 5. Admin tasks
| Task | Command |
| --- | --- |
| Inspect active profile | `/status` |
| Rotate API keys | `/keys set`, `/keys check`, `/keys test` |
| Configure GitHub uploads | `/keys set github --github-owner=ORG --github-repo=REPO [--github-branch=BRANCH] [--github-token=TOKEN]` |
| Verify secure overlay | Any `/keys set ...` call emits "Credentials stored via encrypted secure-config overlay" when the secret is active; `/keys check` confirms presence without revealing values. |
| Toggle model browser | `/terminal prefs --model-browser=true|false` (CLI) / web settings pane |
| Legacy user management | `/users ...` (shows "User management is disabled in single-user mode" unless a directory adapter is registered) |

> ℹ️ `/login`, `/logout`, and `/password-change` remain for compatibility but operate as no-ops in single-user mode.

## 6. Backup guidelines
- Operator profile: `tar -czf bitcore-terminal-$(date +%F).tgz ~/.bitcore-terminal`
- Optional research artefacts: archive the `research/` directory per deployment.
- Infra configs (PM2, nginx) belong in automation (Ansible/Terraform) rather than ad-hoc edits.

## 7. Troubleshooting cheatsheet
| Symptom | Root cause | Fix |
| --- | --- | --- |
| `vite:import-analysis` error for `research.providers.mjs` | Placeholder shim (legacy deployments) | Ensure the repo includes the restored provider modules, rerun tests |
| Web terminal input stuck disabled | Pending server prompt | Inspect WebSocket logs under `app/features/research/websocket`, clear the prompt or reconnect |
| “Missing BRAVE_API_KEY” despite `/keys set` | Secure overlay disabled or env vars override with blanks | Verify `BITCORE_CONFIG_SECRET` and write flag, rerun `/keys set brave`, restart the process |
| HTTP `POST /api/research` returns 501 | Endpoint intentionally stubbed | Finish the authenticated handler or remove the route |

## 8. Release checklist (current)
1. Confirm secure overlay access: set `BITCORE_CONFIG_SECRET`, run `/keys set brave ...`, and watch for the encrypted storage notice.
2. Verify production `.env` secrets (Brave/Venice, PORT, NODE_ENV) and restart processes to pick up changes.
3. Run `npm test` (all suites green as of 2025-10-03).
4. Smoke-test both modes: login, `/status`, `/keys check`, `/keys test`.
5. Review telemetry feeds for sensitive data exposure, then deploy via PM2 or container pipeline; monitor for WebSocket reconnect churn.

Keep this runbook short—update secure overlay guidance immediately if secrets handling changes.