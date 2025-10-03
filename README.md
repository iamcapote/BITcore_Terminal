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
5. [Single-User Mode](#single-user-mode)
6. [Research Pipeline](#research-pipeline)
7. [API Key Management](#api-key-management)
8. [Token Classification Module](#token-classification-module)
9. [Chat and Memory System](#chat-and-memory-system)
10. [Running the App](#running-the-app)
11. [Production Deployment](#production-deployment)
12. [Security Considerations](#security-considerations)
13. [Troubleshooting](#troubleshooting)
14. [Research Request Scheduler](#research-request-scheduler)
15. [Validation & Accuracy Check](#validation--accuracy-check)
16. [Development Guidelines (Agents & Modules)](#development-guidelines-agents--modules)

---

## Overview
This application automates research using AI-driven querying and summarization. The app now runs in single-user mode (no login/auth). API keys can be provided via environment variables or set at runtime using the `/keys` command. It integrates with the Venice API for optional token classification, adding metadata to strengthen query context. The chat system enables interactive conversations with memory retention capabilities (`app/infrastructure/memory/memory.manager.mjs`) and seamless transition to deep research.

---

## Features
1. **Dual-Mode Application**
   - Runs in Server Mode or CLI Mode, determined by arguments passed to `app/start.mjs`.
   - Server Mode: Serves the web terminal (`app/public/index.html`, `app/public/terminal.js`, `app/public/chat.js`) via Express and streams events over WebSockets (`app/features/research/routes.mjs`).
   - CLI Mode: Provides an interactive terminal powered by Node.js `readline` through `app/utils/research.prompt.mjs` and orchestrated by `app/utils/cli-runner.mjs`.

2. **Web-Based Terminal Interface**
   - Real-time output and input via WebSockets, mirroring the console CLI (`app/public/terminal.js`, `app/public/webcomm.js`).
   - Handles commands (`/research`, `/chat`, `/keys`, etc.) parsed client-side (`app/public/command-processor.js`) and sent to the backend via structured messages (`command`, `chat-message`, `input`).
   - Supports interactive prompts initiated by the backend (for passwords, research parameters, or post-research actions) via `wsPrompt` (`app/features/research/routes.mjs`) and the corresponding handlers in `app/public/terminal.js`.
   - Manages distinct interaction modes ('command', 'chat', 'research', 'prompt') to route user input correctly. The server now emits `disable_input` when a message begins processing and only re-enables the UI through the dedicated `enableClientInput` helper once the handler confirms it is safe to resume typing. This guarantees that prompts and long-running commands do not leave the client stuck in the wrong state.
   - Session metadata (user clone, cached password, telemetry emitters) lives in `activeChatSessions`; lifecycle hooks (`close`, `error`, inactivity cleanup) clear secrets and tear down telemetry so reconnects always start from a clean slate.

3. **Research Engine**
   - Orchestrated by `app/infrastructure/research/research.engine.mjs` (multi-path coordination) and `app/infrastructure/research/research.path.mjs` (single-path execution).
   - Generates breadth/depth queries through Venice LLM helpers in `app/features/ai/research.providers.mjs` and executes them with the Brave provider in `app/infrastructure/search/search.providers.mjs`, guarded by `app/utils/research.rate-limiter.mjs`.
   - Streams progress events and debug updates back to the caller (CLI or WebSocket) and composes the final Markdown response via `buildResearchMarkdown`.

4. **Token Classification**
   - Optional module powered by `app/utils/token-classifier.mjs` plus `app/infrastructure/ai/venice.llm-client.mjs` to fetch enriched metadata.
   - Expands the research query object with `tokenClassification` data before handoff to query generation.
   - CLI sessions prompt for opt-in (`app/commands/research.cli.mjs`), while Web clients rely on prompts or the `--classify` flag. Failures simply log and continue with the base query.

5. **Single-User Mode**
   - No login or password flows. A single global user is used for all operations.
   - The active user is stored in `~/.bitcore-terminal/global-user.json` by default (override via `BITCORE_STORAGE_DIR`).
   - API keys can be set via environment variables or at runtime with `/keys set ...` and are stored unencrypted in the single-user profile.
   - Commands `/login`, `/logout`, and `/password-change` are retained for compatibility but are no-ops that simply display a helpful message.

6. **API Key Storage**
   - Single-user profile stored in `~/.bitcore-terminal/global-user.json` via `app/features/auth/user-manager.mjs`.
   - Brave, Venice, and GitHub credentials are saved in plaintext JSON (no encryption in the current release). Secure the storage directory or use environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.) when deploying.
   - `/keys set/check/test` lives in `app/commands/keys.cli.mjs`; password prompts are still surfaced via `wsPrompt` for compatibility even though encryption is disabled.
   - GitHub configuration tracks owner, repo, branch, and token for research/memory uploads.

7. **Chat System with Memory**
   - `/chat` spins up an AI conversation mediated by `app/commands/chat.cli.mjs` and the Venice client.
   - Memory is optional (`--memory`, `--depth`) and handled by `app/infrastructure/memory/memory.manager.mjs`, with GitHub persistence via `app/infrastructure/memory/github-memory.integration.mjs`.
   - In-chat commands (`/exit`, `/exitmemory`, `/memory stats`, `/research …`) are parsed the same way for CLI and WebSocket flows, with Web clients informed through dedicated events such as `memory_commit`.

8. **Logging & Error Handling**
   - Uses `app/utils/research.output-manager.mjs` for broadcasting output to console and connected WebSocket clients.
   - CLI error handling via `app/utils/cli-error-handler.mjs`.
   - Rate-limiting (`app/utils/research.rate-limiter.mjs`, `app/features/auth/user-manager.mjs`) and retry logic (e.g., in `app/infrastructure/ai/venice.llm-client.mjs`, `app/infrastructure/search/search.providers.mjs`).
   - WebSocket errors are caught and sent to the client (`wsErrorHelper` in `routes.mjs`).

9. **Diagnostics**
   - `/diagnose [api|perms|storage|all]` (`app/commands/diagnose.cli.mjs`) probes Brave, Venice, and GitHub connectivity plus filesystem readiness for the active session.

10. **Post-Research Actions**
   - After research completes, CLI users see a menu while Web users receive a prompt (`post_research_action`) to choose Display, Download, Upload (GitHub), or Discard.
   - Download leverages the `download_file` WebSocket event, while uploads run through `app/utils/github.utils.mjs` using decrypted user credentials.

11. **Research Request Scheduler**
   - Node-cron worker (disabled by default) that polls the configured GitHub research repository for pending request files.
   - Configured through `app/config/index.mjs` defaults or environment variables (`RESEARCH_SCHEDULER_*`, `RESEARCH_GITHUB_*`).
   - Controlled via the `/research-scheduler` command and starts automatically when enabled for both server and CLI modes.

---

## File Structure
```plaintext
app/
   commands/
      admin.cli.mjs            – Admin-only helpers (legacy)
      chat.cli.mjs             – Chat facade delegating to modular helpers
      diagnose.cli.mjs         – `/diagnose` health checks (API, perms, storage)
      index.mjs                – Command registry and CLI parser glue
      keys.cli.mjs             – `/keys` set/check/test helpers
      login.cli.mjs            – Compatibility `/login` command (no-op in single-user mode)
      logout.cli.mjs           – Compatibility `/logout` command (no-op)
      memory.cli.mjs           – `/memory stats` and related helpers
      missions.cli.mjs         – Mission orchestration entrypoint
      password.cli.mjs         – Compatibility `/password-change` command (no-op)
      prompts.cli.mjs          – Prompt library management
      research.cli.mjs         – `/research` CLI runner and prompts
      research.command.mjs     – Shared research execution helpers
      research.mjs             – Research command entry-point wrapper
      status.cli.mjs           – `/status` reporting
      terminal.cli.mjs         – Terminal preference management
   users.cli.mjs            – `/users` admin wrapper; prints single-user notice unless an adapter is registered

   config/
      index.mjs               – Runtime configuration loader
      websocket.mjs           – WebSocket server wiring

   features/
      ai/
         research.providers.mjs – Placeholder shim for query/summarisation prompts (see `guides/gaps.md`)
      auth/
         encryption.mjs        – Legacy AES-256-GCM helpers (unused in current single-user mode)
         user-manager.mjs      – Single-user store, API key persistence, feature flags
      chat/
         handlers.mjs          – WebSocket chat message handlers
         routes.mjs            – Express routes specific to chat flows
         ws-chat-handler.mjs   – Chat-specific WebSocket helpers
      research/
         research.controller.mjs – Research controller used by Web routes
         routes.mjs              – WebSocket command router and prompt helpers

   infrastructure/
      ai/
         venice.characters.mjs – Character presets for Venice LLM
         venice.llm-client.mjs – Venice API client
         venice.models.mjs     – Model catalog and defaults
         venice.response-processor.mjs – Cleans LLM output for display
      memory/
         github-memory.integration.mjs – GitHub persistence for memory summaries
         memory.manager.mjs     – Memory storage, retrieval, summarization logic
      research/
         research.engine.mjs    – Research orchestration (delegates markdown to `research.markdown.mjs`)
         research.markdown.mjs  – Formats research learnings/sources into Markdown with suggested filenames
         research.path.mjs      – Path execution, progress, query sequencing
      search/
         search.providers.mjs  – Brave search provider and retry logic

   public/
      index.html              – Web terminal shell
      terminal.js             – Terminal UI controller
      command-processor.js    – Client-side command parsing helpers
      chat.js                 – Chat panel enhancements for the terminal
      research/
         index.html            – Research library UI
         research.js           – Front-end logic for saved research viewer
      css/                    – Shared styling assets
      style.css               – Terminal styling
      webcomm.js              – WebSocket connection manager

   tests/
      …                       – Vitest suites for commands, providers, and engine

   utils/
      cli-args-parser.mjs     – CLI argument parsing
      cli-error-handler.mjs   – Error categorisation and logging helpers
      cli-runner.mjs          – CLI REPL orchestrator
      github.utils.mjs        – GitHub upload helpers for research output
      research.clean-query.mjs – Query sanitisation
      research.ensure-dir.mjs – Directory creation helper
      research.file-utils.mjs – File path utilities for research output
      research.object-utils.mjs – Object utilities used across the pipeline
      research.output-manager.mjs – Broadcasts output to console and sockets
      research.prompt.mjs     – CLI prompt wrappers
      research.rate-limiter.mjs – Rate limiter implementation
      token-classifier.mjs    – Venice token classification wrapper
      websocket.utils.mjs     – Safe WebSocket send helpers

   start.mjs                 – Entry point that bootstraps CLI or server mode

docs & ops/
   README.md, guides/, todo.md, gaps.md, completed.md, websession.md, etc.

package.json, vitest.config.js, .env (optional), and other project metadata live at the repository root.
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

When `RESEARCH_SCHEDULER_ENABLED=true`, both modes automatically bootstrap the cron worker at launch; otherwise the scheduler remains idle until started manually via `/research-scheduler start`.

---

## Single-User Mode
Authentication is removed. The system operates as a single global user:

- Username: `operator` by default (override via `BITCORE_USER`); role defaults to `admin`.
- Storage path: `~/.bitcore-terminal` (override via `BITCORE_STORAGE_DIR`).
- Keys are loaded from environment variables if set: `BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`.
- You can also set keys via commands without any password prompts:
  - `/keys set brave <key>`
  - `/keys set venice <key>`
  - `/keys set github --github-owner=<user_or_org> --github-repo=<repo> --github-token=<token> [--github-branch=<branch>]`

---

## Research Pipeline

### Research Pipeline Overview

1.  **Initiation:** User provides a query via CLI prompt, Web-CLI prompt (`handleCommandMessage` -> `wsPrompt`), or `/research` command (with optional flags like `--depth`, `--breadth`, `--classify`). When the Web terminal receives `/research` with no query, it immediately issues an interactive prompt so the operator can supply one before the engine starts. Handled by `app/commands/research.cli.mjs`.
2.  **Token Classification (Optional):** If enabled (via prompt or `--classify` flag), the query is sent to Venice API via `app/utils/token-classifier.mjs::callVeniceWithTokenClassifier`. Returned metadata is added to the query object.
3.  **Query Generation:** `app/features/ai/research.providers.mjs::generateQueries` is intended to expand the query (and metadata, if present) into breadth/depth prompts. The current build ships with a placeholder implementation (see `guides/gaps.md`) until the Venice-backed variant is restored.
4.  **Search Execution:** `app/infrastructure/research/research.path.mjs` uses `app/infrastructure/search/search.providers.mjs` (Brave) to execute queries, handling rate limits.
5.  **Processing & Summarization:** Results are processed (`app/features/ai/research.providers.mjs::processResults`), learnings extracted, and a summary generated (`generateSummary`) via LLM once the provider module is reinstated. The placeholder build skips these steps and returns minimal output.
6.  **Output & Action:** Progress is streamed via WebSockets (`type: 'progress'`). Final learnings, sources, and summary are compiled into Markdown (`research.markdown.mjs::buildResearchMarkdown`). The user is then prompted (CLI or Web-CLI via `wsPrompt` context `post_research_action`) to choose an action: Display, Download, Upload to GitHub, or Discard.
7.  **Completion:** Research completion signaled via `research_complete` message.

**Note:** The token classifier is only used to generate metadata, and the metadata is combined with the user input to create detailed search queries. User input + metadata is never sent directly to Brave. Research results are **not** stored persistently on the server; the user chooses the destination after each research task.

---

## API Key Management
1. **Key Setup**
   - Use the `/keys set <service> [options]` command (no login required).
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
   - Keys are stored as plain strings in the single-user profile at `~/.bitcore-terminal/global-user.json`.
   - Environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.) are used as initial values if present.

2. **Key Checks**
   - `/keys check` or `/keys stat`: Lists configuration status for Brave, Venice, and GitHub.
   - `/keys test`: Attempts to use keys/token to validate them against the respective APIs.
   - Internally, credential lookups flow through `app/utils/api-keys.mjs` so every feature (chat, research, diagnostics) shares the same session/profile/env fallback chain.

3. **Encryption (Legacy)**
   - AES-256-GCM helpers remain in the codebase (`app/features/auth/encryption.mjs`) but are not invoked in single-user mode.
   - `/login`, `/logout`, and password prompts are retained for compatibility yet do not gate access to stored credentials.

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
   - `/chat`: Starts basic chat session.
   - `/chat --memory=true`: Enables memory (server-side `MemoryManager`).
   - `/chat --depth=short|medium|long`: Sets memory depth (parsed server-side).

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

2. **Web Interface**
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
   # Optional global keys
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

### Scheduler Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEARCH_SCHEDULER_ENABLED` | `false` | Toggles the GitHub research request poller. |
| `RESEARCH_SCHEDULER_CRON` | `*/15 * * * *` | Cron cadence for polling GitHub. |
| `RESEARCH_SCHEDULER_TZ` | *(unset)* | Optional timezone passed to node-cron (e.g., `UTC`, `America/New_York`). |
| `RESEARCH_SCHEDULER_RUN_ON_START` | `true` | Run a fetch immediately when the scheduler starts. |
| `RESEARCH_SCHEDULER_MAX_REQUESTS` | `10` | Maximum requests processed per tick. |
| `RESEARCH_GITHUB_REQUESTS_PATH` | `requests` | Directory inside the research repo containing pending requests. |
| `RESEARCH_GITHUB_PROCESSED_PATH` | *(unset)* | Optional directory for archiving processed requests (future use). |

---

## Production Deployment
(Keep existing PM2/Nginx/SSL instructions - Assuming these are standard and don't need code verification)
*   Use a process manager like PM2: `pm2 start app/start.mjs --name mcp-app`
*   Set up a reverse proxy (Nginx recommended) to handle SSL termination and serve static files.
*   Configure Nginx to proxy WebSocket connections (`proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"` headers).
*   Obtain SSL certificates (e.g., Let's Encrypt).

---

## Security Considerations
- **API Key Protection**: In single-user mode, keys are stored in plain JSON. Prefer environment variables in production or secure the storage directory.
- **Password Security**: Passwords are not used in single-user mode.
- **Session Hygiene**: WebSocket sessions cache decrypted credentials only long enough to satisfy the in-flight command. On socket close, error, or idle timeout `cleanupInactiveSessions` clears `session.password`, research artifacts, and telemetry hooks before dropping the session from `activeChatSessions`.
- **Server Hardening**: Use standard practices (firewall, non-root user, updates).
- **HTTPS**: Essential in production.
- **Input Sanitization**: Query cleaning (`app/utils/research.clean-query.mjs`) exists, but review command parsing and inputs for potential injection risks.
- **Rate Limiting**: Implemented for login attempts (`app/features/auth/user-manager.mjs`) and external API calls (`app/utils/research.rate-limiter.mjs`).

### Optional Multi-User Adapters

Self-hosted deployments that need true multi-user management can register a directory adapter at startup:

```js
import { userManager } from './app/features/auth/user-manager.mjs';

userManager.registerUserDirectoryAdapter({
   async listUsers() {
      return [
         { username: 'admin', role: 'admin' },
         { username: 'analyst', role: 'client' }
      ];
   },
   async createUser({ username, role }) {
      // persist user and return normalized record
      return { username, role };
   },
   async deleteUser({ username }) {
      // remove user from backing store
   }
});
```

With an adapter registered, the `/users` command (CLI and web terminal) delegates create/list/delete actions to the provided functions. Leave the adapter undefined to keep the default single-operator mode.

---

## Troubleshooting
1. **Application Won’t Start**
   - Check Node.js version (v18+ likely required).
   - Ensure required environment variables are set if needed (e.g., `PORT`). Check `.env` file.
   - Run `npm install` to ensure dependencies are met.

## Research Request Scheduler

The scheduler is implemented in `app/features/research/github-sync/request.scheduler.mjs` and activated when `RESEARCH_SCHEDULER_ENABLED=true`.

- **Fetch**: Uses the GitHub research sync controller to list request files (JSON or plaintext) under the configured directory and parses them into normalized tasks.
- **Filter**: Skips closed or malformed entries, only surfacing items with `status` markers such as `pending`, `new`, or `open`.
- **Handle**: Invokes an injected handler for each request (the default logs discoveries). Extend this handler to enqueue jobs or trigger the research engine.
- **Control**: `/research-scheduler status|run|start|stop` offers runtime management in both CLI and Web terminals. Programmatic consumers can call `getResearchRequestScheduler()` to interact directly.

See [`guides/research.md`](./guides/research.md#research-request-scheduler) for architecture diagrams and extension guidance.

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

## Development Guidelines (Agents & Modules)

For pragmatic, contextual guidance on adding new agents and modules, see AGENTS.md at the repo root. It lays out contract-first design, file size limits, modular structure, and testing standards tailored to this codebase.

Highlights:
- Keep files small (target 300–500 LOC; soft ceiling 500). Split by responsibility early. Modularize as needed.
- Contract first: define inputs, outputs, error modes, and performance budgets (time/memory) before coding.
- One intent per change; ship in verifiable slices with tests.
- Separate concerns: one module, one role. Favor composition.
- Guard → Do → Verify: validate inputs, perform the action, assert invariants, then return immutable results.
- Test behavior with Vitest; mock external IO at edges; respect cancellation/timeouts.
- Improve code health with every change (naming, docs, structure). Add short “Why/What/How” headers to files.

Read the complete guidelines: [AGENTS.md](./AGENTS.md)

do not delete (we need this to restart app)


> `git pull origin main`
> `pm2 restart mcp-backend`
