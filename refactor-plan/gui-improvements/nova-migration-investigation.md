# Nova GUI Migration Investigation

> **Status (2025-11-10)**: Phase 1 complete - Terminal, Research, Status, Chat, Missions, and Memory telemetry fully wired. Phase 2 in progress - GitHub Sync, Logs, Prompts, and Tasks surfaces wired; Instruments pending.

## Goals & Constraints
- **Single application**: converge on the Nova interface; legacy GUI stays operational only until feature parity is verified.
- **No adapters**: port functionality natively into Nova modules; avoid temporary bridging layers or duplicated business logic.
- **Preserve legacy scope**: every existing tab/surface must ship in Nova unless there is an explicit simplification win.
- **GUI-first sequencing**: focus investigation on front-end coverage; backend refactors follow the UI lift.
- **Operator clarity**: expose in-progress surfaces visibly (temporary red treatment) while we migrate features.

## Investigation Tracks
1. **Legacy Surface Audit**
   - Map each legacy tab located under `app/public` and note related scripts/styles.
   - Capture data dependencies: REST endpoints, WebSocket topics, local storage, static assets.
   - Document manual user flows that must remain intact.
2. **Nova Surface Inventory**
   - Catalog implemented Nova modules in `app/nova/src/modules` and track whether they already cover a legacy feature.
   - Identify gaps where mock data must be replaced with live integrations.
3. **Feature Mapping Matrix**
   - Produce a per-surface table (legacy → Nova) with columns: status (unwired/red | in-progress | wired), dependencies, notes on refactor opportunities.
4. **Interaction Contracts**
   - Review terminal command bus (`TerminalProvider`, CLI integration) and status telemetry to ensure Nova uses the canonical logic.
   - Verify navigation, menus, and surface placement expectations for each tab.
5. **Styling & Status Signals**
   - Define a shared `is-unwired` class token + Nova store flag for unfinished surfaces.
   - Draft visuals (red border/badge) and removal criteria when a surface is wired.
6. **Sequencing & Risk Log**
   - Rank surfaces by dependency weight (terminal, status, memory, prompts, etc.).
   - Capture risks (e.g., WebSocket-only flows, cross-surface shared state) and mitigation ideas.

## Legacy Surface Inventory (Step 1 complete)
| Surface | Entry Point | Primary Scripts | APIs / Streams | Notes |
| --- | --- | --- | --- | --- |
| Research Terminal | `app/public/index.html` | `webcomm.js`, `command-processor.js`, `terminal/*.js`, `status/*.js` | WebSocket `/api/research/ws`; REST `/api/preferences/terminal`, `/api/prompts/*`, `/api/status/summary` | Core CLI surface, drives telemetry, prompt selectors, preferences panel. |
| Research Dashboard | `app/public/research/index.html` | `research.js`, `research.ws.js`, `research.render*.js`, `research.github.js`, `research.prompts.js` | WebSocket `/api/research/ws`; REST `/api/research/github/*`, `/api/prompts/search`, `/api/research/preferences` | Synthesizes telemetry, GitHub activity, document editor; shares WebComm singleton with terminal. |
| Memory Dashboard | `app/public/memory/index.html` | `memory.js` | REST `/api/memory/stats`, `/api/memory/store`, `/api/memory/recall`; WebSocket `memory_event` via `/api/research/ws` | Tracks memory metrics, store/recall flows, real-time telemetry badges. |
| Prompt Library | `app/public/prompts/index.html` | `prompts/*.js` | REST `/api/prompts`, `/api/prompts/search`, `/api/prompts/github/*` | CRUD for prompt catalog plus GitHub sync actions. |
| Self Organizer | `app/public/organizer/index.html` | `organizer/*.js` | REST `/api/missions/*`; scheduler actions `/api/missions/{start,stop,tick}` | Scheduler controls, mission list, prompt quick-pick; heavy DOM orchestration. |
| GitHub Sync | `app/public/github-sync/index.html` | `github-sync/modules/*.js` | REST `/api/research/github-sync`, `/api/research/github-activity/*`, `/api/missions/*` | Dashboard for staging uploads, activity feed, mission integration. |
| Chat History | `app/public/chat-history/index.html` | `chat-history.js` | REST `/api/chat/history`, `/api/chat/history/:id`, `/api/chat/history/:id/export`, delete endpoints | Transcript browser with retention policy banner and export/delete actions. |
| Status Widget | Embedded via `app/public/status/*.js` | `status/status.client.js`, `.dom.js`, `.bootstrap.js` | REST `/api/status/summary`; listens for WebSocket `status` payloads when present | Provides live chip states for Venice, memory, logs, telemetry across terminal-based UIs. |

### Key Legacy Observations
- WebSocket traffic for research, terminal, and memory dashboards is centralized on `/api/research/ws` with typed messages (`research-progress`, `memory_event`, `command`, etc.).
- REST endpoints are tightly scoped per surface; no shared adapter layer exists today, so Nova must call these APIs directly once it inherits the surfaces.
- Organizer and GitHub Sync share mission endpoints; prompt flows appear in both Research and Organizer, reinforcing the need for a reusable prompt client in Nova.
- Status scripts expect DOM nodes injected in `index.html`; when migrating, Nova needs a composable status client rather than DOM lookups.

## Nova Surface Inventory (Step 2 complete)
| Surface Id | Component | Legacy Counterpart | Data Source Today | Wiring Status |
| --- | --- | --- | --- | --- |
| `explorer` | `EditorSurface` | Research Terminal file explorer (planned) | Hard-coded mock tree | Unwired |
| `vectors` | `VectorManagerSurface` | Research/GitHub vector panels | `mockWorkspace.vectorStores` | Unwired |
| `databases` | `DatabaseManagerSurface` | Research DB inspector | `mockWorkspace.databaseConnections` | Unwired |
| `memory` | `MemoryManagerSurface` | Memory Dashboard | `mockWorkspace.memorySpaces` | Unwired |
| `metrics` | `MetricsBoardSurface` | Status chips / telemetry | `mockWorkspace.workspaceMetrics` | Unwired |
| `agents` | `AgentsSurface` | Organizer agent cards (future) | `mockWorkspace.agentProfiles` + `agentActivity` | Unwired |
| `instruments` | `InstrumentsSurface` | Organizer instruments | `mockWorkspace.instruments` | Unwired |
| `tasks` | `TasksSurface` | Organizer mission board | `/api/missions` via MissionsProvider | Wired |
| `terminal` | `TerminalSurface` + `TerminalProvider` | Research Terminal | WebComm `/api/research/ws` + prompt bridge | Wired |
| `mcp` | `ComputerAsToolSurface` | Organizer tool approvals | `mockWorkspace.mcpServers` + local guardrail toggles | Unwired |
| `chat` | `ChatSurface` | Research chat tab | Local React state only | Unwired |

## Feature Mapping Matrix (Step 3 complete)
| Legacy Surface | Nova Surface | Current Status | Gaps to Close |
| --- | --- | --- | --- |
| Research Terminal shell, status chips, preferences | `terminal`, `metrics`, `explorer`, `StatusBar` | Wired | ✅ Complete - TerminalConsole wired to `/api/research/ws`, StatusProvider consuming status summary, ResearchPreferencesProvider integrated. |
| Research telemetry dashboard (progress/thoughts/memory) | ResearchSurface, StatusBar | Wired | ✅ Complete - ResearchProvider consuming research-* WebSocket events (status, progress, thoughts, memory, suggestions), rendering live telemetry cards. |
| Memory dashboard (store/recall + telemetry) | `memory` | Unwired | Replace mocks with `/api/memory/*` clients; reuse Terminal telemetry handlers for shared events. |
| Prompt library | Likely new surface under knowledge or operations | Unwired | Build prompt CRUD module leveraging legacy `promptApi`; add dual-surface parity (library + organizer quick-pick). |
| Organizer (scheduler, missions, prompts) | MissionsSurface, `tasks`, `instruments` | Partial | ✅ Missions complete - MissionsProvider wired to `/api/missions/*` with scheduler controls (start/stop/tick) and TasksSurface reusing mission columns; remaining: wire the instruments panel to real data. |
| GitHub Sync dashboard | Future Nova surface (operations wing) | Unwired | Port dashboard Remote/View modules into React, share mission + prompt stores. |
| Chat history viewer | `chat` (ChatHistoryPanel) | Wired | ✅ Complete - ChatHistoryPanel integrated with live `/api/chat/history/*` endpoints; supports list/detail/export/delete operations. |
| Status widget | `StatusBar` | Partial (live summary wired) | StatusProvider now consumes `/api/status/summary` and WebComm `status-summary` events; remaining work: surface preferences metrics. |

## Wiring Signal Plan (Step 4 complete)
- **State flag**: `WiringStatus = 'unwired' | 'partial' | 'wired'` added to `SurfaceDefinition`/`SurfaceState`. Defaults to `unwired` until connected to live data.
- **Class tokens**:
  - `.is-unwired`: red highlight (border + subtle glow) applied to active stage containers and tab pills when a surface is entirely mock/unconnected.
  - `.is-partial`: amber highlight for surfaces with mixed mock/live data while migrations happen.
- **Display rules**:
  - Active stage inherits the appropriate class based on the active surface status.
  - Tab buttons show the same emphasis so operators can see readiness even when collapsed.
  - Status flag clears automatically once a surface’s `wiringStatus` property is updated to `wired` during implementation work (no manual DOM toggling).

## Sequencing Roadmap (Step 5 complete)
1. **Terminal + Research Dashboard Parity**: Port the CLI command bus, research WebSocket handlers, status summary, preferences, and the legacy research dashboard cards into Nova so operators can abandon the old shell without losing core workflows.
2. **Missions, Organizer, and Scheduler Controls**: Migrate the self-organizer surfaces (mission lists, scheduler start/stop/tick, instrument panes) to Nova modules using the real `/api/missions/*` endpoints and shared mission state.
3. **GitHub Activity & Staging Dashboards**: Bring over the GitHub sync/staging panels, activity feeds, and mission hand-offs so deployment flows live in Nova alongside organizer data.
4. **Prompt Library & Cross-Surface Prompt Tools**: Rebuild the prompt CRUD and search experience, wire organizer quick-picks, and share a prompt client across terminal, organizer, and research views.
5. **Memory Dashboard & Telemetry Panels**: After the high-traffic flows land, replace memory mocks with live `/api/memory/*` integrations and hook telemetry badges into the shared WebSocket stream.
6. **Specialized Widgets**: Migrate remaining niche widgets (document viewers, status diagnostics), and clear the final `unwired` flags before retiring the legacy GUI. (Chat history already complete.)

## Risks & Mitigations
- **WebSocket message drift**: Legacy WebComm expects specific payload shapes; Nova integrations must mirror types or centralize parsing to avoid regressions. *Mitigation*: define TypeScript discriminated unions for each channel before wiring.
- **Mission/prompt shared state**: Multiple surfaces mutate the same backend resources. *Mitigation*: introduce shared Nova stores (React context or Zustand-like) so mission/prompt state stays consistent between panels.
- **Operator workflow regressions**: Legacy UI offers dense controls (e.g., scheduler start/stop). *Mitigation*: port most critical actions first, include smoke tests, and keep legacy UI live until acceptance testing signs off.

## Migration Checklist Snapshot

### Phase 1: Core Workflows (✅ Complete)
- [x] Legacy audit completed (table above)
- [x] Nova surface inventory documented with wiring flags
- [x] Wiring status signal implemented (type + CSS + stage highlight)
- [x] Agent roster and computer-as-tool surfaces mirrored in Nova with mock data
- [x] Chat history viewer fully wired (ChatHistoryPanel + chatHistoryClient)
- [x] Terminal integration with real backend (TerminalConsole + WebComm wired)
- [x] Research surface wired (ResearchProvider consuming WebSocket events)
- [x] Missions surface wired (MissionsProvider + scheduler controls via `/api/missions/*`)
- [x] Memory telemetry wired (MemoryTelemetryProvider consuming WebSocket events)
- [x] Status bar wired (StatusProvider + REST/WebSocket feeds)
- [x] Research preferences wired (ResearchPreferencesProvider + REST endpoints)

### Phase 2: Secondary Surfaces (🚧 In Progress - 4/5 complete)
- [x] GitHub Sync surface (`GithubSyncSurface` + `GitHubSyncProvider` + `githubSyncClient`) - Wired to `/api/research/github-sync` and `/api/research/github-activity/*` with activity feed
- [x] Logs surface (`LogsSurface` + `LogsProvider` + `logsClient`) - Fully wired to `/api/logs/*` with fetch/clear/buffer management
- [x] Prompts library surface (`PromptLibrarySurface` + `PromptsProvider` + `promptsClient`) - Wired to `/api/prompts/*` with list/search/save/delete/GitHub sync
- [x] Tasks kanban (`TasksSurface` consumes MissionsProvider columns and mission actions)
- [ ] Instruments panel (determine backend integration strategy)

### Phase 3: Specialized Tools (📋 Planned)
- [ ] Vector manager integration
- [ ] Database manager integration
- [ ] MCP server dashboard integration
- [ ] Memory management UI (distinct from telemetry)
- [ ] Agent orchestration panel
- [ ] Explorer/file browser

### Phase 4: Retirement (📋 Planned)
- [ ] Feature flag for legacy GUI toggle
- [ ] Acceptance testing with operators
- [ ] Legacy GUI deprecation notices
- [ ] Final switchover + legacy route removal

## Working Artifacts
- **Inventory Sheets**: CSV-style tables (can live in this doc or companion files) summarizing 
  - Legacy surface files, API usage, shared utilities.
  - Nova modules, mock dependencies, existing route placements.
- **Status Legend** (for the red class):
  - `unwired` – no live data; render with red treatment.
  - `partial` – mixed mock/live; include warning toast.
  - `wired` – feature parity achieved; legacy tab ready to retire.
- **Migration Checklist**: step-by-step list to validate surface parity before toggling off the legacy tab.

## Progress Summary (as of 2025-11-10)

### ✅ Completed Surfaces
1. **Terminal** (`TerminalSurface` + `TerminalConsole`) - Fully wired to `/api/research/ws` with WebComm client, prompt bridge, command history streaming, and reconnect logic.
2. **Research** (`ResearchSurface` + `ResearchProvider`) - Consuming research-* WebSocket events (status, progress, thoughts, memory, suggestions), live GitHub activity aggregation.
3. **Status** (`StatusBar` + `StatusProvider`) - REST `/api/status/summary` + WebComm `status-summary` events; token usage tracking, telemetry display.
4. **Chat History** (`ChatHistoryPanel` + `chatHistoryClient`) - CRUD operations via `/api/chat/history/*` with export/delete support.
5. **Missions** (`MissionsSurface` + `MissionsProvider`) - Full scheduler controls (start/stop/tick), mission CRUD, activity feed via `/api/missions/*`.
6. **Memory Telemetry** (`MemoryTelemetryProvider`) - WebSocket `memory_event` handlers integrated into research flows.
7. **Research Preferences** (`ResearchPreferencesProvider` + `ResearchPreferencesPanel`) - REST `/api/research/preferences` with live updates.

### 🚧 Partially Wired / Mock Data
- **Instruments** (`InstrumentsSurface`) - Card layout exists but uses `mockWorkspace.instruments`; no backend integration yet.

### ✅ Recently Wired (Phase 2 additions)
8. **Logs** (`LogsSurface` + `LogsProvider` + `logsClient`) - Fully wired to `/api/logs/*` with fetch/refresh/clear/buffer management; displays live system logs with filter presets and search.
9. **Prompts** (`PromptLibrarySurface` + `PromptsProvider` + `promptsClient`) - Wired to `/api/prompts/*` with list/search/get/save/delete operations plus GitHub sync integration (pull/push/status).
10. **GitHub Sync** (`GithubSyncSurface` + `GitHubSyncProvider` + `githubSyncClient`) - Wired to `/api/research/github-sync` for sync operations (verify, list, file, push, upload) and `/api/research/github-activity/*` for live activity feed with stats.
11. **Tasks** (`TasksSurface` + `MissionsProvider`) - Kanban board now grouped from live `/api/missions` data with inline mission dispatch actions.

### 📋 Unwired / Placeholder Surfaces
- **Explorer** (`EditorSurface`) - Mock tree only
- **Vectors** (`VectorManagerSurface`) - Mock vector stores
- **Databases** (`DatabaseManagerSurface`) - Mock DB connections
- **Memory** (`MemoryManagerSurface`) - Mock memory spaces (note: memory *telemetry* is wired, but the management UI is not)
- **Metrics** (`MetricsBoardSurface`) - Mock workspace metrics
- **Agents** (`AgentsSurface`) - Mock agent profiles
- **MCP** (`ComputerAsToolSurface`) - Mock MCP servers with local guardrail toggles

## Next Steps
1. **Wire the instruments panel** - Connect `InstrumentsSurface` to mission or scheduler endpoints (or define its backend contract) so automation cards expose real actions.
2. **Port specialized widgets** - Wire vector/database/MCP/agent panels once their backend contracts are finalized.
3. **Legacy GUI retirement** - Once parity is verified, introduce feature flags to toggle legacy routes and set Nova as the default entry point.
