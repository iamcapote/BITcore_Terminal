# BITcore Terminal Application - To Do List

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving our architectural standards and security posture.

## Verification Snapshot — 2025-10-15

- ✅ Full `npx vitest run` (359 passed, 4 skipped) at 22:04 UTC.
- ✅ Research orchestration split across `app/commands/research/run-workflow.mjs` and `app/features/research/websocket/session-bootstrap.mjs`; both siblings now sit inside the 300–500 LOC guardrail.
- ✅ Logs HTTP surface restored (`app/features/logs/routes.mjs`) with tests back to green.
- ℹ️ Memory manager still exposes `ephemeralMemories`; monitor for more legacy callers before the next refactor wave.

## Active Focus

- [x] Execute live-readiness dry run (followed `guides/live-test-checklist.md`; see `guides/live-test-dry-run-2025-10-15.md` for results and open issues around credentials and automation gaps).
- [ ] Consolidate command-execution wiring shared by `app/start.mjs` and CLI routers without breaking the LOC envelope.
- [ ] Merge or replace duplicate argument parsers across CLI and WebSocket surfaces.
- [x] Implement durable storage for research artifacts beyond session/GitHub (`/research list`, `/research download <id>`).
- [x] Harden input validation for research depth/breadth and related flags.
- [x] Add API token usage telemetry (counts per session/operator).
- [ ] Review residual security posture (rate limiting, CSRF toggles, input sanitisation).
- [ ] Continue LOC audit: current >500 line files are documentation (`README.md` at 547 lines) and generated assets; application modules now comply.

### Recently Completed (2025-10-15)

- Research archive introduced with `/research list` + `/research download`, including on-disk retention and WebSocket parity.
- Input validation tightened with configurable range checks and the `/security` telemetry surface.
- Research CLI refactored into `run-workflow.mjs` with refreshed tests and telemetry handling.
- WebSocket connection bootstrap moved to `session-bootstrap.mjs`; rate-limit/session suites pass with cleaner orchestration.
- Logs router reinstated, docs/tasks synced, and CLI/Web parity confirmed end to end.
- Token usage telemetry now emits per-run events and `/security` aggregates counts by operator across CLI and WebSocket surfaces.

---

## Completed

*   [COMPLETED] Fix `effectiveError is not a function` in `executeResearch` catch block.
*   [COMPLETED] Fix `cmdOutput is not a function` in `executeChat` for public users.
*   [COMPLETED] Ensure public users cannot execute `/research` command (block early).
*   [COMPLETED] Ensure public users receive the correct notice in `/chat` and are returned to command mode.
*   [COMPLETED] Ensure output/error handlers are correctly passed from `handleCommandMessage` to `executeChat` and `executeResearch`.
*   [COMPLETED] Verify GitHub upload pipeline in `handleInputMessage`:
    *   [COMPLETED] Ensure `userManager.getGitHubConfig` resolves plaintext credentials from the single-user profile or environment.
    *   [COMPLETED] Ensure the resolved token is passed to `uploadToGitHub`.
    *   [COMPLETED] Add robust error handling for config retrieval and upload.
*   [COMPLETED] Documented comment precision philosophy in `AGENTS.md` so code comments stay timeless and architectural.
*   [COMPLETED] Ensure `promptData` (like `suggestedFilename`) is correctly set in `executeResearch` before prompting for post-research action.
*   [COMPLETED] Web-CLI `startResearchFromChat` now pulls Brave/Venice keys from the single-user profile with environment fallbacks (`app/commands/chat.cli.mjs`).
*   [COMPLETED] WebSocket `exitMemory` reuses injected output/error handlers and re-enables input on completion (`app/commands/chat.cli.mjs`).
*   [COMPLETED] Hardened `handleChatMessage` prompt/error flow for memory and LLM operations (`app/features/research/routes.mjs`).
*   [COMPLETED] Guarded `generateQueries` input contract to prevent undefined arguments in `/research test` (`app/features/ai/research.providers.mjs`).
*   [COMPLETED] Implemented `userManager.checkApiKeys`/`testApiKeys` and `/keys stat` alias resolution (`app/features/auth/user-manager.mjs`, `app/commands/keys.cli.mjs`).
*   [COMPLETED] `/diagnose` consumes environment-backed API checks without password prompts and uses the single-user compatibility shim (`app/commands/diagnose.cli.mjs`, `app/features/auth/user-manager.mjs`).
*   [COMPLETED] Centralised Brave/Venice API-key resolution via `app/utils/api-keys.mjs` and refactored chat/research flows to consume the helper.
*   [COMPLETED] Trimmed `/missions` CLI into modular handlers to satisfy the 500-line guideline and prepare for further decomposition.
*   [COMPLETED] `/users` command now surfaces a single-user compatibility notice and defers to optional adapters for multi-user flows (`app/commands/users.cli.mjs`, `app/commands/index.mjs`, `app/features/auth/user-manager.mjs`).
*   [COMPLETED] `/chat` → `/research` bridge returns a guard message when chat history is missing, avoiding generic failures (`app/commands/chat/research/start.mjs`).
*   [COMPLETED] Double-check `enableClientInput` / `disableClientInput` pairing across all flows (prompts, errors, success).
*   [COMPLETED] Add GitHub-token tests to `/keys test`, `/diagnose`.

---

---

Important to remember:
- [x] Length of files. According to #AGENTS.md , the max size for files should be 300-500 LoC . We need to review file by file for the entire codebase to verify it is following this rule. the more modular and micro-architecture structure the better it is for the developers that debug. First start by identifying the files to fix and then related files that are connectedd to this long file. since files are connected and reference each other you have to edit meticulously and intelligently. You can separate files by nodes and modules and divide everything into micro structures (routers, orchestrators, managers, systems) . 

- Related to the last item -> each file in our codebase should have at the top a descriptive and comprehensive comments written in a precise brief and accurate way that describes at a glance what each file does. Additionally each sections should have their own comments to explain and expandd what each functiion is doing . The text should be as short as possible to be clear but as long as poossible to be precise. Information must be condensed. Comments should be timeless and not hard to undertstand. Comments should not be meta-commentary. signal-posting or similar. It must be straight forward to the point and assume the reader is intelligent. Short precise sentences. Posting fixes and to dos in comments is prohibited, there are files for this. use the appropriate channels. comments are there to explain and describe the code architecture structure functional systemic behaviors and similar. After reading this include a summarized version of this philosophy described in this paragraph in the #AGENTS.md 

- [ ] Latest line-count audit (2025-10-15): `app/commands/research.cli.mjs` (356 after `run-workflow.mjs` extraction ✅), `app/features/research/websocket/connection.mjs` (413 after `session-bootstrap.mjs` split ✅). Markdown plans and `package-lock.json` are tracked separately; continue scanning for >500 LOC outliers now that research surfaces are modular.

- Every function and every setting should be displayed and easily accessed from both the terminal and the web-cli display . This creates power users that understand EXACTLY what is under the hood. 

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving BITcore’s architectural standards and security posture.
