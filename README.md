# Deep Research Privacy App

The Deep Research Privacy App is a privacy-focused research tool that automates exploring topics in depth. It uses the Brave Search API along with optional token classification from the Venice LLM API. The app supports both CLI and browser-based terminal interfaces, letting you securely perform research, manage accounts, and enhance queries with metadata from external APIs.

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
This application automates research using AI-driven querying and summarization. It supports both public use (with limited features) and authenticated users (client or admin) who can store their own encrypted API keys. The app integrates seamlessly with the Venice API for optional token classification, adding metadata to strengthen query context. The newly implemented chat system enables interactive conversations with memory retention capabilities and seamless transition to deep research.

---

## Features
1. **Dual-Mode Application**
   - Runs in Server Mode or CLI Mode (`start.mjs`).
   - Server Mode: Provides a web interface (`public/index.html`) via Express and uses WebSockets (`features/research/routes.mjs`) for real-time communication.
   - CLI Mode: Interactive text-based prompts for commands and operations.

2. **Web-Based Terminal Interface**
   - Real-time output and input via WebSockets, aiming to mirror the Console-CLI experience (`public/terminal.js`, `public/webcomm.js`).
   - Handles commands (`/login`, `/research`, `/chat`, etc.) processed client-side (`public/command-processor.js`) and sent to the backend.
   - Supports interactive prompts initiated by the backend (e.g., for passwords, research parameters) handled by `terminal.js` and `routes.mjs` (`wsPrompt`).
   - Manages different interaction modes ('command', 'chat', 'research', 'prompt') to route user input correctly (`terminal.js`). Server dictates mode changes via messages (`mode_change`, `chat-ready`, `prompt`, etc.).
   - **Strict CLI Parity:** GUI elements (like checkboxes) that modify commands have been removed from `index.html`. Flags must be typed manually.

3. **Research Engine**
   - Orchestrated by `infrastructure/research/research.engine.mjs` and `research.path.mjs`.
   - Generates multiple queries (breadth) and follow-ups (depth) using AI (`features/ai/research.providers.mjs`).
   - Uses Brave Search (`infrastructure/search/search.providers.mjs`) for retrieving results, with rate limiting (`utils/research.rate-limiter.mjs`).
   - Summarizes findings via AI (`research.providers.mjs`), storing summaries, sources, and learnings.
   - Progress is streamed to the client (`research.controller.mjs`, `routes.mjs` sending `progress` messages).

4. **Token Classification**
   - Optional module using `utils/token-classifier.mjs` to call the Venice API.
   - Embeds metadata returned by Venice into the research query object.
   - **Integration:**
      - **CLI Mode:** Prompts "Use token classification? (y/n)" during interactive research setup (`commands/research.cli.mjs`).
      *   **Web-CLI Mode:**
          *   If starting research interactively (e.g., `/research` without query, handled by `handleCommandMessage`), prompts "Use token classification? [y/n]" via WebSocket (`wsPrompt`).
          *   If typing `/research <query>`, the `--classify` flag must be added manually.
   - If classification fails, the pipeline continues with the raw query.

5. **Authentication & User Management**
   - Roles: Public, Client, Admin (`features/auth/user-manager.mjs`).
   - File-based user profiles stored at `~/.mcp/users/<username>.json`.
   - Session management handled server-side (`features/research/routes.mjs` using `activeChatSessions`). Client UI updates via `login_success`/`logout_success` messages.
   - Commands: `/login`, `/logout`, `/status`, `/users` (create, list, delete), `/password-change` handled by respective files in `commands/`.

6. **Encrypted API Key Storage**
   - Per-user Brave and Venice API keys (`features/auth/user-manager.mjs`).
   - AES-256-GCM encryption (`features/auth/encryption.mjs`).
   - Keys commands (`/keys set/check/test`) handled by `commands/keys.cli.mjs`. Password prompts handled client-side in Web-CLI (`command-processor.js`, `terminal.js`).

7. **Chat System with Memory**
   - Interactive chat via `/chat` command (supports `--memory=true`, `--depth=...` flags) handled by `commands/chat.cli.mjs` (backend logic) and `features/research/routes.mjs` (`handleCommandMessage` initiating session).
   - Memory managed server-side (`infrastructure/memory/memory.manager.mjs`) with configurable depth.
   - Optional GitHub persistence (`infrastructure/memory/github-memory.integration.mjs`).
   - Seamless integration with research pipeline via `/research` command within chat (`handleChatMessage`).
   - Memory finalization via `/exitmemory` command (triggers summarization and potential GitHub commit, sends `memory_commit` event with SHA).
   - Memory status check via `/memory stats` command (use within active memory session).

8. **Logging & Error Handling**
   - Uses `utils/research.output-manager.mjs` for broadcasting output.
   - CLI error handling via `utils/cli-error-handler.mjs`.
   - Rate-limiting (`utils/research.rate-limiter.mjs`) and retry logic (e.g., in `venice.llm-client.mjs`, `search.providers.mjs`).

9. **Diagnostics**
    - `/diagnose [check...]` command (`commands/diagnose.cli.mjs`) allows checking API connectivity, permissions, and storage. (Note: Session checks, fixes, and tests are currently disabled).

---

## File Structure
```plaintext
app/
  commands/
    admin.cli.mjs           # (Potentially unused if covered by users.cli.mjs)
    chat.cli.mjs            # Handles /chat, /exitmemory (backend logic for CLI/Web)
    diagnose.cli.mjs        # Handles /diagnose (backend logic)
    index.mjs               # Main command router, argument parser, help command
    keys.cli.mjs            # Handles /keys (backend logic)
    login.cli.mjs           # Handles /login (backend logic)
    logout.cli.mjs          # Handles /logout (backend logic)
    memory.cli.mjs          # Handles /memory stats (backend logic)
    password.cli.mjs        # Handles /password-change (backend logic)
    research.cli.mjs        # Handles /research (backend logic for CLI/Web)
    status.cli.mjs          # Handles /status (backend logic)
    users.cli.mjs           # Handles /users (create, list, delete), createAdmin

  features/
    ai/
      research.providers.mjs       # AI providers for query generation, summarization
    auth/
      encryption.mjs
      user-manager.mjs             # User/session management, API key encryption
    research/
      research.controller.mjs      # Orchestrates research execution
      routes.mjs                   # Express routes & WebSocket handlers (handleWebSocketConnection, wsPrompt, etc.)

  infrastructure/
    ai/
      venice.characters.mjs
      venice.llm-client.mjs        # Venice LLM API client
      venice.models.mjs
      venice.response-processor.mjs
    memory/
      github-memory.integration.mjs # GitHub persistence logic
      memory.manager.mjs           # Core memory management (layers, retrieval, storage, stats)
    research/
      research.engine.mjs          # Research execution engine
      research.path.mjs            # Single research path logic
    search/
      search.mjs                   # Search interface/aggregator (if used)
      search.providers.mjs         # Brave Search provider

  public/
    # chat.js                      # (Potentially obsolete if chat handled within terminal.js)
    command-processor.js           # Client-side parsing of /commands, password prompts trigger
    index.html                     # Web terminal UI (input, output, status, help)
    # research.js                  # (Potentially obsolete if research handled within terminal.js)
    terminal.js                    # Core web terminal UI logic (input/output, modes, prompts, connection, event handlers)
    webcomm.js                     # WebSocket communication wrapper

  tests/
    # Various unit and integration tests
    ...

  utils/
    cli-args-parser.mjs
    cli-error-handler.mjs
    cli-runner.mjs
    research.clean-query.mjs
    research.ensure-dir.mjs
    research.object-utils.mjs
    research.output-manager.mjs    # Handles output broadcasting (console/WebSocket)
    research.prompt.mjs
    research.rate-limiter.mjs
    token-classifier.mjs           # Utility to call Venice for token classification

start.mjs                          # Entry point (CLI vs. Server mode)
README.md                          # This file
```

---

## Usage Modes
1. **Server Mode (Default)**
   - `npm start` or `node start.mjs`.
   - Runs Express server (`PORT` env var, default 3000). Access web UI at `http://localhost:PORT`.
   - WebSockets handle real-time interaction. Use commands like `/login`, `/research`, `/chat`, `/help`, `/diagnose`.

2. **CLI Mode**
   - `npm start -- cli` or `node start.mjs cli`.
   - Interactive text-based prompts for commands and parameters.

---

## Authentication System
1. **Roles & Permissions**
   - **Public**: No login needed, restricted features/limits.
   - **Client**: Must log in (`/login`). Can store personal API keys, higher limits.
   - **Admin**: Full privileges (`/users` command, `/diagnose`).

2. **User Management**
   - Users stored under `~/.mcp/users/<username>.json`.
   - Create users via `/users create <username> --role=<role>` (admin only).

3. **Session Management**
   - Session state (user auth status, loaded keys, memory manager instance) managed server-side (`activeChatSessions` in `routes.mjs`).
   - Client (`terminal.js`) receives session status updates (`login_success`, `logout_success`, `connection`, `session-expired`) and handles display/state reset.
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

1.  **Initiation:** User provides query via CLI prompt, Web-CLI prompt (`handleCommandMessage` -> `wsPrompt`), or `/research` command (with optional flags like `--depth`, `--breadth`, `--classify`).
2.  **Token Classification (Optional):** If enabled (via prompt or `--classify` flag), the query is sent to Venice API via `callVeniceWithTokenClassifier`. Returned metadata is added to the query object.
3.  **Query Generation:** `research.providers.generateQueries` uses the original query (and metadata, if present) to create initial search queries via LLM.
4.  **Search Execution:** `ResearchPath` uses `search.providers` (Brave) to execute queries, handling rate limits.
5.  **Processing & Summarization:** Results are processed (`research.providers.processResults`), learnings extracted, and a summary generated (`generateSummary`) via LLM.
6.  **Output:** Progress is streamed via WebSockets (`type: 'progress'`). Final learnings, sources, and summary are returned (`type: 'output'`) and potentially saved to a file (`research.output-manager.mjs`). Research completion signaled via `research_complete` message.

**Note:** The token classifier is only used to generate metadata, and the metadata is combined with the user input to create detailed search queries. User input + metadata is never sent directly to Brave.

---

## API Key Management
1. **Key Setup**
   - `/keys set --venice=<key> --brave=<key>`
   - Keys are stored encrypted per user (`user-manager.mjs`).
   - Environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`) used as fallback.

2. **Key Checks**
   - `/keys check`: Lists available keys (masked).
   - `/keys test`: Attempts to use keys to validate them.
   - Both require password in Web-CLI (`command-processor.js`, `terminal.js`).

3. **Encryption**
   - AES-256-GCM with salts per user (`encryption.mjs`).
   - Requires user password to decrypt keys for use (`user-manager.mjs`, `command-processor.js`, `routes.mjs` `wsPrompt`).

---

## Token Classification Module
1. **Purpose**
   - Forwards user queries to Venice's LLM endpoint (`utils/token-classifier.mjs`).
   - Attaches the raw metadata returned by Venice to the query object.
   - Improves context for the subsequent query generation step in the research pipeline.

2. **Integration**
   - Triggered by 'y' response to prompt (CLI/Web interactive) or `--classify` flag (`/research` command).
   - Metadata is used by `generateQueries` in `features/ai/research.providers.mjs`.

3. **Implementation**
   - `callVeniceWithTokenClassifier` function exists and is called within the research initiation flow (`commands/research.cli.mjs`, `features/research/routes.mjs`).

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
   - `/exitmemory`: Finalizes memory (server-side, triggers `MemoryManager.summarizeAndFinalize` and potentially `GitHubMemoryIntegration`). Sends `memory_commit` event with SHA on success.
   - `/exitresearch`: Exits chat and uses the entire conversation history as a query for the `/research` command.
   - `/memory stats`: Displays statistics about the current memory session.
   - `/research <query>`: Triggers research based on chat context and the provided query (handled by `startResearchFromChat` server-side).

3. **Memory Architecture** (Conceptual, implemented in `MemoryManager`)
   - **Short-term memory**: Recent conversation history (managed within chat session).
   - **Long-term memory**: Summarized/validated knowledge potentially stored via `GitHubMemoryIntegration`.
   - **Summarization/Scoring**: Uses `LLMClient` (`memory.manager.mjs`).

### GitHub Integration for Persistent Storage
- Optional persistence via `infrastructure/memory/github-memory.integration.mjs`.
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
   [System] Research complete. Summary: ...
   > (Exits chat after research)
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
   # Optional for GitHub memory persistence:
   # GITHUB_TOKEN=your_github_pat
   # GITHUB_REPO_OWNER=your_github_username
   # GITHUB_REPO_NAME=your_repo_name
   # GITHUB_REPO_BRANCH=main
   ```

3. **Start in Server Mode**
   `npm start`
   Access `http://localhost:3000` in a browser.

4. **Start in CLI Mode**
   `npm start -- cli`
   Follow the interactive text-based session.

---

## Production Deployment
(Keep existing PM2/Nginx/SSL instructions)

---

## Security Considerations
- **API Key Protection**: Keys are AES-256-GCM encrypted (`encryption.mjs`) with per-user salts derived from their password (`user-manager.mjs`). Keys are decrypted server-side only when needed for API calls, requiring the user's password (prompted via WebSocket if necessary).
- **Password Security**: Passwords hashed using Argon2 (`user-manager.mjs`). Session management is server-side.
- **Server Hardening**: Use standard practices (firewall, non-root user, updates).
- **HTTPS**: Essential in production.

---

## Troubleshooting
1. **Application Won’t Start**
   - Check Node.js version (v18+ recommended).
   - Ensure required environment variables are set if needed (e.g., `PORT`). Check `.env` file.

2. **Research/Chat Command Fails**
   - Ensure you are logged in (`/status`).
   - Verify API keys using `/keys check` and `/keys test`. Requires login and password.
   - Check for rate limit errors in logs or output.
   - Ensure network connectivity to Brave/Venice APIs.
   - Ensure correct password was provided if prompted for key decryption.

3. **User Can’t Log In**
   - Confirm username exists (`~/.mcp/users/<username>.json`).
   - Check password. Check for rate limiting messages.
   - If admin user is lost/corrupted, manually delete the corresponding JSON file; the app might prompt for admin creation on next start (verify this behavior if needed).

4. **Web Interface Not Loading/Working**
   - Check server logs (`npm start` output or PM2 logs).
   - Check browser's developer console for JavaScript errors or WebSocket connection issues.
   - Verify Nginx/proxy configuration if used.

5. **Web-CLI Input Issues**
   - **Problem:** Input box locks unexpectedly, or commands don't seem to register.
   - **Cause:** Might be related to prompt handling (`terminal.js` `handlePrompt`, `routes.mjs` `wsPrompt`), input locking/unlocking logic (`terminal.js` `disableInput`/`enableInput`), or WebSocket message processing delays/errors. An operation might not be correctly re-enabling input or the client/server state is out of sync.
   - **Workaround:** Try resetting the terminal via browser refresh. Ensure WebSocket connection is stable. Check browser console for errors.
   - **Fix:** Requires careful testing and potentially debugging the input lock/unlock flow, prompt handling promises, and WebSocket message sequencing. Ensure server always sends a final message that enables input unless explicitly keeping it disabled (e.g., during progress).

---

## Validation & Accuracy Check
This README reflects the application state after significant refactoring (April 19, 2025). Key changes include stricter CLI parity in the Web-CLI (no GUI toggles), server-driven mode management, improved session handling on disconnect, and implementation of interactive prompts and feedback mechanisms via WebSockets. **Extensive testing of the Web-CLI flow is the highest priority.**

### Recent Fixes
- Fixed WebSocket SyntaxError in `routes.mjs`.
- Improved Web-CLI input handling in `terminal.js`.
- Added debugging logs for input enable/disable states.
- Validated Console CLI functionality for core commands.
