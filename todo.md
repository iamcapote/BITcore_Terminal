# MCP Application - ToDo List

This list tracks specific tasks to be implemented or fixed.

## High Priority

*   [COMPLETED] Fix `effectiveError is not a function` in `executeResearch` catch block.
*   [COMPLETED] Fix `cmdOutput is not a function` in `executeChat` for public users.
*   [COMPLETED] Ensure public users cannot execute `/research` command (block early).
*   [COMPLETED] Ensure public users receive the correct notice in `/chat` and are returned to command mode.
*   [COMPLETED] Ensure output/error handlers are correctly passed from `handleCommandMessage` to `executeChat` and `executeResearch`.
*   [COMPLETED] Verify GitHub upload pipeline in `handleInputMessage`:
    *   [COMPLETED] Ensure `userManager.getGitHubConfig` is called with password.
    *   [COMPLETED] Ensure decrypted token is passed to `uploadToGitHub`.
    *   [COMPLETED] Add robust error handling for config retrieval and upload.
    *   [COMPLETED] Handle nested password prompt for GitHub token if needed.
*   [COMPLETED] Ensure `promptData` (like `suggestedFilename`) is correctly set in `executeResearch` before prompting for post-research action.

## Medium Priority

*   Implement persistent storage for research results beyond session/GitHub (e.g., local DB or files tied to user).
    *   Add `/research list` command.
    *   Add `/research download <id>` command.
*   Refactor `executeResearch` to reduce complexity.
*   Add more robust input validation for command arguments (e.g., depth/breadth ranges).
*   Implement basic API token usage tracking (e.g., count calls per session).
*   Review and enhance security aspects (input sanitization, rate limiting).

## Low Priority

*   Implement streaming responses for LLM calls and research steps.
*   Abstract `LLMClient` further to support multiple providers.
*   Develop a comprehensive automated testing suite.
*   Enhance web terminal UI (command history, better formatting).
*   Explore concurrency models for WebSocket message handling if needed.
*   Add more user commands for memory interaction (`/memory search`, `/memory delete`).

## High-Priority Bug Backlog

- [ ] Web-CLI: review `startResearchFromChat` API-key handling + chat integration.
- [ ] Ensure `exitMemory` uses correct output/error handlers in WebSocket context.
- [ ] Harden `handleChatMessage` input-state + error flow around memory & LLM.
- [ ] `generateQueries` receives `undefined` args in `/research test` (investigate call-site).
- [ ] Implement `userManager.checkApiKeys` and `userManager.testApiKeys`. (Partially done via `hasApiKey`/`hasGitHubConfig`, but full test logic needed).
- [ ] Fix `/keys stat` alias mapping (if still needed after `check` implementation).
- [ ] Pass password through `/diagnose` → `checkApi`.
- [ ] Centralise provider API-key injection (`BraveSearchProvider`, etc.).
- [ ] Double-check `enableClientInput` / `disableClientInput` pairing across all flows (prompts, errors, success).
- [ ] Add GitHub-token tests to `/keys test`, `/diagnose`.
- [ ] Web-CLI: full `/research`-in-chat flow (password, memory, prompts).
- [ ] Rate-limit WebSocket & add CSRF (if forms introduced).
- [ ] **(Testing)** Verify GitHub upload works after user sets a valid token with `repo` scope.
- [ ] **(Testing)** Verify public profile restrictions for `/research`, `/keys`, and `/chat`.
- [ ] **(Testing)** Verify `/chat` command works correctly for logged-in users in Web-CLI.

### 3.1 Chat & Memory
- [ ] Retrieve relevant memories before LLM call; store after each turn (CLI & Web).
- [ ] `/memory stats`, `/exitmemory`, flag `--memory` end-to-end in Web-CLI.
- [ ] Persist sessions beyond memory-store (DB/kv).

### 3.4 Configuration
- [ ] Move hard-coded ports, paths, timeouts to env/config.

### Infrastructure / Refactor

- [ ] Consolidate command-execution logic (`start.mjs`, `routes.mjs`).
- [ ] Merge/replace duplicate arg-parsers.
- [ ] Replace ad-hoc `console.*` with structured handlers everywhere.
- [ ] Accept shared `LLMClient` in `research.providers.mjs`.