# BITcore Terminal Application - To Do List

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving our architectural standards and security posture.

## Verification Snapshot — 2025-10-02

- ✅ Full `vitest run` now passes (58 suites ✅, 0 ❌, 2 skipped). Output captured at 16:02 UTC.
- ✅ `app/features/ai/research.providers.mjs` re-exports the modular service/utility implementation without placeholder code.
- ✅ `app/features/logs/routes.mjs` restored with admin-gated Express handlers and parity comments.
- ℹ️ Memory manager regained the `ephemeralMemories` accessor for legacy callers; monitor for additional compatibility shims before broader refactors.

### Immediate Next Actions

- [x] Restore a valid `research.providers` surface by finishing the split into `*.utils|*.llm|*.service|*.controller` modules and re-exporting only stable contracts.
- [x] Recreate `app/features/logs/routes.mjs` (or adjust imports) so the logs HTTP surface is available to tests and Web clients.
- [x] Re-run `npm test` to confirm chat, CLI, and persona suites pass once the above modules are fixed.
- [x] Sweep CLI/Web parity after provider restoration to ensure every flag/setting remains reachable in both surfaces (see `AGENTS.md` parity rule).


## High-Priority Bug Backlog


    - [x] Web-CLI: full `/research`-in-chat flow (memory prompts, markdown actions) without relying on password prompts (single-user mode skips prompt unless vault enabled; tested).
    - [x] Web `/research` now prompts for a query when none is provided, keeping the flow interactive without leaving chat.
    - [x] Web `/research` run caches the trimmed query and markdown on the session with tests covering the WebSocket state contract.
    - [x] Web `/research` clears cached query/result state on failures so follow-up actions never operate on stale data (documented in guides).
    - [x] Web `/research` now surfaces timeout/cancellation notices when the initial query prompt fails so operators get immediate feedback.
- [x] Rate-limit WebSocket & add CSRF (if forms introduced).
    - [x] Rate-limit `/research` WebSocket command (3 req/sec) with retry messaging and tests.
    - [x] Optional CSRF guard (`RESEARCH_WS_CSRF_REQUIRED=true`) validates per-session token on command payloads.
- [COMPLETED] Restore Venice-backed query/summarisation providers in `app/features/ai/research.providers.mjs` and wire tests.
- [x] **(Testing)** Verify GitHub upload works after user sets a valid token with `repo` scope.
- [x] **(Testing)** Verify single-user profile behavior for `/research`, `/keys`, and `/chat` in CLI and Web flows.
- [x] **(Testing)** Verify `/chat` command works correctly for the single-user session in Web-CLI.
- [ ] Is the app ready for live production? live test? 
    - Follow `guides/live-test-checklist.md` end-to-end and capture results in release notes before marking complete.


### Chat & Memory
- [x] Retrieve relevant memories before LLM call; store after each turn (CLI & Web).
- [x] `/memory stats`, `/exitmemory`, flag `--memory` end-to-end in Web-CLI.
- [x] Persist sessions beyond memory-store (DB/kv).


### Infrastructure / Refactor

- [ ] Consolidate command-execution logic (`start.mjs`, `routes.mjs`). Obviously without hitting LoC limits.
- [ ] Merge/replace duplicate arg-parsers.
- [x] Replace ad-hoc `console.*` with structured handlers everywhere.
    - [x] `/login` and `/logout` CLI commands emit via module logger with stdout mirroring.
    - [x] `/status` CLI command routes output through structured logger-aware emitters.
    - [x] `/keys` CLI command uses shared logger emitters for output/error paths.
    - [x] `/memory` CLI command wraps handlers with structured logger emitters and logs metadata per subcommand.
    - [x] `/terminal` CLI command emits via module logger and annotates preference operations.
    - [x] `/logs` CLI command streams output through structured emitters and records tail metadata without breaking buffer semantics.
    - [x] `/password-change` CLI command emits structured notices without direct console usage.
    - [x] `/prompts` CLI command routes all output through logger emitters and records telemetry for each subcommand.
    - [x] `/chat-history` CLI command mirrors web telemetry and emits via structured handlers.
    - [x] `/research-github` CLI command logs sync operations with repository metadata and structured emitters.
    - [x] `/diagnose` CLI command emits structured diagnostics and logs admin-only access attempts.
    - [x] `/github-sync` CLI command mirrors repo sync events through structured emitters and telemetry.
    - [x] `/research-scheduler` CLI command surfaces scheduler state via logger emitters and telemetry hooks.
    - [x] `/research` CLI command streams investigation flow through structured emitters with telemetry parity.
- [x] Accept shared `LLMClient` in `research.providers.mjs`.



###  Scheduler for Research Missions

- [x] ##  Research Scheduling
    - **Result**: Node-cron scheduler polls GitHub research requests via `app/features/research/github-sync/request.scheduler.mjs` and starts automatically when enabled in config.

---

## Next Steps leave for future - Data Handling

*   Implement persistent storage for research results beyond session/GitHub (e.g., local DB or files tied to user).
    *   Add `/research list` command.
    *   Add `/research download <id>` command.
*   Refactor `executeResearch` to reduce complexity.
*   Add more robust input validation for command arguments (e.g., depth/breadth ranges).
*   Implement basic API token usage tracking (e.g., count calls per session).
*   Review and enhance security aspects (input sanitization, rate limiting).

---

- [x] **Storage Command (`/storage`):**
    - [x] Implement `/storage save <filename.md>`: Takes the content stored in `session.currentResearchResult` and uploads it to GitHub using the configured settings and the provided filename. Requires a configured GitHub token (single-user profile or environment).
    - [x] Implement `/storage list`: Lists files in the configured GitHub repo's research directory (requires GitHub token).
    - [x] Implement `/storage get <filename.md>`: Downloads a specific file from the GitHub repo (requires GitHub token).
    - [x] Implement `/storage delete <filename.md>`: Deletes a specific file from the GitHub repo (requires GitHub token, optionally guarded by feature flag).
- [x] **Export Command (`/export`):**
    - [x] Implement `/export`: Triggers a download of the content stored in `session.currentResearchResult` using the `download_file` WebSocket message and mirrors the behaviour in the CLI by writing to disk.
- [x] **Refine Error Handling:** Improve consistency and detail in error messages sent to the client.
- [x] **Improve Progress Reporting:** Make progress updates more granular, especially during LLM calls and search result processing within `ResearchPath`.
- [x] **CLI Mode Parity:** Ensure CLI mode (`executeResearch` without WebSocket) handles results appropriately (e.g., prints markdown to console).
- [x] **Configuration Management:** Consider a more robust way to manage API keys and GitHub settings beyond simple environment variables or user prompts (e.g., encrypted config file).
- [x] **Testing:** Add unit and integration tests for the research engine, command handlers, and WebSocket interactions.
- [x] **Documentation:** Update `/help` command text to mirror current docs/features.

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

- [x] Latest line-count audit (2025-10-03): `README.md` (514), `app/commands/research.cli.mjs` (507), `langchain/LANGCHAIN_ARCHITECTURE.md` (547), `langchain/LANGCHAIN_MIGRATION_PLAN.md` (1813), `package-lock.json` (4832). Prioritize splitting or trimming code modules first.

- Every function and every setting should be displayed and easily accessed from both the terminal and the web-cli display . This creates power users that understand EXACTLY what is under the hood. 

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving BITcore’s architectural standards and security posture.
