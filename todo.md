# BITcore Terminal Application - To Do List

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving our architectural standards and security posture.


## High-Priority Bug Backlog


- [ ] Web-CLI: full `/research`-in-chat flow (memory prompts, markdown actions) without relying on password prompts.
- [ ] Rate-limit WebSocket & add CSRF (if forms introduced).
- [ ] Restore Venice-backed query/summarisation providers in `app/features/ai/research.providers.mjs` and wire tests.
- [ ] **(Testing)** Verify GitHub upload works after user sets a valid token with `repo` scope.
- [ ] **(Testing)** Verify single-user profile behavior for `/research`, `/keys`, and `/chat` in CLI and Web flows.
- [ ] **(Testing)** Verify `/chat` command works correctly for the single-user session in Web-CLI.
- [ ] Is the app ready for live production? live test? 


### Chat & Memory
- [ ] Retrieve relevant memories before LLM call; store after each turn (CLI & Web).
- [ ] `/memory stats`, `/exitmemory`, flag `--memory` end-to-end in Web-CLI.
- [ ] Persist sessions beyond memory-store (DB/kv).


### Infrastructure / Refactor

- [ ] Consolidate command-execution logic (`start.mjs`, `routes.mjs`). Obviously without hitting LoC limits.
- [ ] Merge/replace duplicate arg-parsers.
- [ ] Replace ad-hoc `console.*` with structured handlers everywhere.
- [ ] Accept shared `LLMClient` in `research.providers.mjs`.



###  Scheduler for Research Missions

-[ ] ##  Research Scheduling
- **Task**: Use node-cron to fetch research requests from GitHub.
- **Installation**: Run `npm install node-cron` if not installed.

---

```javascript
const cron = require('node-cron');
const { fetchResearchRequests } = require('./path/to/github/api'); // Adjust path accordingly
// Set up the scheduler
cron.schedule('0 * * * *', async () => {
    const requests = await fetchResearchRequests();
    for (const request of requests) {
        await feedToAI(request); // Adjust with your function implementation
    }
});
```


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

- [ ] **Storage Command (`/storage`):**
    - [ ] Implement `/storage save <filename.md>`: Takes the content stored in `session.currentResearchResult` and uploads it to GitHub using the configured settings and the provided filename. Requires a configured GitHub token (single-user profile or environment).
    - [ ] Implement `/storage list`: Lists files in the configured GitHub repo's research directory (requires GitHub token).
    - [ ] Implement `/storage get <filename.md>`: Downloads a specific file from the GitHub repo (requires GitHub token).
    - [ ] Implement `/storage delete <filename.md>`: Deletes a specific file from the GitHub repo (requires GitHub token, optionally guarded by feature flag).
- [ ] **Export Command (`/export`):**
    - [ ] Implement `/export`: Triggers a download of the content stored in `session.currentResearchResult` using the `download_file` WebSocket message.
- [ ] **Refine Error Handling:** Improve consistency and detail in error messages sent to the client.
- [ ] **Improve Progress Reporting:** Make progress updates more granular, especially during LLM calls and search result processing within `ResearchPath`.
- [ ] **CLI Mode Parity:** Ensure CLI mode (`executeResearch` without WebSocket) handles results appropriately (e.g., prints markdown to console).
- [ ] **Configuration Management:** Consider a more robust way to manage API keys and GitHub settings beyond simple environment variables or user prompts (e.g., encrypted config file).
- [ ] **Testing:** Add unit and integration tests for the research engine, command handlers, and WebSocket interactions.
- [ ] **Documentation:** Update `/help` command text to mirror current docs/features.

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
- [COMPLETED] Double-check `enableClientInput` / `disableClientInput` pairing across all flows (prompts, errors, success).
- [COMPLETED] Add GitHub-token tests to `/keys test`, `/diagnose`.

---

---

Important to remember:
- Length of files. According to #AGENTS.md , the max size for files should be 300-500 LoC . We need to review file by file for the entire codebase to verify it is following this rule. the more modular and micro-architecture structure the better it is for the developers that debug. First start by identifying the files to fix and then related files that are connectedd to this long file. since files are connected and reference each other you have to edit meticulously and intelligently. You can separate files by nodes and modules and divide everything into micro structures (routers, orchestrators, managers, systems) . 

- Related to the last item -> each file in our codebase should have at the top a descriptive and comprehensive comments written in a precise brief and accurate way that describes at a glance what each file does. Additionally each sections should have their own comments to explain and expandd what each functiion is doing . The text should be as short as possible to be clear but as long as poossible to be precise. Information must be condensed. Comments should be timeless and not hard to undertstand. Comments should not be meta-commentary. signal-posting or similar. It must be straight forward to the point and assume the reader is intelligent. Short precise sentences. Posting fixes and to dos in comments is prohibited, there are files for this. use the appropriate channels. comments are there to explain and describe the code architecture structure functional systemic behaviors and similar. After reading this include a summarized version of this philosophy described in this paragraph in the #AGENTS.md 

- Every function and every setting should be displayed and easily accessed from both the terminal and the web-cli display . This creates power users that understand EXACTLY what is under the hood. 

> **Note:** Treat this plan as additive context. Engineers should feel empowered to iterate, split, or parallelize tasks as bandwidth allows while preserving BITcore’s architectural standards and security posture.
