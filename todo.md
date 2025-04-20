# MCP Project TODO List

## Critical / Next Steps

- [ ] **Web-CLI Connection Stability:** Analyze detailed logs from `webcomm.js` and `routes.mjs` to identify and fix the root cause of the WebSocket connection drops ("Abnormal closure"). Investigate potential unhandled promise rejections or errors during command execution. **CRITICAL - BLOCKING WEB UI**
- [x] **(Web-CLI Bug Fix)** Fix `Internal Error: Research query missing in WebSocket mode after interactive prompts.` by ensuring `executeResearch` correctly uses `options.query` when `positionalArgs` are empty. (`research.cli.mjs`)
- [ ] **Testing:** Thoroughly test the refactored Web-CLI flow: login (with/without password arg), chat initiation, in-chat commands (`/research`, `/memory stats`, `/exitmemory`), memory commit feedback, interactive research prompts (query, params, classification, password), session reset on disconnect, prompt cancellation (Escape), prompt timeouts, and general input responsiveness after various command sequences and errors. **CRITICAL - AFTER WEB-CLI CONNECTION FIXED**
    - [ ] **Verify Fix:** Confirm that commands like `/login user pass` are correctly parsed and sent without an extra leading slash.
    - [ ] **Verify Fix:** Confirm `/research <query>` now correctly prompts for password if needed, uses it, and executes research, or fails with a specific decryption error.
    - [x] **Verify Fix:** Confirm interactive `/research` now correctly passes authentication checks after login and uses the interactively provided query.
    - [x] **Verify Fix:** Confirm token classification uses the correct model (`llama-3.3-70b`) and handles API errors gracefully.
    - [x] **Verify Fix:** Confirm `ResearchPath.processQuery` handles the query string correctly and doesn't throw "Invalid query: must be a string".
    - [x] **Verify Fix:** Confirm `generateQueries` fallback now produces correctly structured query objects (`{ original: string, metadata: {...} }`).
- [ ] **Testing (Console CLI):** Verify the fixes for `readline` interference, `/exit` behavior in chat, and password caching work correctly. Test edge cases like Ctrl+C during prompts/chat.
- [ ] **Configuration:** Set up `BRAVE_API_KEY` environment variable. Verify LLM model names used (e.g., `llama-3.3-70b`) are correct and available via the configured `VENICE_API_KEY`.

## Feature Enhancements & Refinements

- [ ] **Chat Memory Integration (CLI & Web):**
    - [ ] Integrate `memoryManager.retrieveRelevantMemories` before calling LLM in `startInteractiveChat` (CLI) and `handleChatMessage` (Web).
    - [ ] Integrate `memoryManager.storeMemory` after user input and AI response in `startInteractiveChat` (CLI) and `handleChatMessage` (Web).
- [ ] **Research from Chat (CLI & Web):**
    - [ ] Implement secure API key retrieval (potentially prompting for password if needed) within `startResearchFromChat` or pass keys securely from the calling context (`handleChatMessage`).
    - [ ] Refine `startResearchFromChat` to properly use `ResearchEngine` with necessary keys and context.
    - [ ] Handle `/research` command within `handleChatMessage` (Web-CLI) by calling `startResearchFromChat`.
    - [ ] Review `startResearchFromChat` function signature and implementation to ensure it correctly handles calls from `handleChatMessage` (passing history, memories, options, handlers). (chat.cli.mjs)
- [ ] **Memory Management (Web-CLI):** Verify `/exitmemory` and `/memory stats` work correctly within `/chat --memory` in the web interface. Ensure `MemoryManager` instance is correctly passed and managed in the session.
- [ ] **Error Handling:** Improve consistency and detail in error messages across CLI and Web-CLI. Ensure errors during background tasks (like memory finalization) are reported correctly.
- [ ] **Web-CLI Prompt Timeouts:** Implement client-side or server-side timeouts for `wsPrompt` to prevent sessions hanging indefinitely. (Server-side implemented, client-side could be added).
- [ ] **Web-CLI Input Responsiveness:** Ensure input field is consistently enabled/disabled correctly, especially after errors, cancellations, or complex command sequences. Review `terminal.js` state management (`inputEnabled`, `pendingPromptResolve`, etc.).
- [ ] **Web-CLI:** Verify password prompt flow in `command-processor.js` and `terminal.js` works reliably.
- [ ] **Security:** Review password handling and API key encryption/decryption flow for potential vulnerabilities. Consider Argon2 parameter tuning.
- [ ] **Refactoring:** Consolidate prompt logic (CLI `singlePrompt`/`promptHiddenFixed`, Web `wsPrompt`) if possible. Standardize command result objects.
- [ ] **Configuration:** Move hardcoded values (ports, timeouts, API URLs) to a configuration file or environment variables.
- [ ] **Review and implement remaining items from `gaps.md`.**
- [ ] **Enhance password handling UX in CLI (e.g., retry prompt on failure).**
- [ ] **Implement session persistence/validation for Web-CLI beyond simple in-memory storage.**
- [ ] **Add more robust input validation across all commands.**
- [ ] **Refactor command execution logic in `start.mjs` (CLI) and `routes.mjs` (WebSocket) to reduce duplication.**
- [ ] **Add comprehensive unit and integration tests.**
- [ ] **Improve UI/UX for Web-CLI (e.g., better status indicators, command suggestions).**
- [ ] **Secure HTTP endpoints if they are intended for use.**
- [ ] **Consider adding `--depth` and `--breadth` flags to the `/research` command when used within `/chat`. (routes.mjs, chat.cli.mjs)**
- [ ] **Standardize argument parsing across CLI and Web-CLI further (potentially reusing a single robust parser if feasible).**

## Documentation & Cleanup

- [ ] **README:** Update README with current command list, architecture details, and setup instructions reflecting recent changes.
- [ ] **Code Comments:** Add/update JSDoc comments for major functions and classes.
- [ ] **Dependency Review:** Check for unused dependencies.
- [ ] **(Web-CLI):** Verify `/exitmemory` and `/memory stats` work correctly within `/chat --memory` in the web interface. Ensure `MemoryManager` instance is correctly passed and managed in the session.

## Testing Backlog

- [ ] **Unit Tests:** Add more unit tests for `UserManager`, `MemoryManager`, command parsing, etc.
- [ ] **Integration Tests:** Develop integration tests for key user flows (login -> research, login -> chat -> memory).
- [ ] **Test Web-CLI Flow:** Thoroughly test login, chat initiation, in-chat commands (`/research`, `/memory stats`, `/exitmemory`), memory commit feedback, interactive research prompts, session reset on disconnect, prompt cancellation/timeout. **CRITICAL**
- [ ] **Implement comprehensive unit and integration tests for command parsing, WebSocket handling, and command execution flows.**

## Future Ideas

- [ ] **Agent Framework:** Explore integrating a more formal agent framework (e.g., LangChain.js) for managing chat, tools, and memory.
- [ ] **UI Enhancements:** Improve the web terminal UI (e.g., better scrolling, clear command, themes).
- [ ] **Streaming Responses:** Implement streaming for LLM responses in chat mode.
- [ ] **Multi-Modal Support:** Consider adding support for image input/output.
- [ ] **Review security implications of HTTP POST endpoint and implement proper authentication/authorization if it's intended for use. (routes.mjs)**

## TODO List

### High Priority / Bugs
- [x] Fix WebSocket command execution errors (`cliOutput.log/error is not a function`). Standardize command signatures. (Partially done, needs verification across all commands)
- [x] Fix `/research` API key propagation issue in Web-CLI.
- [x] Add `/help` command to WebSocket interface.
- [x] Fix `/users` admin check in WebSocket context.
- [x] Fix `/diagnose` output function issue in WebSocket context.
- [x] **(Web-CLI Bug)** Fix chat mode input routing in `terminal.js`.
- [x] **(Web-CLI Bug)** Fix `/research` command logic to check for query before prompting for password.
- [ ] Review `startResearchFromChat` implementation and API key handling within chat mode.
- [ ] Ensure `exitMemory` correctly uses passed output/error functions in WebSocket context.
- [ ] Review `handleChatMessage` logic for error handling and input enabling/disabling, especially around memory operations and LLM calls.
- [ ] Investigate why `generateQueries` in `/research test` receives `undefined` for query and breadth. (Likely related to how `controller.research` is called).
- [x] **(Web-CLI Bug)** Fix `/research <query>` password prompt flow where password wasn't passed correctly to `executeResearch`.
- [x] **(Web-CLI Bug)** Fix interactive `/research` authentication check failure.
- [x] **(Web-CLI Bug Fix)** Fix `Internal Error: Research query missing in WebSocket mode after interactive prompts.` (`research.cli.mjs`)
- [ ] **Implement `userManager.checkApiKeys`:** Add a method to check if keys exist for a user (using `hasApiKey`).
- [ ] **Implement `userManager.testApiKeys`:** Add a method to retrieve and test API keys (using `getApiKey` and making test calls).
- [ ] **Fix `/keys stat` Alias:** Correct the logic in `keys.cli.mjs` to handle the `stat` alias for `check`.
- [ ] **Fix `/diagnose` Password:** Ensure the password obtained (via cache or prompt) in `handleCommandMessage` is correctly passed to `executeDiagnose` and then to the internal `checkApi` helper.
- [ ] **Refactor API Key Usage:**
    *   Modify `BraveSearchProvider` (and potentially others) to accept an API key in the constructor, falling back to `process.env`.
    *   Modify the research command flow (`handleCommandMessage`, `handleChatMessage`, and conceptually `research.engine.mjs`) to retrieve user keys via `userManager.getApiKey` and pass them to the providers. *(Partial implementation possible due to missing files)*.
- [ ] **Review WebSocket Input State:** Double-check `enableClientInput`/`disableClientInput` calls around async operations, prompts, and error handling in `routes.mjs`.
- [ ] **Add GitHub Key Support:** Integrate GitHub key checking/testing into `userManager.testApiKeys`, `keys.cli.mjs`, and `diagnose.cli.mjs`. (Partially done in diagnose, needs adding elsewhere).
- [x] **Web CLI:** Interactive `/research` command hangs after entering the query. (Client sends `{"type":"input", "value": "..."}` but server expects `{"type":"input", "input": "..."}` in `handleInputMessage`).
- [ ] **Web CLI:** Implement remaining interactive prompts (breadth, depth, classify) in `/research` command flow after fixing the query prompt.
- [ ] **Web CLI:** Ensure `handleChatMessage` correctly handles `/research` command initiated from within chat mode, including password prompting and memory retrieval.
- [ ] **Web CLI:** Review `startResearchFromChat` function signature and implementation to ensure it aligns with how it's called from `handleChatMessage`.
- [ ] **Core:** Review password caching logic - ensure it's cleared appropriately on logout, session expiry, or relevant errors. (Partially addressed, review needed).
- [ ] **Core:** Implement robust error handling for API key decryption failures across all commands (`keys`, `chat`, `research`, `diagnose`).
- [ ] **Security:** Review HTTP POST endpoint `/api/research` - currently disabled, needs proper implementation or removal.
- [ ] **Security:** Implement rate limiting for WebSocket connections and commands.
- [ ] **Security:** Consider CSRF protection if forms are added to the web interface.
- [ ] **Refactor:** Consolidate argument parsing logic if possible.
- [ ] **Refactor:** Improve logging clarity and consistency, potentially adding log levels.
- [ ] **Docs:** Update README and other documentation (`gaps.md`, `research.md`, etc.) to reflect current state and fixes.
- [x] **(Web-CLI Bug Fix)** Fix Token Classifier 404 error by using a valid model (`llama-3.3-70b`). (`token-classifier.mjs`)
- [x] **(Web-CLI Bug Fix)** Add validation and debugging to `ResearchPath.processQuery` to prevent/diagnose "Invalid query: must be a string" error. (`research.path.mjs`)
- [x] **(Web-CLI Bug Fix)** Fix `[processQuery] Invalid queryObj received` error by standardizing query object structure in `generateQueries` fallback. (`features/ai/research.providers.mjs`)

### Medium Priority / Features
- [ ] Implement `--memory` flag persistence/handling in WebSocket chat (`handleChatMessage`).
- [ ] Implement `/memory stats` command functionality within WebSocket chat.
- [ ] Implement `/exitmemory` command functionality within WebSocket chat.
- [ ] Refine password handling: Avoid repeated prompting if password is valid and cached in the session.
- [ ] Add more robust argument parsing for commands within chat mode (`handleChatMessage`).
- [ ] Implement `executeMemory` command fully.
- [ ] Add GitHub integration status to `/diagnose`.
- [ ] Improve error messages and user feedback in Web-CLI.
- [ ] Implement remaining chat commands (`/memory stats`, `/research` within chat).
- [ ] Refine error handling and reporting across all commands.
- [ ] Implement robust session management (e.g., timeouts, cleanup). (Partially done with `cleanupInactiveSessions`)
- [ ] Add more comprehensive tests (unit, integration).
- [ ] Improve UI/UX in `terminal.js` (e.g., better progress indicators, command suggestions).
- [ ] Secure HTTP endpoints if they are intended for use.
- [ ] Review and potentially refactor `singlePrompt` in `research.cli.mjs` if `wsPrompt` covers all needs.
- [ ] Implement password confirmation for sensitive admin actions (e.g., user deletion) via `wsPrompt`.
- [ ] Ensure `exitMemory` command correctly finalizes and potentially stores memory.

### Low Priority / Refinements
- [ ] Centralize configuration (API endpoints, timeouts, directories).
- [ ] Add unit/integration tests for commands and WebSocket handling.
- [ ] Refine `wsPrompt` logic and potential race conditions.
- [ ] Improve logging clarity and consistency.
- [ ] Review session timeout and cleanup logic (`cleanupInactiveSessions`).
- [ ] Secure the HTTP POST endpoint (`/api/research`).
- [ ] Add input validation for all commands.
- [ ] Refactor `research.providers.mjs` to accept an `LLMClient` instance instead of creating a new one each time.

### Research & Design
- [ ] Design persistent memory storage beyond session scope (e.g., link to user).
- [ ] Explore streaming responses for LLM calls in chat/research.
- [ ] Define clear roles and permissions beyond admin/client if needed.
