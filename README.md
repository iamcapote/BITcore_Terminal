# Deep Research Privacy App

The Deep Research Privacy App is a privacy-focused research tool that automates exploring topics in depth. It uses the Brave Search API along with optional token classification from the Venice LLM API. The app supports both CLI and browser-based terminal interfaces, letting you securely perform research, manage accounts, and enhance queries with metadata from external APIs.

![image](https://github.com/user-attachments/assets/5f086aef-2f31-4649-a288-ddedf13f9403)

![image](https://github.com/user-attachments/assets/4b90fc56-e746-4403-916f-b85ab8ef03f3)


---

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [File Structure](#file-structure)
4. [Usage Modes](#usage-modes)
5. [Authentication System](#authentication-system)
6. [Research Pipeline](#research-pipeline)
7. [API Key Management](#api-key-management)
8. [Token Classification Module](#token-classification-module)
9. [Chat and Memory System](#chat-and-memory-system)
10. [Running the App](#running-the-app)
11. [Production Deployment](#production-deployment)
12. [Security Considerations](#security-considerations)
13. [Troubleshooting](#troubleshooting)
14. [Validation & Accuracy Check](#validation--accuracy-check)

---

## Overview
This application automates research using AI-driven querying and summarization. It supports both public use (with limited features) and authenticated users (client or admin) who can store their own encrypted API keys. The app integrates seamlessly with the Venice API for optional token classification, adding metadata to strengthen query context. The implemented chat system enables interactive conversations with memory retention capabilities (`app/infrastructure/memory/memory.manager.mjs`) and seamless transition to deep research.

---

## Features
1. **Dual-Mode Application**
   - Runs in Server Mode or CLI Mode, determined by arguments passed to `app/start.mjs`.
   - Server Mode: Provides a web interface (`public/index.html`) via Express and uses WebSockets (`app/features/research/routes.mjs`) for real-time communication.
   - CLI Mode: Interactive text-based prompts for commands and operations using Node.js `readline` via `app/utils/research.prompt.mjs` and managed by `app/utils/cli-runner.mjs`.

2. **Web-Based Terminal Interface**
   - Real-time output and input via WebSockets, mirroring the Console-CLI experience (`public/terminal.js`, `public/webcomm.js`).
   - Handles commands (`/login`, `/research`, `/chat`, etc.) parsed client-side (`public/command-processor.js`) and sent to the backend via specific message types (`command`, `chat-message`, `input`).
   - Supports interactive prompts initiated by the backend (e.g., for passwords, research parameters, post-research actions) handled by `app/features/research/routes.mjs` (`wsPrompt`) and `public/terminal.js` (`handlePrompt`).
   - Manages different interaction modes ('command', 'chat', 'research', 'prompt') to route user input correctly (`public/terminal.js`). Server dictates mode changes via messages (`mode_change`, `chat-ready`, `prompt`, etc.).
   - **Strict CLI Parity:** GUI elements that modify commands are not present in `public/index.html`. Flags must be typed manually.
   - Input enable/disable state is explicitly managed by the server sending `enable_input` and `disable_input` messages (`app/features/research/routes.mjs`, `public/terminal.js`).

3. **Research Engine**
   - Orchestrated by `app/infrastructure/research/research.engine.mjs` and `app/infrastructure/research/research.path.mjs`.
   - Generates multiple queries (breadth) and follow-ups (depth) using AI (`app/features/ai/research.providers.mjs::generateQueries`).
   - Uses a configurable search provider, defaulting to Brave Search (`app/infrastructure/search/search.providers.mjs`), for retrieving results, with rate limiting (`app/utils/research.rate-limiter.mjs`).
   - Summarizes findings via AI (`app/features/ai/research.providers.mjs::generateSummary`), returning summaries, sources, and learnings.
   - Progress is streamed to the client via WebSocket messages (`type: 'progress'`) sent from `app/infrastructure/research/research.path.mjs` and `app/infrastructure/research/research.engine.mjs`.
   - Generates Markdown content (`research.engine.mjs::generateMarkdownResult`) but does not save it automatically.

4. **Token Classification**
   - Optional module using `app/utils/token-classifier.mjs` to call the Venice API (model and character details likely within `venice.llm-client.mjs` or configuration, not explicitly in `token-classifier.mjs`).
   - Embeds the raw text response returned by Venice into the research query object's `tokenClassification` property.
   - **Integration:**
      - **CLI Mode:** Prompts "Use token classification? (y/n)" during interactive research setup (`app/commands/research.cli.mjs`).
      *   **Web-CLI Mode:**
          *   If starting research interactively (e.g., `/research` without query, handled by `handleCommandMessage` in `routes.mjs`), prompts "Use token classification? [y/n]" via WebSocket (`wsPrompt`).
          *   If typing `/research <query>`, the `--classify` flag must be added manually.
   - If classification fails (API error, network issue, invalid response), it returns `null` and the pipeline continues with the raw query (`app/utils/token-classifier.mjs`).

5. **Authentication & User Management**
   - Roles: Public, Client, Admin (`app/features/auth/user-manager.mjs`).
   - File-based user profiles stored at `~/.mcp/users/<username>.json` (or `MCP_TEST_USER_DIR` env var if set).
   - Session management handled server-side (`app/features/research/routes.mjs` using `activeChatSessions` Map). Client UI updates via `login_success`/`logout_success` messages.
   - Commands: `/login`, `/logout`, `/status`, `/users` (create, list, delete), `/password-change` handled by respective files in `app/commands/`.
   - Login attempts are rate-limited (`app/features/auth/user-manager.mjs::RateLimiter`).

6. **Encrypted API Key Storage**
   - Per-user Brave, Venice, and GitHub keys/config (`app/features/auth/user-manager.mjs`).
   - AES-256-GCM encryption (`app/features/auth/encryption.mjs`) using a key derived from the user's password (`deriveKey`).
   - Keys commands (`/keys set/check/test`) handled by `app/commands/keys.cli.mjs`. Password prompts handled via `wsPrompt` in Web-CLI.
   - GitHub configuration includes token, owner, repo, and branch.

7. **Chat System with Memory**
   - Interactive chat via `/chat` command (supports `--memory=true`, `--depth=short|medium|long` flags) handled by `app/commands/chat.cli.mjs` (backend logic) and `app/features/research/routes.mjs` (`handleCommandMessage` initiating session).
   - Memory managed server-side (`app/infrastructure/memory/memory.manager.mjs`) with configurable depth settings affecting retrieval limits and thresholds.
   - Optional GitHub persistence for *memory* (`app/infrastructure/memory/github-memory.integration.mjs`), separate from research result uploads.
   - Seamless integration with research pipeline via `/research <query>` command within chat (`handleChatMessage` -> `startResearchFromChat` in `app/commands/chat.cli.mjs`).
   - Memory finalization via `/exitmemory` command (triggers `MemoryManager.summarizeAndFinalize` and potentially `GitHubMemoryIntegration.commitMemory`). Sends `memory_commit` event with SHA.
   - Memory status check via `/memory stats` command (use within active memory session, handled by `app/commands/memory.cli.mjs`).
   - `/exitresearch` command uses chat history to generate override queries for a new research task (`app/commands/chat.cli.mjs::executeExitResearch`).

8. **Logging & Error Handling**
   - Uses `app/utils/research.output-manager.mjs` for broadcasting output to console and connected WebSocket clients.
   - CLI error handling via `app/utils/cli-error-handler.mjs`.
   - Rate-limiting (`app/utils/research.rate-limiter.mjs`, `app/features/auth/user-manager.mjs`) and retry logic (e.g., in `app/infrastructure/ai/venice.llm-client.mjs`, `app/infrastructure/search/search.providers.mjs`).
   - WebSocket errors are caught and sent to the client (`wsErrorHelper` in `routes.mjs`).

9. **Diagnostics**
    - `/diagnose [check...]` command (`app/commands/diagnose.cli.mjs`) allows checking API connectivity (Brave, Venice, GitHub), user directory permissions, and storage existence. (Note: Session checks, fixes, and tests might be disabled or limited in the current implementation).

10. **Post-Research Actions**
    - After research completes, the server prompts the user (`wsPrompt` with context `post_research_action` in `routes.mjs`) to choose an action for the generated Markdown content: Display, Download, Upload to GitHub, or Discard.
    - **Display:** Server sends the content back via `output` message.
    - **Download:** Server sends a `download_file` message with filename and content; `public/terminal.js` (`handleDownloadFile`) creates and clicks a download link.
    - **Upload to GitHub:** Server uses `app/utils/github.utils.mjs::uploadToGitHub` (requires user password for token decryption).
    - **Discard:** No further action.

---

## File Structure
```plaintext
app/
  commands/
    # admin.cli.mjs           # Not present in provided structure
    chat.cli.mjs            # Handles /chat, /exitmemory, /exitresearch (backend logic)
    diagnose.cli.mjs        # Handles /diagnose (backend logic)
    index.mjs               # Main command router (`commands` export), argument parser (`parseCommandArgs`), help (`getHelpText`)
    keys.cli.mjs            # Handles /keys set/check/test (backend logic)
    login.cli.mjs           # Handles /login (backend logic)
    logout.cli.mjs          # Handles /logout (backend logic)
    memory.cli.mjs          # Handles /memory stats (backend logic)
    password.cli.mjs        # Handles /password-change (backend logic)
    research.cli.mjs        # Handles /research (backend logic for CLI/Web initiation)
    status.cli.mjs          # Handles /status (backend logic)
    users.cli.mjs           # Handles /users create/list/delete, createAdmin

  features/
    ai/
      research.providers.mjs       # AI providers for query generation, summarization, result processing
    auth/
      encryption.mjs             # AES encryption/decryption, key derivation
      user-manager.mjs           # User/session management, API key encryption/decryption, RateLimiter
    research/
      # research.controller.mjs    # Not present in provided structure
      routes.mjs                 # Express routes & WebSocket handlers (handleWebSocketConnection, wsPrompt, message routing)

  infrastructure/
    ai/
      venice.characters.mjs      # Defines characters for Venice LLM (likely used by llm-client)
      venice.llm-client.mjs      # Venice LLM API client (fetch wrapper)
      venice.models.mjs          # Defines models for Venice LLM (likely used by llm-client)
      venice.response-processor.mjs # Utility to clean LLM responses
    memory/
      github-memory.integration.mjs # GitHub persistence logic for memory
      memory.manager.mjs           # Core memory management (ephemeral/validated stores, retrieval, summarization)
    research/
      research.engine.mjs          # Research execution engine, orchestrates paths, generates markdown
      research.path.mjs            # Single research path logic, recursive querying, progress updates
    search/
      # search.mjs                 # Not present in provided structure
      search.providers.mjs       # Brave Search provider implementation

  public/
    # chat.js                    # Not present in provided structure
    command-processor.js         # Client-side parsing of /commands, triggers prompts for password if needed
    index.html                   # Web terminal UI (input, output, status, help button)
    # research.js                # Not present in provided structure
    terminal.js                  # Core web terminal UI logic (input/output, modes, prompts, connection, event handlers)
    webcomm.js                   # WebSocket communication wrapper (connect, send, registerHandler)

  tests/
    # Various unit and integration tests (specific files listed in context)
    ...

  utils/
    cli-args-parser.mjs          # CLI argument parsing logic (used by start.mjs)
    cli-error-handler.mjs        # Error handling specifically for CLI mode
    cli-runner.mjs               # Main loop for CLI mode interaction
    github.utils.mjs             # Utility for uploading files (research results) to GitHub
    research.clean-query.mjs     # Utility to clean query strings
    research.ensure-dir.mjs      # Utility to ensure directory existence
    # research.file-utils.mjs    # Not present in provided structure
    research.object-utils.mjs    # Utility functions for objects
    research.output-manager.mjs  # Handles output broadcasting (console/WebSocket)
    research.prompt.mjs          # CLI prompt utility (readline wrapper)
    research.rate-limiter.mjs    # Generic rate limiter class
    token-classifier.mjs         # Utility to call Venice for token classification
    websocket.utils.mjs          # Utility for safe WebSocket sending (`safeSend`)

start.mjs                          # Entry point (determines CLI vs. Server mode)
README.md                          # This file
# Other files like package.json, vitest.config.js, .env (if present), and various .md files are config/docs/notes
```

---

## Usage Modes
1. **Server Mode (Default)**
   - `npm start` or `node app/start.mjs`.
   - Runs Express server (`PORT` env var, default 3000). Access web UI at `http://localhost:PORT`.
   - WebSockets handle real-time interaction. Use commands like `/login`, `/research`, `/chat`, `/help`, `/diagnose`.

2. **CLI Mode**
   - `npm start -- cli` or `node app/start.mjs cli`.
   - Interactive text-based prompts for commands and parameters.

---

## Authentication System
1. **Roles & Permissions**
   - **Public**: No login needed, restricted features/limits (enforced within command handlers).
   - **Client**: Must log in (`/login`). Can store personal API keys, potentially higher limits.
   - **Admin**: Full privileges (`/users` command, potentially `/diagnose`).

2. **User Management**
   - Users stored under `~/.mcp/users/<username>.json` (or `MCP_TEST_USER_DIR`).
   - Create users via `/users create <username> --role=<role>` (admin only).

3. **Session Management**
   - Session state (user auth status, loaded keys, memory manager instance) managed server-side (`activeChatSessions` in `app/features/research/routes.mjs`).
   - Client (`public/terminal.js`) receives session status updates (`login_success`, `logout_success`, `connection`, `session-expired`) and handles display/state reset.
   - Logout (`/logout`) clears server and client state. Reconnecting resets client to public/disconnected state.

4. **Authentication Commands**
   - `/login <username>`
   - `/logout`
   - `/status`
   - `/users create|list|delete...` (admin only)
   - `/password-change`

---

## Research Pipeline

### Research Pipeline Overview

1.  **Initiation:** User provides query via CLI prompt, Web-CLI prompt (`handleCommandMessage` -> `wsPrompt`), or `/research` command (with optional flags like `--depth`, `--breadth`, `--classify`). Handled by `app/commands/research.cli.mjs`.
2.  **Token Classification (Optional):** If enabled (via prompt or `--classify` flag), the query is sent to Venice API via `app/utils/token-classifier.mjs::callVeniceWithTokenClassifier`. Returned metadata is added to the query object.
3.  **Query Generation:** `app/features/ai/research.providers.mjs::generateQueries` uses the original query (and metadata, if present) to create initial search queries via LLM.
4.  **Search Execution:** `app/infrastructure/research/research.path.mjs` uses `app/infrastructure/search/search.providers.mjs` (Brave) to execute queries, handling rate limits.
5.  **Processing & Summarization:** Results are processed (`app/features/ai/research.providers.mjs::processResults`), learnings extracted, and a summary generated (`generateSummary`) via LLM.
6.  **Output & Action:** Progress is streamed via WebSockets (`type: 'progress'`). Final learnings, sources, and summary are compiled into Markdown (`research.engine.mjs::generateMarkdownResult`). The user is then prompted (CLI or Web-CLI via `wsPrompt` context `post_research_action`) to choose an action: Display, Download, Upload to GitHub, or Discard.
7.  **Completion:** Research completion signaled via `research_complete` message.

**Note:** The token classifier is only used to generate metadata, and the metadata is combined with the user input to create detailed search queries. User input + metadata is never sent directly to Brave. Research results are **not** stored persistently on the server; the user chooses the destination after each research task.

---

## API Key Management
1. **Key Setup**
   - Use the `/keys set <service> [options]` command after logging in.
   - **Brave/Venice:**
     - `/keys set brave <your_brave_api_key>`
     - `/keys set venice <your_venice_api_key>`
     - To clear: `/keys set brave ""` or `/keys set venice ""`
   - **GitHub:** Requires flags. Owner, Repo, and Token are mandatory for persistence features.
     - `/keys set github --github-owner=<user_or_org> --github-repo=<repo_name> --github-token=<your_github_pat> [--github-branch=<branch_name>]`
     - Example (minimum required):
       `/keys set github --github-owner=bitwikiorg --github-repo=BITCORE_MEMORY --github-token=ghp_YourTokenHere`
     - Example (with specific branch):
       `/keys set github --github-owner=bitwikiorg --github-repo=BITCORE_MEMORY --github-token=ghp_YourTokenHere --github-branch=dev`
     - The GitHub token needs `repo` scope. Branch defaults to `main` if not specified.
   - Keys are stored encrypted per user (`app/features/auth/user-manager.mjs`).
   - Environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.) used as fallback *only if user keys are not set or cannot be decrypted*.

2. **Key Checks**
   - `/keys check` or `/keys stat`: Lists configuration status for Brave, Venice, and GitHub.
   - `/keys test`: Attempts to use keys/token to validate them against the respective APIs.

3. **Encryption**
   - AES-256-GCM with salts per user (`app/features/auth/encryption.mjs`).
   - Requires user password internally to decrypt keys/token for use (`app/features/auth/user-manager.mjs`).

---

## Token Classification Module
1. **Purpose**
   - Forwards user queries to Venice's LLM endpoint (`app/utils/token-classifier.mjs` using `app/infrastructure/ai/venice.llm-client.mjs`).
   - Attaches the raw metadata returned by Venice to the query object.
   - Improves context for the subsequent query generation step in the research pipeline.

2. **Integration**
   - Triggered by 'y' response to prompt (CLI/Web interactive) or `--classify` flag (`/research` command).
   - Metadata is used by `generateQueries` in `app/features/ai/research.providers.mjs`.

3. **Implementation**
   - `callVeniceWithTokenClassifier` function in `app/utils/token-classifier.mjs` is called within the research initiation flow (`app/commands/research.cli.mjs`, `app/features/research/routes.mjs`).

---

## Chat and Memory System

The chat system enables interactive conversations with an AI, featuring context retention through a memory system.

### Chat Commands
1. **Starting Chat**
   - `/chat`: Starts basic chat session. Requires password for key decryption (prompted if needed).
   - `/chat --memory=true`: Enables memory (server-side `MemoryManager`). Requires password.
   - `/chat --depth=short|medium|long`: Sets memory depth (parsed server-side). Requires password if memory enabled.

2. **In-Chat Commands**
   - `/exit`: Ends chat mode (client and server).
   - `/exitmemory`: Finalizes memory (server-side, triggers `MemoryManager.summarizeAndFinalize` and potentially `GitHubMemoryIntegration.commitMemory`). Sends `memory_commit` event with SHA on success.
   - `/exitresearch`: Exits chat and uses the entire conversation history as a query for the `/research` command (`app/commands/chat.cli.mjs::executeExitResearch`).
   - `/memory stats`: Displays statistics about the current memory session (`app/commands/memory.cli.mjs`).
   - `/research <query>`: Triggers research based on chat context and the provided query (handled by `startResearchFromChat` in `app/commands/chat.cli.mjs`).

3. **Memory Architecture** (Implemented in `app/infrastructure/memory/memory.manager.mjs`)
   - **Ephemeral Memory**: Recent conversation history (managed within chat session).
   - **Validated Memory**: Summarized/validated knowledge potentially stored via `GitHubMemoryIntegration`.
   - **Summarization/Scoring**: Uses `LLMClient` (`app/infrastructure/ai/venice.llm-client.mjs`).

### GitHub Integration for Persistent Storage
- Optional persistence via `app/infrastructure/memory/github-memory.integration.mjs`.
- Triggered during memory finalization (`/exitmemory`).
- Stores summarized memories in a configured GitHub repository.
- Sends `memory_commit` event with commit SHA to client on success.

### Using the Chat System
1. **Basic Chat**
   ```
   /login <user>
   > (Enter password)
   /chat
   > (Enter password for keys if prompted)
   [chat] > Tell me about quantum computing
   [AI] Quantum computing is...
   [chat] > /exit
   >
   ```

2. **Chat with Memory**
   ```
   /login <user>
   > (Enter password)
   /chat --memory=true --depth=medium
   > (Enter password for keys if prompted)
   [chat:medium] > Tell me about quantum computing
   [AI] Quantum computing is...
   [chat:medium] > What are qubits exactly?
   [AI] Qubits are...
   [chat:medium] > /memory stats
   [System] Memory Stats: ...
   [chat:medium] > /research applications of qubits
   [System] Starting research...
   ... (Research progress) ...
   [System] Research complete. Summary: ... (Prompt for action: Display/Download/Upload/Discard)
   > (Exits chat after research action)
   /chat --memory=true --depth=medium
   > (Enter password for keys if prompted)
   [chat:medium] > /exitmemory
   [System] Finalizing memories...
   [System] Memory finalization complete.
   [System] Memory committed to GitHub. Commit SHA: <sha_hash>
   [chat:medium] > /exit
   >
   ```

3. **Web Interface**
   - The chat interface is available through the web terminal (`/chat` command).
   - Mode switching and input routing are handled based on server messages.
   - Feedback on memory operations (`/memory stats`, GitHub commits) is provided.

---

## Running the App
1. **Install Dependencies**
   `npm install`

2. **Set Environment Variables**
   Create a `.env` file with (at minimum):
   ```
   PORT=3000
   # Optional global keys (used if user keys not set/decrypted)
   # BRAVE_API_KEY=your_brave_api_key
   # VENICE_API_KEY=your_venice_api_key
   # Optional for GitHub memory/research persistence:
   # GITHUB_TOKEN=your_github_pat
   # GITHUB_REPO_OWNER=your_github_username
   # GITHUB_REPO_NAME=your_repo_name
   # GITHUB_REPO_BRANCH=main
   # Optional for testing user storage location:
   # MCP_TEST_USER_DIR=/path/to/test/users
   ```

3. **Start in Server Mode**
   `npm start`
   Access `http://localhost:3000` in a browser.

4. **Start in CLI Mode**
   `npm start -- cli`
   Follow the interactive text-based session.

---

## Production Deployment
(Keep existing PM2/Nginx/SSL instructions - Assuming these are standard and don't need code verification)
*   Use a process manager like PM2: `pm2 start app/start.mjs --name mcp-app`
*   Set up a reverse proxy (Nginx recommended) to handle SSL termination and serve static files.
*   Configure Nginx to proxy WebSocket connections (`proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"` headers).
*   Obtain SSL certificates (e.g., Let's Encrypt).

---

## Security Considerations
- **API Key Protection**: Keys are AES-256-GCM encrypted (`app/features/auth/encryption.mjs`) with per-user salts derived from their password (`app/features/auth/user-manager.mjs::deriveKey`). Keys are decrypted server-side only when needed for API calls, requiring the user's password (prompted via WebSocket/CLI if necessary).
- **Password Security**: Passwords hashed using Argon2 (`app/features/auth/user-manager.mjs`). Session management is server-side.
- **Server Hardening**: Use standard practices (firewall, non-root user, updates).
- **HTTPS**: Essential in production.
- **Input Sanitization**: Query cleaning (`app/utils/research.clean-query.mjs`) exists, but review command parsing and inputs for potential injection risks.
- **Rate Limiting**: Implemented for login attempts (`app/features/auth/user-manager.mjs`) and external API calls (`app/utils/research.rate-limiter.mjs`).

---

## Troubleshooting
1. **Application Won’t Start**
   - Check Node.js version (v18+ likely required).
   - Ensure required environment variables are set if needed (e.g., `PORT`). Check `.env` file.
   - Run `npm install` to ensure dependencies are met.

2. **Research/Chat Command Fails**
   - Ensure you are logged in (`/status`).
   - Verify API keys using `/keys check` and `/keys test`. Requires login and password.
   - Check for rate limit errors in logs or output.
   - Ensure network connectivity to Brave/Venice APIs.
   - Ensure correct password was provided if prompted for key decryption.

3. **User Can’t Log In**
   - Confirm username exists (`~/.mcp/users/<username>.json` or `MCP_TEST_USER_DIR`).
   - Check password. Check for rate limiting messages (`app/features/auth/user-manager.mjs`).
   - If admin user is lost/corrupted, manually delete the corresponding JSON file; the app should prompt for admin creation on next start (`app/start.mjs` logic).

4. **Web Interface Not Loading/Working**
   - Check server logs (`npm start` output or PM2 logs).
   - Check browser's developer console for JavaScript errors or WebSocket connection issues (`public/webcomm.js`, `public/terminal.js`).
   - Verify Nginx/proxy configuration if used.

5. **Web-CLI Input Issues**
   - **Problem:** Input box locks unexpectedly, or commands don't seem to register.
   - **Cause:** Might be related to prompt handling (`public/terminal.js` `handlePrompt`, `app/features/research/routes.mjs` `wsPrompt`), input locking/unlocking logic (`public/terminal.js` `disableInput`/`enableInput`, server messages `enable_input`/`disable_input`), or WebSocket message processing delays/errors. An operation might not be correctly re-enabling input or the client/server state is out of sync.
   - **Workaround:** Try resetting the terminal via browser refresh. Ensure WebSocket connection is stable. Check browser console for errors.
   - **Fix:** Requires debugging the input lock/unlock flow, prompt handling promises, and WebSocket message sequencing. Ensure server always sends a final message that enables input unless explicitly keeping it disabled (e.g., during progress).

---

## Validation & Accuracy Check
This README aims to accurately reflect the application state based on the provided file structure and seed content as of April 25, 2025. Key aspects verified include dual-mode operation, Web-CLI parity, server-driven interaction modes, research pipeline flow, token classification integration, authentication/encryption mechanisms, chat/memory system features, post-research actions, and file structure. **Testing the Web-CLI interaction flows, especially prompt handling and mode transitions, remains crucial.**


---

do not delete (we need this to restart app)


> `git pull origin main`
> `pm2 restart mcp-backend`
