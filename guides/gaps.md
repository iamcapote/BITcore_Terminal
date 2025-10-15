prompt:

#file:README.md #file:gaps.md #file:research.md #file:venice.md #file:todo.md #file:tokenclassifier.md #file:chat.md #file:current_app_folder_file_tree.md #folder:app 


use the #file:README.md and #file:current_app_folder_file_tree.md for application context found in the #folder:app . Once you have this context proceed to #file:gaps.md and #file:todo.md to implement the next stages of development starting with the easiest fixes. Once you have completed tasks you can move them into #file:completed.md but dont delete or omit anything as we want a full trail of all tasks.


our current web-cli app is not working and behaving properly search high and low in the #codebase to bring our app up to speed. check the #terminalLastCommand #terminalSelection #codebase to know how the app is behaving in console-cli and or web-cli depending on if its `npm start` for the web-cli or `npm start cli` for the console-cli.

you are a well respected and excellent developer with decades of experience shipping full live products that bring in thousands of users and a lot of revenue. if you modify any file make sure you understand its contents and context first and you arent deleting anything important this is a very serious app and it is live.


# Platform Gap Snapshot (2025-10-15)

_Latest validation: `npm test` on 2025-10-15 at 20:40 UTC._

## 🚨 Critical blockers
- _None at this time._ Logs HTTP surface restored on 2025-10-15; full Vitest run now green.

## ⚠️ High-priority follow-ups
- **Multi-user CLI roadmap** — `/users` now reports "User management is disabled in single-user mode" unless a directory adapter is registered via `userManager.registerUserDirectoryAdapter`. Provide a reference adapter once multi-user access control returns to the roadmap.
- **Research archive retention** — Durable storage now lands under `config.research.archive.directory`; audit disk growth and add pruning telemetry before enabling multi-user access.
- **Token telemetry validation** — `/security` now surfaces per-operator Venice token counts. Monitor for accuracy across CLI/Web runs and decide on alerting thresholds before multi-user rollout.
- **Web research/session telemetry coupling** — WebSocket connection bootstraps GitHub activity streams and status snapshots by default (`features/research/websocket/session-bootstrap.mjs`). Works in single-user mode but still lacks multi-user hardening (durable session store, prompt password resets).
  - Action: Monitor after the provider fix and schedule a resilience review when multi-user support becomes a requirement.
- **Plaintext credentials** — `global-user.json` now stores Brave, Venice, and GitHub tokens unencrypted. This keeps the CLI simple but regresses the previous AES-GCM protection.
  - Action: Gate production builds behind an encryption toggle or re-enable the vault once the research blocker clears.

## 📊 QA + Ops snapshot
- `npm test`: 79 suites executed, 79 passed (latest run 2025-10-15 21:27 UTC).
- `node scripts/webcli-smoke.mjs`: Web terminal smoke (`/status`, `/keys check`, `/chat`, `/research`, `/export`) completed with fallback summaries (Brave 422, Venice 401) but no crashes.
- `tests/github-memory.test.mjs`: Emits “fatal: not a git repository” warnings because it exercises fallback persistence without a real repo. Acceptable for now but document if the noise becomes problematic.
- Manual `/users list`: emits "User management is disabled in single-user mode" until multi-user storage returns.
- Manual `/keys test`: succeeds when keys are present in `global-user.json`; no password prompts occur in single-user mode.

### Recently cleared
- Research provider shim restored — `app/features/ai/research.providers.mjs` now re-exports the service implementation; Vitest provider suites complete using fallbacks when Venice keys are absent.

## 🧭 Next recommended actions
1. Confirm HTTP `/api/research` deprecation messaging suffices; add analytics or logs review if clients keep calling the legacy route.
2. Monitor the new `/security` token usage metrics during live-readiness drills and capture anomalies for tuning.
3. Reconcile `/users` command behaviour with the new single-user contract (graceful message + documentation update).
4. Schedule a pass on WebSocket session persistence and credential storage once multi-user support is back in scope.
