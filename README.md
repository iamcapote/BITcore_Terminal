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
16. [Live Test Checklist](#live-test-checklist)
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
   - Supports interactive prompts initiated by the backend (for passwords, research parameters, or post-research actions) via `wsPrompt` and the corresponding handlers in `app/public/terminal.js`.
   - Manages distinct interaction modes ('command', 'chat', 'research', 'prompt') so prompts and long-running commands cannot strand the UI. When `RESEARCH_WS_CSRF_REQUIRED=true`, the server also rotates per-session CSRF tokens and rejects commands that omit the latest token.

3. **Research Engine & Archive**
   - `app/infrastructure/research/research.engine.mjs` coordinates breadth/depth traversal using `app/infrastructure/research/research.path.mjs` while Brave requests run through `app/infrastructure/search/search.providers.mjs` and `app/utils/research.rate-limiter.mjs`.
   - Final Markdown is produced by `buildResearchMarkdown`; when `config.research.archive.enabled` remains true the artefact is also persisted via `app/infrastructure/research/research.archive.mjs` with retention limits and size guards driven by environment variables.
   - `/research list` and `/research download <id>` surface archived artefacts across CLI and Web terminals.

4. **Telemetry & Security Surface**
   - `app/features/research/research.telemetry.mjs` emits replayable `research-status`, `research-progress`, `research-token-usage`, and `research-complete` events.
   - Aggregate token usage (prompt/completion/total) is tracked per operator through `app/features/research/research.telemetry.metrics.mjs` and exposed via `/status` and `/security`.
   - `app/commands/security.cli.mjs` reports CSRF enforcement, token budgets, and the effective depth/breadth guardrails resolved from `config.security.research`.

5. **Token Classification**
   - Optional module powered by `app/utils/token-classifier.mjs` plus `app/infrastructure/ai/venice.llm-client.mjs` to fetch enriched metadata.
   - Expands the research query object with `tokenClassification` data before handoff to query generation.
   - CLI sessions prompt for opt-in, while Web clients rely on prompts or the `--classify` flag. Failures simply log and continue with the base query.

6. **Single-User Mode**
   - No login or password flows. A single global user is used for all operations.
   - The active user is stored in `~/.bitcore-terminal/global-user.json` by default (override via `BITCORE_STORAGE_DIR`).
   - Commands `/login`, `/logout`, and `/password-change` are retained for compatibility but return informative notices.

7. **API Key Storage**
   - Brave, Venice, and GitHub credentials are saved in plaintext JSON via `app/features/auth/user-manager.mjs` or pulled from environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.).
   - `/keys set/check/test` lives in `app/commands/keys.cli.mjs` and keeps CLI/Web parity for managing credentials.

8. **Chat System with Memory**
   - `/chat` spins up an AI conversation mediated by `app/commands/chat.cli.mjs` and the Venice client.
   - Memory is optional (`--memory`, `--depth`) and handled by `app/infrastructure/memory/memory.manager.mjs`, with GitHub persistence via `app/infrastructure/memory/github-memory.integration.mjs`.
   - In-chat commands (`/exit`, `/exitmemory`, `/memory stats`, `/research …`) are parsed the same way for CLI and WebSocket flows, with Web clients informed through dedicated events such as `memory_commit`.

9. **Logging & Error Handling**
   - Uses `app/utils/research.output-manager.mjs` for broadcasting output to console and connected WebSocket clients.
   - CLI error handling via `app/utils/cli-error-handler.mjs` plus shared `wsErrorHelper` wiring for WebSocket responses.
   - Rate-limiting and retry logic live in `app/utils/research.rate-limiter.mjs`, `app/infrastructure/ai/venice.llm-client.mjs`, and `app/infrastructure/search/search.providers.mjs`.

10. **Diagnostics**
   - `/diagnose [api|perms|storage|all]` probes Brave, Venice, and GitHub connectivity plus filesystem readiness.
   - `/security status` mirrors CSRF posture, rate-limit budgets, validated depth/breadth ranges, and per-operator token usage totals.

11. **Post-Research Actions**
   - After research completes, CLI users see a menu while Web users receive the `post_research_action` prompt to choose Display, Download, Upload (GitHub), Keep, or Discard.
   - Download leverages `download_file` events, uploads flow through the GitHub research sync controller, and Web/CLI operators can revisit archived artefacts with `/research list|download`.

12. **Research Request Scheduler**
   - Node-cron worker (disabled by default) that polls the configured GitHub research repository for pending request files.
   - Configured through `app/config/index.mjs` defaults or environment variables (`RESEARCH_SCHEDULER_*`, `RESEARCH_GITHUB_*`).
   - Controlled via the `/research-scheduler` command and starts automatically when enabled for both server and CLI modes.

---

## File Structure
```plaintext
app/
   commands/
      admin.cli.mjs            – Admin-only helpers (legacy)
      chat/
         chat.cli.mjs          – Chat facade delegating to modular helpers
         chat-history.cli.mjs  – Transcript retrieval for chat sessions
      diagnose/
         diagnose.cli.mjs      – `/diagnose` health checks (API, perms, storage)
      export.cli.mjs           – `/export` helpers for saved artefacts
      index.mjs                – Command registry and CLI parser glue
      keys.cli.mjs             – `/keys` set/check/test helpers
      login.cli.mjs            – Compatibility `/login` command (no-op in single-user mode)
      logout.cli.mjs           – Compatibility `/logout` command (no-op)
      logs.cli.mjs             – `/logs` tail/download helpers
      memory.cli.mjs           – `/memory stats` and related helpers
      missions/
         missions.cli.mjs      – Mission orchestration entrypoint
      password.cli.mjs         – Compatibility `/password-change` command (no-op)
      prompts.cli.mjs          – Prompt library management
      research/
         research.cli.mjs      – `/research` CLI runner and prompts
         research.command.mjs  – Shared research execution helpers
         research-github.cli.mjs – GitHub archive helpers
         research-github-sync.cli.mjs – GitHub sync surface for stored artefacts
         research-scheduler.cli.mjs – Cron worker control surface
         research.mjs          – Research command entry-point wrapper
      security.cli.mjs         – Security posture reporting (`/security status`)
      status.cli.mjs           – `/status` reporting
      storage.cli.mjs          – Storage inspection utilities
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
         github-activity.channel.mjs – Streams GitHub activity to connected clients
         research.defaults.mjs    – Default knobs for research execution
         research.controller.mjs – Research controller used by Web routes
         research.telemetry.mjs  – WebSocket telemetry channel shared by CLI/Web
         research.telemetry.metrics.mjs – Aggregates per-run token metrics
         routes.mjs              – WebSocket command router and prompt helpers
         websocket/
            session-bootstrap.mjs – Prepares research sessions and telemetry wiring

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
         github-sync.mjs        – GitHub upload helpers for research artefacts
         research.archive.mjs   – Local archive management for saved research
         research.engine.mjs    – Research orchestration (delegates markdown to `research.markdown.mjs`)
         research.markdown.mjs  – Formats research learnings/sources into Markdown with suggested filenames
         research.override-runner.mjs – Safe override runner for research fixtures
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

Commands `/login`, `/logout`, and `/password-change` remain for compatibility but simply display informative notices in single-user mode.

## Research Pipeline

### Research Pipeline Overview

1. **Dispatch & Prompting** – CLI runs flow through `app/commands/research.cli.mjs`, WebSocket invocations through `app/features/research/websocket/command-handler.mjs`. When a WebSocket payload omits the query, the server issues an interactive `wsPrompt` before continuing. Commands are rate-limited per session and may require a CSRF token depending on configuration.
2. **Guard & Preferences** – `resolveResearchDefaults` clamps depth/breadth/visibility within configured guardrails. Invalid overrides (`--depth`, `--breadth`, `--public/--private`) are rejected before the engine spins up, and public users are prevented from launching research outright.
3. **Credential Resolution** – `resolveResearchKeys` gathers Brave, Venice, and GitHub credentials from environment variables or the single-user profile. Missing values surface explicit hints to run `/keys set`.
4. **Query Enrichment** – Optional token classification augments the query via `app/utils/token-classifier.mjs`, while `prepareMemoryContext` contributes override prompts derived from recent chat or memory sessions.
5. **Engine Execution & Telemetry** – `runResearchWorkflow` orchestrates `ResearchEngine`, which coordinates `ResearchPath` workers, Brave search, Venice summarisation, and progress events. `app/features/research/research.telemetry.mjs` streams status/progress/token usage updates to connected Web clients.
6. **Archiving & Follow-up Actions** – Markdown output is cached for `/export`. When enabled, `saveResearchArtifact` persists results to the archive directory so `/research list` and `/research download <id>` can recall past runs. Post-action prompts still offer Display, Download, Upload, Keep, and Discard options across CLI/Web.

### Core Modules

- `app/commands/research/run-workflow.mjs` – Shared orchestration for CLI and WebSocket flows.
- `app/infrastructure/research/research.engine.mjs` – Breadth/depth traversal, Markdown composition, and progress signalling.
- `app/infrastructure/research/research.path.mjs` – Per-query execution, follow-up generation, and telemetry hooks.
- `app/features/ai/research.providers.mjs` – Venice helpers for query generation, result processing, summaries, and token usage capture.
- `app/infrastructure/research/research.archive.mjs` – Durable artefact storage with retention and size guards.
- `app/features/research/research.telemetry.mjs` & `research.telemetry.metrics.mjs` – Replayable telemetry channel plus per-operator token usage aggregation.

---

## API Key Management
1. **Key Setup**
   - Use `/keys set <service> [options]` to configure credentials without editing files.
   - Brave/Venice examples: `/keys set brave <token>`, `/keys set venice <token>`.
   - GitHub requires owner, repo, token, and optional branch: `/keys set github --github-owner=<user_or_org> --github-repo=<repo> --github-token=<token> [--github-branch=<branch>]`.
   - Keys persist in `~/.bitcore-terminal/global-user.json` (plaintext) unless provided via environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.).

2. **Key Checks**
   - `/keys check` (alias `/keys stat`) reports which services have credentials configured.
   - `/keys test` exercises Brave, Venice, and GitHub integrations using the active credentials and flags actionable failures.
   - All consumers resolve credentials through `resolveResearchKeys`, ensuring CLI, Web, scheduler, and diagnostics share a single precedence chain.

3. **Encryption (Legacy)**
   - AES-256-GCM helpers remain in the repo (`app/features/auth/encryption.mjs`) but are inactive in single-user mode.
   - `/login`, `/logout`, and password prompts are retained for compatibility but currently emit informational notices instead of enforcing auth.

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
- **CSRF Guard (Web `/research`)**: Set `RESEARCH_WS_CSRF_REQUIRED=true` to require every WebSocket research command to echo the per-session token issued at handshake time. Commands missing or mismatching the token are rejected with guidance to refresh the session.

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
This README aims to accurately reflect the application state based on the provided file structure and seed content as of April 25, 2025. Key aspects verified include dual-mode operation, Web-CLI parity, server-driven interaction modes, research pipeline flow, token classification integration, authentication/encryption mechanisms, chat/memory system features, post-research actions, and file structure. **Testing the Web-CLI interaction flows, especially prompt handling and mode transitions, remains crucial—run `npm run test:webcli` for the automated sweep and `node scripts/webcli-smoke.mjs` to exercise the keep ➜ `/export` download path.**

## Live Test Checklist
Before inviting operators into a live session, walk through the smoke steps in [`guides/live-test-checklist.md`](./guides/live-test-checklist.md). The document covers environment prep, CLI/Web terminal runs, rate-limit and CSRF toggles, and cleanup reminders so the finish line stays explicit each iteration.

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
