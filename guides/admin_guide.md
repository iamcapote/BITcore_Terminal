# MCP Admin Runbook (2025-10-01)

This concise guide captures the current operational state of the MCP platform while the research provider refactor is still in flight.

## 1. Platform snapshot
- **Modes**: `npm start` boots the Web terminal (Express + WebSocket). `node app/start.mjs cli` (or `npm start -- cli`) launches the console CLI. Both surfaces operate as the same single user defined in `global-user.json`.
- **Critical blocker**: `app/features/ai/research.providers.mjs` still contains placeholder text, so any feature that imports it (CLI `/research`, chat research, related Vitest suites) fails with `vite:import-analysis`. Ship the shim replacement from `research.providers.service.mjs` before production changes.
- **Default telemetry**: New WebSocket sessions auto-subscribe to GitHub activity and status feeds. Keep repos internal until access controls land.

## 2. Prerequisites
- Node.js 20 LTS (>=16 supported, but upgrade recommended).
- npm 8+
- Brave Search + Venice API keys (store via `/keys set`, not in git).
- Disk layout: plaintext operator profile under `~/.bitcore-terminal/global-user.json`; research artefacts checked into the repo.

### `.env` starter
```
PORT=3000
NODE_ENV=development
BRAVE_API_KEY=...
VENICE_API_KEY=...
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
_Status as of 2025-10-01: 48 suites pass, 5 fail due to the placeholder research provider shim._

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
| `vite:import-analysis` error for `research.providers.mjs` | Placeholder shim | Restore/export the functions from `research.providers.service.mjs`, rerun tests |
| Web terminal input stuck disabled | Pending server prompt | Inspect WebSocket logs under `app/features/research/websocket`, clear the prompt or reconnect |
| “Missing BRAVE_API_KEY” despite `/keys set` | `global-user.json` lacks the value or env vars override with blanks | Run `/keys set brave`, confirm the JSON on disk updates, restart the process |
| HTTP `POST /api/research` returns 501 | Endpoint intentionally stubbed | Finish the authenticated handler or remove the route |

## 8. Release checklist (current)
1. Replace the research provider shim; confirm `npm test` passes.
2. Verify production `.env` secrets (Brave/Venice, PORT, NODE_ENV).
3. Smoke-test both modes: login, `/status`, `/keys check`.
4. Review telemetry feeds for sensitive data exposure.
5. Deploy via PM2 or container pipeline; monitor for WebSocket reconnect churn.

Keep this runbook short—update the blocker notes immediately once the provider fix lands so operations can resume normal cadence.