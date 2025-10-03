# Deep Research Pipeline – Technical Guide

Authoritative reference for the BITcore deep-research flow across CLI and Web terminals. Reflects the codebase on **1 Oct 2025**.

For roadmap-level planning of retrieval and RAG enhancements, see [`guides/retrieval-roadmap.md`](./retrieval-roadmap.md).

---

## 1. Architectural Overview

| Layer | Modules | Responsibility |
| --- | --- | --- |
| Entry points | `app/commands/research.cli.mjs`, `app/features/research/routes.mjs`, `app/commands/chat/chat.research.mjs` | Collect user intent/flags, resolve prompts, and forward to the orchestration helpers. |
| Orchestration | `executeResearch` (CLI command), `prepareMemoryContext`, `enrichResearchQuery` | Guard inputs, pull credentials, enrich the query, and compose the engine configuration. |
| Engine | `app/infrastructure/research/research.engine.mjs` | Instantiate `ResearchPath` workers, coordinate breadth/depth execution, aggregate results, and format Markdown. |
| Path worker | `app/infrastructure/research/research.path.mjs` | Run Brave searches, manage follow-up questions, collate learnings/sources. |
| Providers | `app/features/ai/research.providers.mjs` (currently broken), `app/infrastructure/search/search.providers.mjs`, `app/utils/token-classifier.mjs` | Generate initial queries & summaries with Venice and bridge to Brave search. |
| Output plumbing | `app/utils/research.output-manager.mjs`, `app/utils/websocket.utils.mjs` | Mirror output/progress between CLI stdout and WebSocket clients. |
| Post-actions | `app/commands/research.github-sync.cli.mjs`, `app/features/research/github-sync/service.mjs` | Handle optional uploads/downloads for completed research artifacts. |

> ⚠️ **Provider status**: `research.providers.mjs` still contains placeholder exports. Everything importing it will fail import analysis until the shim is replaced with the implementation in `research.providers.service.mjs` (see `guides/gaps.md`).

---

## 2. Execution Flow (CLI & Web)

1. **Dispatch**
   - CLI command router or WebSocket handler recognises `/research` and invokes `executeResearch` with parsed flags (`--depth`, `--breadth`, `--classify`, `--public`, `--verbose`).
   - WebSocket sessions without an explicit query now trigger an immediate `wsPrompt` asking the operator to supply the research question before continuing; the trimmed response is injected back into the command payload.
   - Prompt cancellations or timeouts surface a user-facing `wsErrorHelper` notice so operators know the research flow was aborted before the engine starts.
   - WebSocket `/research` commands are rate-limited (3 per second per session) to prevent accidental flooding; exceeding the limit returns a retry-after message.
   - Optional CSRF enforcement (`RESEARCH_WS_CSRF_REQUIRED=true`) requires each command payload to echo the per-session token broadcast at connection time, blocking mismatched requests.
   - Chat conversations call the same helper through `startResearchFromChat`.

2. **Guard**
   - Resolve research preferences via `resolveResearchDefaults` (depth/breadth/visibility, range-clamped to 1–6).
   - Validate the user is not the special `public` role (single-user mode ships as `operator`).
   - Prompt for a password if required by downstream flows (legacy hook – currently the password is unused but still cached for compatibility).

3. **Credential resolution**
   - `resolveResearchKeys` pulls Brave/Venice tokens from the in-memory cache, the single-user profile (`global-user.json`), or environment variables.
   - Missing keys short-circuit the command with actionable error messages.

4. **Query enrichment**
   - Optional Venice token classification via `enrichResearchQuery` populates `query.metadata` with entities/intent tags.
   - Memory context from `prepareMemoryContext` supplies override queries from recent conversations (limit 5 records).

5. **Engine configuration**
   - Combine query metadata, override queries, user info, telemetry channels, and handlers into an engine config.
   - Instantiate `ResearchEngine`, attach progress and debug emitters (WebSocket sessions relay JSON events, CLI prints text).

6. **Execution**
   - `ResearchEngine.research({ query, depth, breadth })` builds `ResearchPath` instances per breadth slot.
   - Each path performs Brave fetches, follow-up generation, deduplication, and synthesis via Venice.
   - The engine aggregates learnings, sources, and summary; it also renders Markdown and suggests a filename.
   - When no learnings survive filtering, the engine emits a fallback summary explaining the empty result instead of surfacing an error to the operator.

7. **Post-action**
   - CLI prints the Markdown, caches the artefact in memory for `/export` (and forthcoming storage commands), and returns structured metadata.
   - WebSocket flow stores results in the session, caches the trimmed query for follow-up actions, emits `research_complete`, and prompts for `post_research_action` (Display / Download / Upload / Keep / Discard).

---

## 3. Core Modules

### `executeResearch` (CLI/Web shared)
- File: `app/commands/research.cli.mjs`
- Responsibilities: guard options, prompt for credentials, gather preferences, fetch keys, call enrichment/memory helpers, instantiate the engine, and manage post-run prompts.
- Important behaviours:
   - Prompts for passwords only if the vault is enabled or the user is not `admin` (single-user mode skips password prompt by default).
  - Streams progress via supplied handlers; Web sessions keep input disabled until post-action concludes.
   - Validates WebSocket CSRF tokens when enabled to prevent forged command submissions.
   - Clears cached WebSocket session result/query state when failures occur so follow-up actions do not reuse stale content.

### `ResearchEngine`
- File: `app/infrastructure/research/research.engine.mjs`
- Capabilities: orchestrates breadth/depth loops, manages shared state (visited URLs, deduped learnings), and emits telemetry. Accepts optional override queries and merges them with classifier/memory enrichment.
- Output: `{ summary, learnings[], sources[], markdownContent, suggestedFilename, success }`.

### `ResearchPath`
- File: `app/infrastructure/research/research.path.mjs`
- Steps: prepare query objects → execute breadth searches → spawn depth follow-ups → re-run Brave → synthesise summary/learnings → report progress.
- Error handling: classifies provider/network issues, retries with backoff, and bubbles fatal errors to the engine.

### `token-classifier.mjs`
- File: `app/utils/token-classifier.mjs`
- Provides `callVeniceWithTokenClassifier`. Takes raw query text and returns structured metadata (entities, queries, guardrails). Failures are logged but non-fatal; the pipeline continues with the base query.

### Memory integration
- `prepareMemoryContext` (in `app/commands/research/memory-context.mjs`) inspects the memory service for recent insights aligned with the current query and produces override prompts. These are appended to the engine config when available.

---

## 4. Configuration & Secrets

- **API keys**: Brave and Venice tokens live in `~/.bitcore-terminal/global-user.json` (plaintext) or can be injected via environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `VENICE_PUBLIC_API_KEY`). Always go through `resolveResearchKeys` to honour the precedence rules.
- **GitHub uploads**: Require `owner`, `repo`, `branch`, and a Personal Access Token on the single-user profile. `/keys set github ...` writes these fields, and uploads are blocked until all four values are present.
- **CSRF enforcement**: Set `RESEARCH_WS_CSRF_REQUIRED=true` to force every WebSocket `/research` command to include the per-session token returned during the handshake. Mismatched or missing tokens are rejected immediately so operators must refresh or reconnect before retrying.
- **Preferences**: Research defaults persist in `~/.bitcore-terminal/research-preferences.json`. The CLI respects stored values whenever flags are omitted; the Web UI exposes sliders/toggles for the same document.
- **Telemetry**: The engine accepts an optional telemetry channel (Web terminal uses `app/features/research/research.telemetry.mjs`) to emit `status`, `thought`, and `progress` events.

---

## 5. CLI vs Web Behaviour

| Concern | CLI | Web terminal |
| --- | --- | --- |
| Prompts | `singlePrompt` (readline) handles password/query prompts. | `wsPrompt` sends prompt envelopes; client renders modal/toggler UI. |
| Progress | Text streaming via `output()`; optional verbose logs. | JSON messages → `app/public/terminal.research.handlers.js`, rendered in the progress panel. |
| Post-action | Text menu or explicit `/export` command; CLI cache cleared after export unless `--keep` is passed. | Prompt context `post_research_action` with buttons (Download/Upload/Keep/Discard) plus `/export` for parity. |
| Session persistence | Results printed immediately; operator must copy/save manually. | Results cached on the socket session for follow-up actions (download/upload) and cleared afterward. |

Both surfaces share the same orchestration code path; only the prompt/output handlers differ.

### `/export` command (CLI & Web)
- **Purpose**: Persist the most recent research artefact without re-running the engine. CLI runs write to disk; Web sessions trigger a `download_file` payload that the browser saves locally.
- **Usage**: `/export [optional-filename] [--keep] [--overwrite]`. Filenames may be relative (stored under `~/.bitcore-terminal/research`) or absolute paths; `.md` is appended automatically if omitted.
- **Keep semantics**: By default the cached artefact is cleared after export. Pass `--keep` when you plan to re-export (for example, once to disk and once to GitHub via the forthcoming `/storage` helpers).
- **Overwrite guard**: Existing files remain untouched unless `--overwrite` is set, preventing accidental clobbering during iterative runs.

### `/storage` command suite (CLI & Web)
- **Purpose**: Interact with the GitHub-backed research library without leaving the terminal. Pairs with `/export`—keep the result, then `/storage save <path>` to commit it.
- **Primary actions**:
   - `/storage list [path] [--json]` enumerates artefacts (defaults to the `research/` directory).
   - `/storage get <path> [--out=local.md] [--overwrite]` fetches an artefact. Web sessions receive a `download_file` event; CLI can print or save locally.
   - `/storage save <path> [--keep] [--message="..."]` uploads the cached research markdown (CLI cache or Web session). Clears the cache unless `--keep` is provided.
   - `/storage delete <path> [--message="..."]` removes artefacts when clean-up is required.
- **Commit hygiene**: Messages default to `Research results for query: ...` using the cached query/summary. Override with `--message` when batching uploads.
- **Requirements**: GitHub owner/repo/branch/token must be configured (`/keys set github`). The controller rejects relative paths containing `..` to guard against traversal.

---

## 6. Testing & Current Status

Automated coverage (Vitest):

- `tests/research-engine.test.mjs` – Engine orchestration contracts.
- `tests/research-pipeline.test.mjs` – High-level pipeline behaviour.
- `tests/provider.test.mjs`, `tests/brave-provider.test.mjs`, `tests/brave-search-provider.test.mjs` – Brave provider integration.
- `tests/token-classifier.test.mjs` – Venice classifier scaffold.
- `app/tests/research.test.mjs` – Controller helper smoke test (mocks engine).

> **Heads-up:** All suites that import `research.providers.mjs` currently fail with `vite:import-analysis` due to the placeholder exports. Fixing the provider shim is prerequisite to reliable CI.

Manual smoke checklist (after the provider fix):

```bash
npm start -- cli
/status
/keys check
/research "Impact of solar storms on undersea cables" --depth=2 --breadth=2 --classify=true
```

```bash
npm start
# Navigate to http://localhost:3000 and run /research from the terminal UI (optionally toggle classifier in the sidebar).
```

---

## 7. Known Gaps & Follow-ups

- **Provider module**: Replace the placeholder `research.providers.mjs` with the implementation from `research.providers.service.mjs` (or adjust imports) to restore tests and command functionality.
- **Password prompts**: `/research` still prompts for a password despite plaintext key storage. Streamline once encryption is reinstated or remove the prompt when the vault remains disabled.
- **HTTP endpoint**: `POST /api/research` returns `501`. Decide whether to implement authenticated research over HTTP or retire the route to avoid confusion.
- **Multi-user readiness**: Engine currently assumes single-user mode (no per-user vault). Revisit when multi-user requirements return.

---

## 8. Research Request Scheduler

The scheduler expands the research stack by polling GitHub for structured research requests and handing them to operators or downstream workers.

### Architecture

| Layer | Module | Responsibility |
| --- | --- | --- |
| Config | `app/config/index.mjs` | Reads `research.scheduler` and `research.github` defaults from env variables. |
| Fetcher | `app/features/research/github-sync/request.fetcher.mjs` | Lists files in `requests/`, parses JSON/plaintext payloads, filters pending tasks. |
| Scheduler | `app/features/research/github-sync/request.scheduler.mjs` | Wraps node-cron around the fetcher, enforces sequential execution, records state snapshots. |
| Wiring | `app/features/research/github-sync/index.mjs` | Exposes singleton helpers (`getResearchRequestScheduler`, `getResearchSchedulerConfig`). |
| Bootstrap | `app/start.mjs` | Starts the scheduler automatically when `RESEARCH_SCHEDULER_ENABLED=true` (server & CLI). |

### Request Format

- **JSON**: `{ "query": "Explore fusion reactors", "depth": 3, "breadth": 2, "status": "pending", "metadata": { ... } }`
- **Plaintext**: file contents become the `query`; metadata defaults are inferred.
- Allowed statuses considered pending: `pending`, `new`, `open`. Anything else is skipped.

### CLI & Web Controls

- `/research-scheduler status` – Inspect the latest snapshot, including last run timestamps and totals.
- `/research-scheduler run` – Trigger an immediate fetch cycle (`trigger=manual`).
- `/research-scheduler start|stop` – Toggle the cron worker at runtime (respects configured timezone and cron expression).

The command is available in both CLI and web terminals, satisfying parity requirements. Future enhancements can hook the handler into the research pipeline or archive processed files using `RESEARCH_GITHUB_PROCESSED_PATH`.

---

Keep this guide in sync with the pipeline whenever we adjust providers, introduce new post-actions, or modify the command surface. Update the related docs (`guides/flags.md`, `guides/tokenclassifier.md`, `README.md`) in tandem for consistency.
    C --> D[Error System]
    D --> E[State Controller]
```

Implementation:
- Secure API management
- Rate control optimization
- Token usage monitoring
- State management system
- Recovery mechanisms
