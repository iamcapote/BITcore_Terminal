<!--
Why: Provide the detailed Nova GUI blueprint and migration sequencing for UI-first delivery.
What: GUI modernization contract, migration inventory, Nova concept scope, implementation report, and migration strategy.
How: Preserve canonical content while grouping UI blueprint and parity readiness details together.
Status: active
Last Updated: 2025-07-18
-->

# Nova GUI Blueprints & Migration

## 23) GUI Modernization Blueprint (Revision 3 Contract)

**Contract Metadata**
- **Why**: Deliver a cohesive BITcore interface that mirrors CLI capability, exposes agent telemetry, and supports multi-skin experiences without regressing velocity.
- **What**: Actionable modernization blueprint describing layout architecture, state flows, parity requirements, and milestone gates for web UI delivery.
- **How**: Translate perfected-architecture mandates and MIT exemplar patterns into a staged React/Vite implementation with shared design tokens and CLI-linked telemetry.
- **Status**: active
- **Owners**: Web Platform Team, UX-Systems Guild
- **Inputs**: `app/nova/src/App.tsx`, `app/nova/src/modules/layout/`, `app/commands/*.cli.mjs`, `guides/` and vendor exemplars
- **Outputs**: Modular shell layout, instrumentation surfaces for research/memory/mission/tool telemetry
- **Non-goals**: Multi-tenant auth; re-architecting backend transports beyond telemetry contract
- **Constraints**: CLI ↔ GUI parity; 300–500 LOC modules; WCAG 2.2 AA; FCP <2.5s on 3G

**Strategy Snapshot**
- Parity first, chat-first shell, observability-native, one engine/many skins, progressive migration
- Legacy UI Next preserved for benchmarking; rollback uses prior Nova builds or CLI-only mode instead of a day-to-day GUI feature gate
- Progressive migration is complete; Nova is default and no feature-flag gate remains in day-to-day use.

**Baseline Audit (Target Outcomes)**
| Surface | Current Pain | Target Outcome |
| --- | --- | --- |
| Shell layout | Chrome-heavy, weak responsiveness | Three-column responsive shell with focus mode |
| Command invocation | CLI-only discovery | Chat-first entry + contextual controls |
| Telemetry | Text streams | Telemetry deck with rings/sparklines/tails |
| Memory/archives | Sparse dashboards | Memory timeline + archive explorer |
| Tooling/missions | Missing MCP/tool registry | Tool dock + mission control |

**Architecture Plan (Key Points)**
- `NovaShell` (274 LOC), `LeftRail`, `SurfaceStage`, `StatusBar` with shared tokens and Lucide icons.
- Extracted layout modules: `TopBar`, `ShellMenubar`, `ThemeSwitcher`, `shellTypes`, `shellMenuData`, `surfaceRegistry`.
- 17 registered surfaces; 9 wired, 8 unwired (including new `settings`).
- 21 UI primitives: badge, button, card, checkbox, dropdown-menu, input, menubar, scroll-area, select, separator, switch, table, tabs, textarea, tooltip, dialog, skeleton, progress, avatar, alert, accordion.
- Knowledge surfaces split: VectorManager, DatabaseManager, MemoryManager (live-wired), MetricsBoard as individual files.
- Breakpoints: `<1024px` stacked tabs; `1024–1439px` collapsible deck; `>=1440px` full shell.
- Stores: `telemetryStore`, `missionStore`, `logsStore` under `app/nova/src/stores/`.
- WebSocket adapter normalizes `telemetry:*`, `agent:*`, `instrument:*` events.
- Transport consolidation: legacy DOM bridges removed; Nova talks directly to backend transports through a single adapter layer.
- Focus mode: `⌘F` (or Ctrl+F on non-mac) collapses chrome for a chat-first workspace.

**Implementation Patterns to Adopt (from codebase review)**
- **Prompt assembly**: layered prompt builder (system → profile → workspace → user) with strict token budgeting.
- **Retrieval injection**: append `<BEGIN SOURCE>…</END SOURCE>` blocks to the latest user message only.
- **Provider adapters**: per-provider message adaptation (e.g., Gemini image message packing).
- **Streaming consumption**: abortable stream readers with decoder reuse and error suppression on abort.
- **Chunking defaults**: 4k chunk / 200 overlap as baseline; make per-workspace configurable.
- **Local embedding**: browser-side embeddings (Transformers.js) as fallback in restricted deployments.
- **Secrets UX**: masked-value editor that preserves comments and renders `§§secret(KEY)` placeholders.
- **Scheduler UX**: task board with `idle|running|disabled|error` states and run/wait actions.
- **MCP status**: server cards show tool count, error state, and stream type (stdio/SSE/HTTP).
- **Streaming response flow (AnythingLLM)**: SSE `text/event-stream` with `writeResponseChunk`; finalize event carries `chatId` and `metrics`.
- **Thread auto-rename**: on first user message truncate prompt and rename thread via inline `action` event.
- **Query-mode refusal**: display workspace-configurable refusal when no context found.

**Milestones & Acceptance Gates**
- Sprint 0: plan alignment, token/ANSI mapping stub.
- Sprint 1: shell + keyboard navigation; keyboard nav audit green.
- Sprint 2: telemetry + archives; axe ≥90.
- Sprint 3: skin parity + responsive; parity script green.
- Sprint 4: mission control + tool dock; MCP connect flow.

## 24) Legacy ↔ Nova Migration Investigation (Parity Readiness)

**Goals & Constraints**
- Single application: converge on Nova; legacy stays available as a benchmark through parity verification and comparison windows.
- No adapters: port functionality natively into Nova modules.
- Preserve legacy scope: every tab/surface ships in Nova unless explicitly simplified.
- GUI-first sequencing; backend refactors follow UI lift.

**Legacy Surface Inventory (Selected)**
| Surface | Entry Point | Primary Scripts | APIs / Streams | Notes |
| --- | --- | --- | --- | --- |
| Research Terminal | `app/public/index.html` | `webcomm.js`, `command-processor.js`, `terminal/*.js`, `status/*.js` | WS `/api/research/ws`; REST `/api/preferences/terminal`, `/api/prompts/*`, `/api/status/summary` | Core CLI + telemetry + prompts + prefs |
| Research Dashboard | `app/public/research/index.html` | `research.js`, `research.ws.js`, `research.render*.js` | WS `/api/research/ws`; REST `/api/research/github/*`, `/api/prompts/search`, `/api/research/preferences` | Telemetry, GitHub activity, doc editor |
| Memory Dashboard | `app/public/memory/index.html` | `memory.js` | REST `/api/memory/*`; WS `memory_event` via `/api/research/ws` | Memory metrics and telemetry badges |
| Prompt Library | `app/public/prompts/index.html` | `prompts/*.js` | REST `/api/prompts/*`, `/api/prompts/github/*` | CRUD + GitHub sync |
| Organizer | `app/public/organizer/index.html` | `organizer/*.js` | REST `/api/missions/*` | Scheduler controls + mission list |
| GitHub Sync | `app/public/github-sync/index.html` | `github-sync/modules/*.js` | REST `/api/research/github-sync`, `/api/research/github-activity/*` | Staging uploads + activity feed |
| Chat History | `app/public/chat-history/index.html` | `chat-history.js` | REST `/api/chat/history/*` | Transcript browse/export/delete |
| Status Widget | Embedded status scripts | `status/*.js` | REST `/api/status/summary`; WS `status` payloads | Live service chips across legacy surfaces |

**Nova Surface Inventory (Expanded)**
| Surface Id | Component | Legacy Counterpart | Data Source Today | Wiring Status |
| --- | --- | --- | --- | --- |
| `terminal` | `TerminalSurface` + `TerminalProvider` | Research Terminal | Mock/placeholder | Unwired |
| `tasks` | `TasksSurface` | Organizer | Mock/placeholder | Unwired |
| `chat` | `ChatSurface` | Research chat tab | Mock/placeholder | Unwired |
| `memory` | `MemoryManagerSurface` | Memory Dashboard | Mock/placeholder | Unwired |
| `mcp` | `ComputerAsToolSurface` | Organizer tool approvals | Mock/placeholder | Unwired |
| `explorer` | `EditorSurface` | Research terminal file explorer | Mock/placeholder | Unwired |
| `vectors` | `VectorManagerSurface` | Vector panels | Mock/placeholder | Unwired |
| `databases` | `DatabaseManagerSurface` | DB inspector | Mock/placeholder | Unwired |
| `metrics` | `MetricsBoardSurface` | Status chips/telemetry | Mock/placeholder | Unwired |
| `agents` | `AgentsSurface` | Organizer agent cards | Mock/placeholder | Unwired |
| `instruments` | `InstrumentsSurface` | Organizer instruments | Mock/placeholder | Unwired |
| `logs` | `LogsSurface` | Logs viewer | Mock/placeholder | Unwired |
| `prompts` | `PromptLibrarySurface` | Prompt Library | Mock/placeholder | Unwired |
| `github-sync` | `GithubSyncSurface` | GitHub Sync | Mock/placeholder | Unwired |

**Feature Mapping Matrix (Snapshot)**
| Legacy Surface | Nova Surface | Current Status | Gaps to Close |
| --- | --- | --- | --- |
| Research Terminal shell | `terminal`, `StatusBar` | Unwired | Wire `/api/research/ws`, status summary, preferences |
| Research telemetry dashboard | ResearchSurface | Unwired | Wire `research:*` WebSocket events |
| Prompt library | New surface | Unwired | Build prompt CRUD module + GitHub sync |
| GitHub Sync | `GithubSyncSurface` | Unwired | Wire `/api/research/github-sync` + activity endpoints |
| Memory dashboard | `memory` | Unwired | Wire `/api/memory/*` + telemetry |

**Wiring Status Rules**
- `unwired`: red border/glow for stage + tab.
- `partial`: amber border/glow when mixed mock/live data.
- `wired`: no warning markers.
- Class tokens: `.is-unwired`, `.is-partial` applied to stage containers and tabs.

**Wiring Signal Plan (Operational)**
- Surface definitions carry `wiringStatus` so stage containers and tabs inherit status styling.
- Status auto-clears when wiring flips to `wired` during implementation.

**Progress Summary (2026-02-02)**
- Wiring paused while GUI-first layouts and UX surfaces are being built.
- All Nova surfaces remain **Unwired** to live data until parity wiring begins.

**Wiring details (provider-level)**:
- Planned wiring targets: `/api/research/ws`, `/api/status/summary`, `/api/missions/*`, `/api/logs/*`, `/api/prompts/*`, `/api/research/github-sync`, `/api/memory/*`.
- No live integrations are active yet.

**Sequencing Roadmap**
1) Terminal + Research dashboard parity.
2) Missions + scheduler controls.
3) GitHub activity + staging panels.
4) Prompt library + cross-surface prompt tools.
5) Memory dashboard + telemetry.
6) Specialized widgets (vectors, MCP, explorer).

## 29) Nova Concept & Feature Scope (Legacy Signals)

**Core Philosophy (Nova)**
- Modular, themeable, agent-centric UI where console = chat and chat = console.
- Single-user posture: one operator, admin role; no multi-user UI routes.

**Synthesized Layout Sources**
| UI Element | Blueprint Source | Rationale |
| --- | --- | --- |
| Core foundation | `vscodefork.md` | Base structure using `shadcn/ui` |
| Left sidebar | `vsagentic.md` | Activity bar + sidebar split |
| Iconography | `novaide.md` | Clear action-oriented icons |
| Center panel | `vscodefork.md` | Tabbed editor with chat/console |
| Right panel | `vscodefork.md` | Inspector for tool metadata |
| Bottom panel | `novaide.md` | Terminal/Tasks/Logs tabs |
| Status bar | `vsfork.md` | Agent + environment indicators |

**Feature Integration (Vendor Signals)**
- Agent Zero: computer-as-tool, prompt/agent management, instruments.
- Vector Admin: vector store administration.
- Superfile: keyboard-first navigation.
- Deerflow: modern chat components and telemetry UI.
- Legacy GUI: missions/tasks as dedicated views.
- Chatbot-UI: multi-model conversations (compare side-by-side), assistant builder (instructions + files + tools), collection-based knowledge organization, prompt templates, presets (model + temp + system prompt).
- Chatbot-UI state: Context providers for chat, workspace, global, modal; hooks (`useChatHandler`, `useSelectFileHandler`, `usePromptAndCommand`).

**OpenAI Swarm integration patterns (OpenAI-Swarm-derived)**
- Delegation status panel: list active child runs with `assistant.name`, status, playground link.
- Fan-out progress: show parallel child executions in timeline view; aggregate on completion.
- Event log: display `poll_event` stream (`parent_run_created`, `child_run_created`, `child_run_concluded`).
- Traceability drill-down: click child run to view thread metadata (`delegatedBy`, `viaFunc`, `toAssistant`).

**Semantic Flow auth/SSE patterns (Semantic-Flow-derived)**
- Session indicator: show JWT expiry countdown; auto-refresh or prompt re-login.
- SSO redirect flow: `/api/sso/login` → provider → callback; session cookie + CSRF token set.
- SSE reconnect: EventSource with heartbeat detection; auto-reconnect on disconnect.
- Build/version banner: subscribe to `/api/meta/version/stream` for hot-reload notifications.

**ChatGPT-UI streaming patterns (ChatGPT-UI-derived)**
- `fetchEventSource` from `@microsoft/fetch-event-source` for SSE consumption.
- Message queue with typewriter effect: `processMessageQueue` pops chunks and appends with configurable delay.
- Abort controller: `ctrl.abort()` cancels in-flight fetch; `fetchingResponse` ref tracks state.
- Event types: `error` (show snackbar), `userMessageId` (set ID), `done` (finalize + gen title).
- Title generation: `genTitle(conversationId)` calls `/api/gen_title/` after first exchange.
- Web search toggle: `enableWebSearch` ref; tool args injected into message payload.
- Message actions: `deleteMessage(index)`, `toggleMessage(index)` for disable/enable.
- Scroll behavior: `scrollChatWindow()` via `scrollIntoView({ behavior: 'smooth' })` on grab ref.

**Chatbot-UI prompt and retrieval patterns (Chatbot-UI-derived)**
- `buildFinalMessages` constructs system prompt with profile context, workspace instructions, assistant persona.
- Token budget: `CHUNK_SIZE - PROMPT_TOKENS` leaves remaining tokens for message history.
- Message truncation: iterate from newest; include messages until token budget exhausted.
- Retrieval injection: `buildRetrievalText(fileItems)` appends RAG context to preceding user message.
- Image handling: `image_paths` converted to base64 `image_url` content blocks.
- Abort controller: `abortController.abort()` cancels in-flight fetch; ref tracks `isGenerating` state.
- Tool mode: if `selectedTools.length > 0`, post to `/api/chat/tools` endpoint.
- Local vs hosted: `handleLocalChat` (Ollama) vs `handleHostedChat` (OpenAI-compatible).
- Edit handling: `deleteMessagesIncludingAndAfter` truncates history; re-send from edit point.

**Stream consumption patterns (Chatbot-UI-derived)**
- `consumeReadableStream(stream, callback, signal)` reads chunks via `reader.read()`.
- Decoder: `new TextDecoder()` with `{ stream: true }` for incremental decoding.
- Abort listener: `signal.addEventListener('abort', () => reader.cancel())`.
- Lock release: `reader.releaseLock()` in finally block.

**Roadmap Features (Nova Concept)**
- Integrated web browser tab (headless/visual) for agent web navigation.
- Multi-workspace support (create/load/switch from sidebar).
- Knowledge/Vector DB UI + document ingestion UI + hot-directory service.

## 30) Nova Implementation Report (2025-10-28 Cutover)

**Status**: Nova shell promoted to canonical GUI; legacy UI retained for benchmarking and historical comparison.

**Delivered Modules (File-Level)**
- Design system: `app/nova/src/styles/globals.css`, `app/nova/tailwind.config.ts`.
- Shell layout: `app/nova/src/modules/layout/NovaShell.tsx`, `useSurfaceManager.ts`, `StatusBar.tsx`.
- Navigation: `LeftRail.tsx`, `ExplorerTree.tsx`, `EditorSurface.tsx`.
- UI primitives: `button.tsx`, `card.tsx`, `badge.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`.
- Inputs: `input.tsx`, `textarea.tsx`, `select.tsx`.
- Terminal + operations surfaces: `TerminalContext.tsx`, `OperationsSurfaces.tsx`, `AgentSurfaces.tsx`.
- Entry: `App.tsx`, `main.tsx`.

**Verification Log**
- `pnpm run "nova:build"` succeeded (2025-10-28).

## 30.1) Nova Implementation Details (Completion Report Signals)

**Design system highlights**
- HSL token map for background, surface, accent, and status colors (light/dark) with shared radius token.
- Tailwind config exports tokens and shadcn presets for button/card/input primitives.
- Global focus-visible outlines and terminal-inspired selection styling.

**Shell + surface manager highlights**
- `NovaShell` orchestrates Studio/Wing/Dock placements with chat-first defaults and layout presets.
- `useSurfaceManager` normalizes surface definitions, tracks placements, and activates panes on demand.
- `StatusBar` renders research telemetry, token summaries, log health, branch metadata, and layout mode switcher.

**Navigation + explorer highlights**
- Left rail groups surfaces by domain, supports placement switching, and mirrors CLI command badges.
- Explorer tree renders mock workspace files with Lucide icons aligned to CLI navigation structure.

**Inputs + primitives highlights**
- Inputs expose focus states, size variants, and disabled styling aligned with terminal prompts.
- Cards, badges, and tooltips share typography and spacing tokens with Nova grids.

**Terminal + operations highlights**
- `TerminalProvider` manages command history, running command list, and prompt text for studio surfaces.
- Operations views demonstrate task board, terminal tail, and instrument controls via mock data.

**Integration**
- `App.tsx` wraps the shell with `TerminalProvider` for unified command dispatch.
- `main.tsx` bootstraps Vite app, applies global styles, and mounts the Nova root node.

## 31) Migration Strategy: UX Debt, Blockers, and Trackers

**Dual GUI state (operational)**
| Surface | Command | Status | Summary |
| --- | --- | --- | --- |
| Port 3000 (legacy) | `pnpm run start` | Active | Feature-complete but cluttered, inconsistent tokens, weak hierarchy, minimal responsiveness. |
| Port 5173 (Nova) | `pnpm run ui:dev` | Active | Modern shell foundation; missing key feature wiring and transport parity. |

**Port 5173 blockers (blank canvas gaps)**
| Feature | Blocker Type | Effort | Dependency |
| --- | --- | --- | --- |
| Shell layout | Architecture | Medium | Vendor patterns |
| Research telemetry | Transport | High | WebSocket schema alignment |
| Chat interface | UI/Logic | High | Streaming + memory context |
| Memory timeline | UI/Logic | Medium | Memory manager integration |
| Settings panel | UI/Logic | Low | Config endpoint hookup |
| Theme switching | UI/Logic | Low | Token system expansion |
| Responsive layout | CSS | Medium | Breakpoint testing |
| Keyboard navigation | Accessibility | Medium | Focus management |
| Mobile support | CSS/UX | Medium | Drawer patterns |

**Legacy UX Debt**
- No token system, inconsistent spacing/typography, weak responsiveness.
- Hardcoded models, no MCP/computer system support.

**Nova Blockers (from strategy audit)**
- Telemetry transport alignment, chat streaming, memory timeline, settings drawer, keyboard navigation, mobile support.

**Migration Phases (Port 3000 → 5173)**
- Phase 1: shell + keyboard navigation + WebSocket transport; FCP <2.5s.
- Phase 2: telemetry, memory timeline, logs tail, archive explorer.
- Phase 3: CLI parity, settings drawer, mission board, MCP dock.
- Phase 4: bundle budget, WCAG 2.2 AA, skin parity, rollout.

**Feature Trackers (Legacy → Nova)**
- Research: form, query builder, progress, token gauge, results, archive browser.
- Chat: message display, memory context, in-chat commands, timeline.
- Settings: keys, theme switcher, config, preferences.
- Missions: list, kanban, intervention controls.
- Observability: logs tail/filter, token metrics, event timeline.

## 31.1) Migration Risks & Immediate Actions (Strategy Signals)

**Risk register**
- Feature flag complexity → keep booleans simple; avoid cross-surface coupling.
- WebSocket schema drift → generate TypeScript schemas and add contract tests.
- Accessibility regression → weekly axe audits and keyboard checks.
- Bundle bloat → bundle analyzer + lazy-load skins.
- Operator confusion → migration guide + clear in-app messaging.

**Immediate actions (backend)**
- Add `GET /api/commands` endpoint with CLI metadata export and validation.
- Align WebSocket telemetry discriminants (`research:*`, `memory:*`, `logs:*`) and ensure `correlationId` + timestamp on every event.
- Run axe scan on legacy UI and fix blocking WCAG failures before deprecation.

**Immediate actions (frontend)**
- Run responsive grid audit at 320/768/1024/1440 with focus mode validation.
- Expand theme tokens for hover/active/disabled/error/success states across skins.

**Immediate actions (testing)**
- Generate parity matrix report in CI for CLI ↔ GUI surface coverage.
- Add Vitest coverage for store logic and WebSocket event parsing.
