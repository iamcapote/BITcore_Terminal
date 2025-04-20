prompt:

#file:README.md #file:gaps.md #file:research.md #file:venice.md #file:todo.md #file:tokenclassifier.md #file:chat.md #file:current_app_folder_file_tree.md #folder:app 


use the #file:README.md and #file:current_app_folder_file_tree.md for application context found in the #folder:app . Once you have this context proceed to #file:gaps.md and #file:todo.md to implement the next stages of development starting with the easiest fixes. Once you have completed tasks you can move them into #file:completed.md but dont delete or omit anything as we want a full trail of all tasks.


our current web-cli app is not working and behaving properly search high and low in the #codebase to bring our app up to speed. check the #terminalLastCommand #terminalSelection #codebase to know how the app is behaving in console-cli and or web-cli depending on if its `npm start` for the web-cli or `npm start cli` for the console-cli.

you are a well respected and excellent developer with decades of experience shipping full live products that bring in thousands of users and a lot of revenue. if you modify any file make sure you understand its contents and context first and you arent deleting anything important this is a very serious app and it is live.



(REITERATE TO CONTINUE FIX OPTIMIZE IMPLEMENT)

---



# Ideal vs. Actual Platform Process Charts & Gap Analysis

This document compares the planned application behavior (aiming for strict CLI parity in the Web-CLI) with the actual implementation found in the codebase (`/workspaces/MCP/app`), reflecting recent refactoring efforts.

## 1. Global Command Lifecycle (Console-CLI & Web-CLI)

*   **Planned:** Console and Web-CLI interfaces behave identically. Web-CLI simply pipes input/output via WebSockets with no client-side GUI logic influencing commands.
*   **Actual (Post-Refactor v6):**
    *   Backend command parsing (`commands/index.mjs`) and routing logic is shared.
    *   **CLI Mode:** `start.mjs` now correctly sets the `logHandler` for the `outputManager`, resolving the `this.logHandler is not a function` error. Input processing uses `readline` and an `isProcessing` flag to prevent overlap.
    *   **Web-CLI Mode:** Input (`public/terminal.js`) is processed client-side (`handleInput`) based on `this.mode`. Commands starting with `/` go to `command-processor.js`. `command-processor.js` now correctly identifies if a password is provided as an argument (e.g., `/login user pass`) and avoids unnecessary client-side prompts. If a prompt *is* needed client-side (e.g., `/login user`), it uses `terminal.promptForPassword`. The command payload (potentially including the password) is sent to the server. Server (`routes.mjs`) handles incoming messages (`handleCommandMessage`, `handleInputMessage`, `handleChatMessage`). `handleCommandMessage` checks if a password is required *server-side* (e.g., for key decryption) and uses `wsPrompt` if the password isn't available (from payload or session cache). `handleInputMessage` resolves the server-side `wsPrompt`. Input enabling/disabling is managed by server responses (`keepDisabled` flag in `output`/`error` messages) and specific client/server handlers.
*   **Gap (Post-Refactor v6):**
    1.  **Input Locking (Web-CLI):** **IMPROVED FURTHER.** Logic now clearly distinguishes client-side vs. server-side prompts. Server handlers (`handleCommandMessage`, `handleChatMessage`, `handleInputMessage`) explicitly manage the `inputShouldBeEnabled` state returned to the main message loop, which then sends a final message to the client if needed. `wsErrorHelper` and prompt timeouts/cancellations also manage input state. Needs testing under various conditions.
    2.  **Input Duplication (Web-CLI):** Still noted as a potential issue in `todo.md`. `lastInputHandledTime` check exists. The fix for the login prompt issue might mitigate some scenarios. Further investigation needed during testing.
*   **Fix:** Test Web-CLI flow thoroughly, focusing on login (with/without password arg), commands requiring server-side prompts (keys, chat, research), prompt handling (cancel/timeout), and input state.

*   **Flowchart Update (Post-Refactor v6):** (Reflects refined client/server prompt logic)

```mermaid
flowchart TD
    %% ───────── ENTRY ─────────
    A0([App boots<br/>• Console-CLI<br/>• Web-CLI]) --> A1{Mode?}

    A1 -- Console --> ACli0[Setup readline, outputManager.setLogHandler] --> ACli1[Prompt awaits user command]
    A1 -- Web --> AWeb0[Setup Express, WSS, outputManager.setLogHandler(broadcast)] --> AWeb1[Client connects, terminal.js awaits command]

    %% Console Input Processing
    ACli1 -- User Input --> BCli0{Input Line & !isProcessing?}
    BCli0 -- No --> ACli1
    BCli0 -- Yes --> BCli1[Set isProcessing=true] --> BCli2[Parse Command (start.mjs)]
    BCli2 --> BCli3{Command Exists?}
    BCli3 -- No --> BCli4[Output Error] --> BCli99[Reset isProcessing=false, Prompt] --> ACli1
    BCli3 -- Yes --> BCli5[Prepare CLI Options (output, error, prompt fns)] --> BCli6[Execute Command Fn (await)]
    BCli6 -- Success --> BCli99
    BCli6 -- Error --> BCli7[Handle CLI Error] --> BCli99


    %% Web Input Processing (Client Side - terminal.js)
    AWeb1 -- User Input --> BWeb0[handleInput] --> BWeb1{Pending Client Prompt? (pwd/generic)}
    BWeb1 -- Yes --> BWeb2[Resolve Client Promise] --> BWeb3[Disable Input, Send 'input' to Server] --> Srv([Server Receives])
    BWeb1 -- No --> BWeb4{Current Mode?}

    BWeb4 -- "'chat'" --> BWeb5[Send Chat Message (webcomm.sendChatMessage)] --> Srv
    BWeb4 -- "'research'" --> BWeb6[Send Input Message (webcomm.sendInput)] --> Srv %% Might not be used if research is command-driven
    BWeb4 -- "'command'" --> BWeb7{Starts with / ?}

    BWeb7 -- No --> BWeb8[[Error: Must start with /<br/>(or empty input)]] --> AWeb1
    BWeb7 -- Yes --> BWeb9[Command Processor (command-processor.js)]
    BWeb9 --> BWeb10{Client Action Needed? (e.g., pwd for /login user)}
    BWeb10 -- Yes --> BWeb11[terminal.promptForPassword()] --> BWeb12[Await Password]
    BWeb10 -- No --> BWeb13[Prepare Command Payload (may include pwd from args)]

    BWeb12 -- Password Entered --> BWeb13[Add Password to Payload]
    BWeb12 -- Cancel/Timeout --> AWeb1 %% terminal.js handles reset
    BWeb13 --> BWeb14[Send Command Payload (webcomm.sendCommand)] --> Srv

    %% Backend Processing (routes.mjs handleWebSocketConnection)
    Srv --> C0{Message Type?}
    C0 -- "'command'" --> C1[handleCommandMessage] --> C2{Server Prompt Needed? (e.g., keys)}
    C0 -- "'input'" --> C3[handleInputMessage] --> C4[Resolve Server Prompt (wsPrompt resolves)] --> R0 %% Continues command execution
    C0 -- "'chat-message'" --> C5[handleChatMessage] --> C6{Server Prompt Needed? (e.g., keys)}

    C2 -- Yes --> C1a[wsPrompt(client)] --> AWeb1 %% Server waits for 'input' msg
    C2 -- No --> C1b[Route command (commands/index.mjs)] --> D0{Auth/Cmd OK?}

    C6 -- Yes --> C5a[wsPrompt(client)] --> AWeb1 %% Server waits for 'input' msg
    C6 -- No --> C5b[Process chat logic/LLM/In-Chat Cmds] --> R0

    D0 -- "No" ------------------> E0[[Send Error to Client<br/>(wsErrorHelper ensures input enabled)]] --> AWeb1
    D0 -- "Yes" -----------------> D1[Execute Command Fn]

    %% Backend Command Execution & Response
    D1 --> R0{Command Result/Action}
    R0 -- Output/Error --> E1[Send 'output'/'error' to Client<br/>(Server decides keepDisabled)] --> AWeb1
    R0 -- Mode Change --> E2[Send 'mode_change'/'chat-ready'/'chat-exit'/'login_success'/'logout_success' to Client<br/>(Server decides keepDisabled)] --> AWeb1
    R0 -- Research Start/Progress --> E4[Send 'research_start'/'progress' to Client (keepDisabled=true)] --> AWeb1
    R0 -- Research Complete --> E7[Send 'research_complete' to Client (keepDisabled=false)] --> AWeb1
    R0 -- Memory Commit --> E6[Send 'memory_commit' to Client (keepDisabled=false)] --> AWeb1
    R0 -- Chat Response --> E5[Send 'chat-response' to Client (keepDisabled=false)] --> AWeb1
    R0 -- Command Finished (No specific result) --> E99[Server (handleCommandMessage/handleChatMessage) sends final msg<br/>to enable/disable input based on logic] --> AWeb1

    %% Client Update Loop (Web-CLI)
    subgraph "Client Updates (terminal.js)"
        E1 --> U1[Display Output/Error, Enable/Disable Input based on keepDisabled]
        E2 --> U2[Set Mode, Update Prompt, Update User Status (if login/logout), Enable/Disable Input based on keepDisabled]
        %% E3 (Server Prompt) is handled by server waiting for input
        E4 --> U4[Show Progress/Start Msg, Disable Input]
        E5 --> U5[Display Chat Response, Enable Input (if mode='chat')]
        E6 --> U6[Display Memory Commit Info, Enable Input]
        E7 --> U7[Display Research Complete, Set Mode='command', Enable Input]
        E99 --> U99[Enable/Disable Input based on final server message]
    end
    U1 & U2 & U4 & U5 & U6 & U7 & U99 --> AWeb1
```

## 2. Authentication & Session Handling

*   **Planned:** Robust session management, automatic revert to public mode on disconnect/expiry.
*   **Actual (Post-Refactor v6):** Backend (`user-manager.mjs`, `routes.mjs`) handles login, password verification, session creation/tracking (`activeChatSessions`, `wsSessionMap`). Frontend (`command-processor.js`, `terminal.js`) handles client-side password prompts via promise. Server-side prompts (`wsPrompt`) handle cases where the server needs a password not provided initially. Disconnect handling in `terminal.js` (`handleConnection`) and `webcomm.js` (`handleClose`) resets mode, updates status, enables input, and rejects client-side prompts. Server-side session cleanup (`routes.mjs` `ws.on('close')`, `cleanupInactiveSessions`) removes session data and rejects pending server-side prompts. Password caching added to server session on successful login/key ops/prompts, cleared on logout/chat exit.
*   **Gap (Post-Refactor v6):** Session reset on disconnect/reconnect seems robustly implemented. Needs testing. Password caching in session needs security review (remains a point).
*   **Fix:** Test disconnect/reconnect flow thoroughly. Review security implications of caching password in server session state.

*   **Flowchart Update:** (Client/Server prompt distinction added)

```mermaid
flowchart TD
    %% ───────── AUTH PIPE (Server Side) ─────────
    L0[/login <user> [password]] --> L0a{Password in Payload/Args?}
    L0a -- No --> L0b[Server needs password --> wsPrompt(client)] --> L0c[Await 'input' msg] --> L2[Receive password from client (via 'input')]
    L0a -- Yes --> L2a[Receive password from client (via 'command' payload)]

    L2 & L2a --> L3{Password OK? (argon2.verify)}

    L3 -- "No"  --> L4[[Send Auth Error to Client]]
    L3 -- "Yes" --> L5[Update Session Data<br/>(routes.mjs activeChatSessions)<br/>Cache password in session]
    L5 --> L6[Load/Decrypt API keys if needed<br/>(user-manager.mjs)]
    L6 --> L7[Send Auth Success ('login_success') to Client]
    L7 --> L8[[Return to caller (command router)]]

    %% ───────── CLIENT SIDE (Web-CLI) ─────────
    subgraph "Client Side (Web-CLI)"
        direction LR
        CL0[User types /login user [pass]] --> CL1[command-processor.js]
        CL1 --> CL1a{Password provided in args?}
        CL1a -- No --> CL2[terminal.js promptForPassword()] --> CL3[Await Password] --> CL4[command-processor sends command payload w/ pwd]
        CL1a -- Yes --> CL4a[command-processor sends command payload w/ pwd from args]

        CL4 & CL4a --> SRV([Server Auth])
        SRV -- Auth Success ('login_success') --> CL5[webcomm.js receives msg] --> CL6[terminal.js handleLoginSuccess updates UI (user status)]
        SRV -- Auth Fail --> CL7[terminal.js displays error]
        SRV -- Server Prompt Needed --> CL8[terminal.js handlePrompt calls promptForPassword] --> CL9[User enters pwd] --> CL10[terminal.js sends 'input' msg] --> SRV
    end

    %% ───────── SESSION WATCHER (Client - Web-CLI) ─────────
    subgraph "Session Watcher (Client - Web-CLI)"
        W0[WebSocket close/error] --> W1[webcomm.js handleClose()]
        W1 --> W2[terminal.js handleConnection(false)]
        W2 --> W3[Set mode='command', Enable Input,<br/>Print "Disconnected...", Update User Status ('public'), Reject Client Prompt]
    end

    %% -------- SERVER SIDE CLEANUP --------
    subgraph "Server Side Cleanup"
        SW0[WebSocket 'close' event] --> SW1[routes.mjs ws.on('close')]
        SW1 --> SW2[Find session via wsSessionMap]
        SW2 --> SW3[Cleanup session:<br/>• Reject pending server prompt<br/>• Nullify memory manager<br/>• Delete from activeChatSessions<br/>• Delete from wsSessionMap]

        SI0[Inactivity Timer] --> SI1[cleanupInactiveSessions] --> SI2[Find inactive sessions] --> SI3[Cleanup session (like SW3)]
    end
```

## 3. Key Management Mini-Flow

*   **Planned:** Standard CLI commands (`/keys set/check/test`), password protection.
*   **Actual (Post-Refactor v6):** Backend logic (`commands/keys.cli.mjs`, `user-manager.mjs`) is correct. Web-CLI uses `command-processor.js` to check if a client-side prompt is needed (only if password not provided via flag). If not prompted client-side, the command is sent. Server-side (`handleCommandMessage`) then checks if a password is required and uses `wsPrompt` if necessary. `keys.cli.mjs` avoids interactive prompts when `isWebSocket` is true.
*   **Gap (Post-Refactor v6):** Minimal. Seems correct.
*   **Fix:** N/A.

*   **Flowchart Update:** (Reflects server-side prompt possibility)

```mermaid
flowchart TD
    %% ───────── KEYS (Server Side) ─────────
    K0[/keys set|check|test] --> K1[Require Auth Session]
    K1 -- Fail --> K99[[Send Auth Error]]
    K1 -- OK --> K1a{Action Requires Password?}
    K1a -- Yes --> K1b{Password in Payload/Cache?}
    K1a -- No --> K4[Perform action:<br/>• check → list masked]

    K1b -- No --> K1c[Server needs password --> wsPrompt(client)] --> K1d[Await 'input' msg] --> K2[Receive password from client (via 'input')]
    K1b -- Yes --> K2a[Receive password from client (via payload/cache)]

    K2 & K2a --> K2b{Password OK?}
    K2b -- "No" --> K3[[Send Auth Error to Client]]
    K2b -- "Yes" --> K4a[Perform action:<br/>• set → encrypt & store<br/>• test → decrypt & live call]

    K4 & K4a --> K5[[Emit result lines<br/>to Client ('output')]]

    %% -------- Client Side (Web-CLI) --------
    subgraph "Client Side (Web-CLI)"
      direction LR
      CK0[User types /keys set|test] --> CK1[command-processor.js]
      CK1 --> CK1a{Password provided via flag?}
      CK1a -- No --> CK2[terminal.js promptForPassword()] --> CK3[Await Password] --> CK4[command-processor sends command payload w/ pwd]
      CK1a -- Yes --> CK4a[command-processor sends command payload w/ pwd from flag]

      CK4 & CK4a --> SK([Server Keys])
      SK -- Result/Error --> CK5[terminal.js displays output]
      SK -- Server Prompt Needed --> CK6[terminal.js handlePrompt calls promptForPassword] --> CK7[User enters pwd] --> CK8[terminal.js sends 'input' msg] --> SK
    end
```

## 4. Research Pipeline

*   **Planned:** Flags (`--depth`, `--breadth`, `--classify`), progress streaming. Web-CLI mirrors CLI.
*   **Actual (Post-Refactor v6):** Backend (`research.engine.mjs`, etc.) handles flags and pipeline. Progress streamed (`type: 'progress'`). Web-CLI initiation via `/research` command handled by `command-processor.js` (flags parsed) and `handleCommandMessage` (backend). `handleCommandMessage` checks/prompts for password using `wsPrompt`. Interactive prompts (if `/research` has no query) implemented server-side using `wsPrompt`/`handleInputMessage`. Progress bar updates implemented in `terminal.js`. Token classification prompt added to interactive flow. CLI mode works.
*   **Gap (Post-Refactor v6):** Interactive research flow implemented using `wsPrompt`. Progress rendering client-side implemented. Needs testing.
*   **Fix:** Test interactive research setup (including prompts for query, params, classification, and password) and progress bar display in Web-CLI. Verify CLI mode research works.

*   **Flowchart Update:** (Reflects server-side prompts)

```mermaid
flowchart TD
    P0[/research <flags> <query>] --> P0a{Initiation Method?}
    P0a -- "Web-CLI Interactive (No Query)" --> P0b[Server: handleCommandMessage checks keys, prompts for pwd if needed (wsPrompt)]
    P0a -- "Direct Command (CLI or Web-CLI w/ Query)" --> P0c[Server: handleCommandMessage parses flags/args, checks keys, prompts for pwd if needed (wsPrompt)]

    P0b --> P0d[Server: Prompt for Query (wsPrompt)] --> P0e[Server: Prompt for Breadth (wsPrompt)] --> P0f[Server: Prompt for Depth (wsPrompt)] --> P0g[Server: Prompt for Classification (wsPrompt)] --> P1[Proceed with gathered params]
    P0c --> P1

    P1 -->|invalid keys/pwd| P99[[Abort → Send Error]]

    P1 --> P2{Classification Enabled? (Prompt/Flag)}
    P2 -- "Yes" --> P2a[callVeniceWithTokenClassifier ➜ metadata]
    P2 -- "No"  --> P3

    P2a --> P3[Generate search queries (LLM)]
    P3 --> P4[Dispatch to Brave Search (rate-limited)]
    P4 --> P5[Collect & deduplicate results]
    P5 --> P6[LLM summarisation]
    P6 --> P7[Stream progress (WebSocket 'progress')]
    P7 --> P8[Save results & return report ('output')]
    P8 --> P9[Send 'research_complete' to Client] --> P99

    subgraph Client Progress Display
        P7 --> CP1[terminal.js handleProgress] --> CP2[Update Progress Bar UI]
    end
```

## 5. Chat + Memory Lifecycle

*   **Planned:** `/chat [--memory] [--depth=n]`, `/exit`, `/exitmemory`. GitHub persistence. Seamless integration.
*   **Actual (Post-Refactor v6):** Backend (`routes.mjs` `handleChatMessage`, `MemoryManager`, `chat.cli.mjs`) handles modes, memory logic, LLM calls, research integration (`startResearchFromChat`), and GitHub commit. Frontend (`terminal.js`) handles mode switching via server messages, sending/receiving messages (`webcomm.sendChatMessage`). Flags (`--memory`, `--depth`) parsed server-side. `/chat` command triggers logic in `handleCommandMessage` which requires password via `wsPrompt` or payload, initializes session state, and sends `chat-ready`. `/research`, `/exitmemory`, `/memory stats` handled within `handleChatMessage`. Regular chat messages also check/prompt for password via `wsPrompt`. CLI mode works.
*   **Gap (Post-Refactor v6):** Seems robustly implemented with password prompts integrated. Needs testing in both CLI and Web-CLI.
*   **Fix:** Test chat initiation, memory flags, in-chat commands, memory finalization, research integration, and password prompts within chat (CLI and Web-CLI).

*   **Flowchart Update:** (Reflects server-side prompts)

```mermaid
flowchart TD
    %% ───────── ENTER CHAT ─────────
    S0[/chat --memory --depth N] --> S0a[Client: command-processor checks args, may prompt client-side if needed] --> S0b[Client: Sends 'command' payload w/ pwd if available]
    S0b --> S1[Server: handleCommandMessage calls logic, prompts server-side via wsPrompt if pwd needed & not available]
    S1 -- Success --> S1b[Server: Send 'chat-ready' to Client]
    S1 -- Fail --> S1c[[Server: Send Error to Client]] --> X0[[Return to main prompt]]
    S1b --> S2[Client: terminal.js sets mode='chat', updates prompt]
    S2 --> LOOP{User input (Client)}

    %% ---- MESSAGE HANDLING ----
    LOOP -- Text Input --> S3[Client: terminal.js sends 'chat-message'] --> S4[Server: handleChatMessage receives message]
    S4 --> S4a{Special Command? (/exit, /research, /exitmemory, /memory stats)}
    S4a -- Yes --> S4b[Handle In-Chat Command] --> LOOP | X0
    S4a -- No --> S4c{Password/Key Check Needed & Pwd not cached?}
    S4c -- Yes --> S4d[Server: Prompt for Password (wsPrompt)] --> S4e{Password OK?}
    S4c -- No --> S5{Memory enabled?}

    S4e -- No --> S13[[Server: Send Error to Client]] --> LOOP
    S4e -- Yes --> S5

    S5 -- "No" --> S6[Server: Add msg to history (temp)] --> S7[Server: Call LLMClient.completeChat]
    S5 -- "Yes" --> S8[Server: memoryManager.storeMemory(userMsg)] --> S9[Server: memoryManager.retrieveRelevantMemories]
    S9 --> S10[Server: Add msg + retrieved memories to history] --> S7

    S7 --> S11{LLM Response OK?}
    S11 -- Yes --> S12[Server: Process response]
    S11 -- No --> S13

    S12 --> S14{Memory enabled?}
    S14 -- Yes --> S15[Server: memoryManager.storeMemory(assistantMsg)]
    S14 -- No --> S16[Server: Send 'chat-response' to Client]
    S15 --> S16

    S16 --> S17[Client: terminal.js displays response, enables input] --> LOOP

    %% ---- INLINE COMMANDS (Handled in S4b) ----
    S4b -- "/research <query>" --> SR[Server: startResearchFromChat (may prompt for pwd via wsPrompt)] --> SRP[Research Pipeline] --> S16
    S4b -- "/exitmemory" --> SEM[Server: exitMemory] --> SEMC{Commit OK?}
    SEMC -- Yes --> SEMS[Server: Send 'memory_commit' w/ SHA] --> LOOP
    SEMC -- No --> SEMN[Server: Send 'output' (Finalized)] --> LOOP
    S4b -- "/memory stats" --> SMS[Server: commands['memory']({action:'stats'})] --> SMSO[Send 'output'] --> LOOP
    S4b -- "/exit" --> S40[Server: Clean up session] --> S41[Server: Send 'chat-exit' to Client] --> S42[Client: terminal.js sets mode='command'] --> X0

```

## 6. Memory Promotion & GitHub Commit

*   **Planned:** Automatic promotion, scoring, commit to GitHub, return SHA.
*   **Actual (Post-Refactor v6):** Backend (`MemoryManager`, `github-memory.integration.mjs`) handles summarization and commit logic, triggered by `/exitmemory` (implemented in `handleChatMessage`). Commit SHA returned and sent to client via `memory_commit` event.
*   **Gap (Post-Refactor v6):** Feedback mechanism implemented. Needs testing.
*   **Fix:** Test `/exitmemory` command and verify `memory_commit` event on client.

*   **Flowchart Update:** (No significant changes needed)

```mermaid
flowchart LR
    %% INGEST (Server Side)
    A[Raw snippet<br/>(chat or research)] --> B[Pre‑validation (MemoryManager)]

    %% FILTER
    B --> C{Relevant & high‑quality?}
    C -- "No" --> Z1[[Discard]]
    C -- "Yes" --> D[Short‑term layer<br/>(RAM - MemoryManager)]

    %% PROMOTION (Triggered by /exitmemory)
    D --> E[Meta‑analysis<br/>(Venice LLM via MemoryManager)]
    E --> F{Promote decision}
    F -- "Summarise" --> G[Create summary block]
    F -- "Keep raw"  --> H[Retain raw block]

    %% LONG‑TERM
    G & H --> I[Append to<br/>long‑term registry (GitHubMemoryIntegration)]
    I --> J[git commit & push<br/>→ GitHub]
    J --> K[Commit SHA available server-side]
    K --> L{Send feedback?}
    L -- No --> M([End - Should not happen if commit OK])
    L -- Yes --> N[[Send 'memory_commit' event<br/>with SHA to Client]]
```

---

## Summary of Gaps & Required Actions (Post-Refactor v6)

1.  **Testing (Web-CLI):** Critically test the refactored Web-CLI flow (modes, client/server prompts, session reset, input locking/duplication, interactive research, in-chat commands, feedback, password handling). **CRITICAL**
2.  **Testing (CLI):** Verify `/chat` and `/research` commands work correctly.
3.  **Code Audit:** Review security implications of caching password in server session state.
4.  **Documentation:** Update `README.md` and `gaps.md` to reflect fixes and remaining gaps/todos.
5.  **Input Duplication (Web-CLI):** Investigate further during testing if the issue persists.

# Identified Gaps

-   **Robust Error Handling:** Current error handling is basic. Need specific handling for API errors (rate limits, invalid keys), network issues, file system errors, and unexpected states. Errors don't always provide enough context.
-   **State Management (Client & Server):** While improved, managing state (e.g., `isProcessingCommand`, `currentChatHandler`, `pendingPromptResolve`, WebSocket session data) across async operations needs careful review to prevent race conditions or inconsistencies, especially with concurrent requests or abrupt disconnections.
-   **Testing:** Lack of automated tests makes refactoring and adding features risky. Unit tests for utilities, command parsers, auth logic, and integration tests for command flows are needed.
-   **Concurrency Handling (CLI):** The single `isProcessingCommand` flag in the CLI might be too coarse. Long-running commands could block subsequent inputs unnecessarily. Need a more refined approach or clear feedback.
-   **Configuration Management:** Key settings (timeouts, limits, paths) are hardcoded. A centralized configuration mechanism is missing.
-   **Security Hardening:** Current focus is functionality. A dedicated security review is needed (input validation, dependency checks, secure defaults).
-   **Documentation:** Inline code comments are present, but higher-level documentation on architecture, command APIs, and setup is sparse.
-   **Feature Completeness:** Features like Memory Management and full in-chat command support are incomplete.
- **Error Handling:** More specific error types and handling across modules.
- **Input Validation:** Stricter validation for command arguments and options.
- **Resource Management:** Ensure resources like readline interfaces are always closed. (Partially addressed)
- **Session Management:** Robust handling of session expiry and validation, especially concerning cached data like passwords. (Improved)
- **Client-Side State:** Potential race conditions or state inconsistencies in `terminal.js` related to prompts and input disabling. (Improved logging and handling)
- **API Key Security:** Review encryption/decryption flow, especially around password changes.
- **WebComm Layer:** The `webcomm.js` file is missing, which is crucial for debugging client-server communication issues.
- **Missing WebSocket Setup File:** The application startup script (`start.mjs`) was trying to import from `app/config/websocket.mjs`, which didn't exist, causing a crash. (Addressed)
- **Centralized WebSocket Setup:** WebSocket server initialization was implicitly tied to the research feature; it needed a dedicated configuration. (Addressed by creating `config/websocket.mjs`)
- **Robust Error Handling:** Current error handling is basic, especially for WebSocket communication and command execution. Needs improvement for stability.
- **Client/Server State Sync:** Input enabling/disabling logic between client (`terminal.js`) and server (`routes.mjs`) is complex and potentially fragile. Needs simplification.
- **Security:** HTTP endpoint lacks security. WebSocket authentication/session management is rudimentary.
- **Testing Framework:** No automated tests are present.
- **Code Clarity/Comments:** Some areas lack sufficient comments explaining the logic.
- **Security:** No robust session management for Web-CLI (relies on in-memory `activeChatSessions`). No CSRF protection for potential future form submissions. Rate limiting is only on login, not other sensitive actions.
- **Error Handling:** While improved, some areas might still benefit from more specific error types and user feedback. Unhandled promise rejections might still occur.
- **Testing:** Lack of automated tests (unit, integration).
- **Scalability:** Current in-memory session storage won't scale beyond a single process. File-based user storage is not ideal for concurrent access or large numbers of users.
- **Modularity:** Command execution logic is somewhat duplicated between CLI (`start.mjs`) and WebSocket (`routes.mjs`).
- **Configuration:** Hardcoded values (timeouts, limits) could be moved to a config file.
- **Web-CLI UX:** Basic terminal interface; could be enhanced significantly.
- **Documentation:** Inline comments exist, but comprehensive developer/user documentation is missing.
- **Security:** HTTP endpoints lack robust authentication/authorization. WebSocket security relies on session state; consider token-based auth for scalability. Password handling (caching in session) needs careful review.
- **Error Handling:** While improved, error handling could be more granular, providing clearer user feedback and logging more context server-side. Specific error types could be used.
- **Testing:** Lack of comprehensive automated tests makes refactoring risky.
- **Scalability:** Current session management (in-memory Map) won't scale to multiple server instances. Requires external session store (e.g., Redis). `userManager` loading all users into memory might not scale.
- **Configuration:** Hardcoded paths and constants should move to a central configuration system.
- **CLI vs Web-CLI Parity:** Some features/prompts might behave differently between console CLI and Web-CLI. Need consistent handling (e.g., password prompts).
- **Resource Management:** Ensure file handles, network connections, and child processes are properly closed/managed, especially on errors.
- **Memory Management (Chat):** The `exitMemory` flow needs full implementation for storing/summarizing chat memories.
- **API Key Handling:** The current `search.providers.mjs` only reads keys from `process.env`. It needs to be refactored to accept user-specific keys retrieved via `userManager.getApiKey`. This involves modifying the provider constructors and the code that instantiates/uses them (likely in `research.engine.mjs` or command handlers).
- **Missing UserManager Methods:** `checkApiKeys` and `testApiKeys` are called but not defined.
- **Command Logic:** `/keys stat` alias isn't working correctly.
- **Password Propagation:** Password seems missing or incorrect when `/diagnose` calls `checkApi`.
- **Websocket Input State:** Potential race conditions or incorrect state management for enabling/disabling client input, especially around prompts and asynchronous operations. (Seems improved but needs monitoring).
- **Error Handling:** Some errors might not be reported gracefully to the client, or might leave the client input disabled.
- **CLI Prompts:** `singlePrompt` exists but might conflict if multiple async operations try to prompt simultaneously (though current usage seems okay).

# Gaps and Areas for Improvement

This document outlines identified gaps, areas needing refinement, and potential future enhancements for the MCP project.

## Current Gaps

1.  **Web-CLI Stability:**
    *   Connection drops observed (`Abnormal closure`). Needs investigation into WebSocket server stability, client-side reconnection logic (`webcomm.js`), and potential unhandled errors during command processing (`routes.mjs`).
    *   Input state management (`enableClientInput`/`disableClientInput`) needs thorough review, especially around asynchronous operations, prompts, and error handling to prevent the UI from becoming unresponsive.
2.  **Error Handling Consistency:** While `cli-error-handler.mjs` improves CLI errors, WebSocket error reporting (`wsErrorHelper`) and error handling within command functions need standardization to provide consistent feedback and state management (e.g., always re-enabling input unless explicitly requested otherwise).
3.  **Password/Key Handling Robustness:**
    *   Ensure API key decryption errors consistently clear cached passwords in the session (`routes.mjs`, `research.cli.mjs`, etc.).
    *   Verify password prompts (`wsPrompt`) are triggered reliably *only* when necessary (e.g., key exists but password isn't cached/provided).
    *   Ensure decrypted keys are correctly passed down through the call stack (e.g., `handleCommandMessage` -> `executeResearch` -> `ResearchEngine` -> `BraveSearchProvider`).
4.  **Chat Feature Completeness (Web-CLI):**
    *   `/research` within chat: Needs verification that `startResearchFromChat` is correctly called with context, memories, and necessary credentials (password/keys).
    *   Memory integration (`/memory stats`, `/exitmemory`, automatic retrieval/storage) needs full implementation and testing within `handleChatMessage`.
    *   Memory commit feedback (`memory_commit` event) needs implementation in the memory finalization process.
5.  **Testing Coverage:** Lack of comprehensive unit and integration tests, especially for WebSocket interactions, command execution flows, and session management. The `system-validation.mjs` script is a good start but needs expansion.
6.  **Configuration Management:** Hardcoded values (timeouts, API URLs, default models, file paths) should be moved to a central configuration system (e.g., `.env` file, config module).
7.  **Security:**
    *   HTTP POST endpoint (`/api/research`) is disabled/unsecured. Needs proper implementation with authentication/authorization or removal.
    *   Rate limiting for WebSocket commands and connections is missing.
    *   Session management relies on in-memory storage; consider more persistent/secure options if needed beyond simple session timeouts.

## Areas for Refinement

1.  **Code Duplication:** Explore opportunities to reduce duplication between CLI (`start.mjs`, `cli-runner.mjs`) and Web-CLI (`routes.mjs`) command handling logic.
2.  **Argument Parsing:** Standardize argument parsing further, potentially using a shared library or utility for both CLI and WebSocket commands.
3.  **Logging:** Improve logging clarity, consistency, and potentially add configurable log levels for easier debugging.
4.  **Prompting Logic:** Consolidate or standardize prompting logic between CLI (`singlePrompt`) and Web-CLI (`wsPrompt`).
5.  **User Experience (Web-CLI):** Improve UI feedback (e.g., clearer status indicators, progress messages, error display), command history, and potentially add command suggestions/autocompletion.
6.  **Session Management:** Refine session timeout logic (`cleanupInactiveSessions`) and ensure all resources (memory managers, pending prompts) are reliably cleaned up.

## Future Enhancements

1.  **Agent Framework:** Explore integrating a formal agent framework (e.g., LangChain.js) for more complex interactions, tool use, and memory management.
2.  **Streaming Responses:** Implement streaming for LLM responses in chat and potentially research summaries for better perceived performance.
3.  **Multi-Modal Support:** Add capabilities for handling image input/output.
4.  **Persistent Memory:** Design and implement persistent memory storage linked to users, beyond the current session/GitHub file approach.
5.  **Advanced Roles/Permissions:** Define and implement more granular roles and permissions if required.
6.  **UI Overhaul:** A more sophisticated web interface beyond the basic terminal simulation.