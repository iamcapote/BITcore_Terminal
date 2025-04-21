## Current Gaps & Areas for Improvement

1.  **API Key Management:**
    *   **Propagation:** API keys fetched using user credentials are not consistently passed down through the `ResearchEngine` to the actual API providers (like `BraveSearchProvider`). This leads to errors like "Missing BRAVE_API_KEY". (FIXED for WebSocket /research)
    *   **Error Handling:** Need clearer error messages if keys are missing or invalid during research/chat initiation.
    *   **Security:** Ensure keys are never logged or exposed unintentionally.

2.  **WebSocket State Management:**
    *   **Input Disabling:** While `enableClientInput` and `disableClientInput` exist, the logic determining *when* to call them needs careful review, especially around asynchronous operations (commands, prompts, LLM calls) and error conditions. Input sometimes gets stuck disabled.
    *   **Error Recovery:** If an error occurs mid-command, ensure the client state (input enabled/disabled, mode) is reset correctly.
    *   **Concurrency:** Potential race conditions if multiple messages arrive while a long command is processing (though input disabling mitigates this).

3.  **Research Workflow:**
    *   **Progress Reporting:** The `onProgress` callback in `research.controller.mjs` isn't wired up correctly for WebSocket communication. Need a way to send progress updates (`{ type: 'progress', ... }`) back to the client during research. (Partially addressed by adding handler to engine config).
    *   **Chat Integration (`/research` in chat):** The `startResearchFromChat` function needs proper implementation to instantiate `ResearchEngine` with keys and manage the flow, sending results back into the chat context or as a separate report.
    *   **Error Handling:** Errors within `ResearchPath` or `ResearchEngine` need to be reliably propagated back to the WebSocket client with appropriate messages and state changes.

4.  **Chat & Memory:**
    *   **LLM Calls:** The LLM call in `handleChatMessage` needs the Venice API key, requiring password handling similar to `/research`.
    *   **Memory Implementation:** `MemoryManager` exists but `exitMemory` and memory retrieval logic are placeholders or incomplete.
    *   **Context Management:** Limiting chat history (`maxHistoryLength`) is basic; more sophisticated context window management might be needed.

5.  **Authentication & Authorization:**
    *   **Session Management:** WebSocket sessions store user state, but CLI relies on `userManager.currentUser` and a session file. Ensure consistency and security, especially preventing privilege escalation.
    *   **Permissions:** Command authorization relies on role checks (`session.role`, `options.currentUser.role`). Review if this is sufficient for all commands.
    *   **Admin Permissions:** The `/users` command in the Web-CLI was incorrectly checking permissions. (FIXED by passing `requestingUser` correctly)
    *   **User Limits:** Limits were being applied to all users by default. Authenticated users should not have default limits imposed by the system itself, only the public user should. (FIXED by adjusting `userManager` and `status` command)

6.  **WebSocket Input State:**
    *   **Input Disabling:** Input disabling/enabling logic needs careful review to ensure it's consistently applied, especially around prompts and errors. (Ongoing Refinement)
    *   **Password Prompts:** Server-side password prompts (`wsPrompt`) need robust handling for various commands (`keys set/test`, `password-change`, `chat`, `research`, potentially `users delete`). (Partially Implemented, needs review for all cases)

7.  **Command Consistency:** Ensure command behavior and argument parsing are consistent between CLI and Web-CLI where applicable.

8.  **Error Handling:** Improve user-facing error messages for clarity.

9.  **Session Management:** WebSocket session handling (creation, cleanup, state updates) needs thorough testing.

10.  **Code Structure & Maintainability:**
    *   **Command Handling:** `handleCommandMessage` is becoming large. Consider breaking down command logic further.
    *   **Error Handling:** Centralize or standardize error reporting, especially for WebSocket communication (`wsErrorHelper`).
    *   **Configuration:** How API keys and other settings are managed (env vars vs. user profiles) needs clarity.

11.  **Testing:** Lack of automated tests makes refactoring risky and bugs harder to catch.
