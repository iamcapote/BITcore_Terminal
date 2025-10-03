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

7. **Post-action**
   - CLI prints the Markdown and returns success metadata.
   - WebSocket flow stores results in the session, caches the trimmed query for follow-up actions, emits `research_complete`, and prompts for `post_research_action` (Display / Download / Upload / Discard).

---

## 3. Core Modules

### `executeResearch` (CLI/Web shared)
- File: `app/commands/research.cli.mjs`
- Responsibilities: guard options, prompt for credentials, gather preferences, fetch keys, call enrichment/memory helpers, instantiate the engine, and manage post-run prompts.
- Important behaviours:
  - Prompts for passwords even in single-user mode (legacy compatibility). Upcoming work should short-circuit this when the vault is disabled.
  - Streams progress via supplied handlers; Web sessions keep input disabled until post-action concludes.

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
- **GitHub uploads**: Require `owner`, `repo`, `branch`, and optionally `token` on the same single-user profile. `/keys set github ...` writes these fields.
- **Preferences**: Research defaults persist in `~/.bitcore-terminal/research-preferences.json`. The CLI respects stored values whenever flags are omitted; the Web UI exposes sliders/toggles for the same document.
- **Telemetry**: The engine accepts an optional telemetry channel (Web terminal uses `app/features/research/research.telemetry.mjs`) to emit `status`, `thought`, and `progress` events.

---

## 5. CLI vs Web Behaviour

| Concern | CLI | Web terminal |
| --- | --- | --- |
| Prompts | `singlePrompt` (readline) handles password/query prompts. | `wsPrompt` sends prompt envelopes; client renders modal/toggler UI. |
| Progress | Text streaming via `output()`; optional verbose logs. | JSON messages → `app/public/terminal.research.handlers.js`, rendered in the progress panel. |
| Post-action | Text menu, manual selection. | Prompt context `post_research_action` with buttons (Download/Upload/Keep/Discard). |
| Session persistence | Results printed immediately; operator must copy/save manually. | Results cached on the socket session for follow-up actions (download/upload) and cleared afterward. |

Both surfaces share the same orchestration code path; only the prompt/output handlers differ.

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
