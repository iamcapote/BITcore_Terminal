<!--
Why: Track the current refactor position and define the next high-leverage frontend wins.
What: Status assessment, gap inventory, and prioritized work packages for Nova Phase 2→3 delivery.
How: Audit completed/pending work, identify missing foundations, and sequence big-win deliverables.
Status: active
Last Updated: 2026-02-11
-->

# Frontend Next Wins — Status & Execution Plan

## 1) Where We Are (2026-02-11 Snapshot)

### Completed (Foundation + Phase 1 + Phase 2 partial)

| Layer | Status | Details |
| --- | --- | --- |
| Design tokens + themes | Done | HSL token map, 3 themes (dark/light/retro), ThemeSwitcher, globals.css |
| Shell layout | Done | NovaShell (274 LOC), TopBar, LeftRail, SurfaceStage, StatusBar, resizable panels |
| UI primitives | Done | 21 primitives: accordion, alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, menubar, progress, scroll-area, select, separator, skeleton, switch, table, tabs, textarea, tooltip |
| Surface registry | Done | 17 surfaces registered, component map wired |
| Terminal surface | Wired | WebComm + `/api/research/ws` + command history + reconnect |
| Research surface | Wired | WebSocket events (status, progress, thoughts, memory, suggestions) |
| Status bar | Wired | REST + WebSocket status summary, token tracking |
| Chat history | Wired | CRUD via `/api/chat/history/*` |
| Missions surface | Wired | Full scheduler controls, CRUD via `/api/missions/*` |
| Tasks kanban | Wired | Grouped from live mission data |
| Memory telemetry | Wired | WebSocket `memory_event` handlers |
| Research preferences | Wired | REST `/api/research/preferences` |
| Logs surface | Wired | `/api/logs/*` with filter presets and search |
| Prompts library | Wired | `/api/prompts/*` + GitHub sync |
| GitHub Sync surface | Wired | `/api/research/github-sync` + activity feed |
| Settings surface | Scaffolded | 4 tabs (General, API Keys, Theme, Flags) — **all mock data, unwired** |
| Stores | Draft | `chatStore`, `uiStore` exist; no `telemetryStore`, `missionStore`, `logsStore` |

### Still Unwired / Placeholder (7 surfaces)

| Surface | Component | Blocker |
| --- | --- | --- |
| Explorer | `EditorSurface` | Mock tree; no file system client |
| Vectors | `VectorManagerSurface` | Mock data; no vector DB endpoint |
| Databases | `DatabaseManagerSurface` | Mock data; no DB endpoint |
| Memory management | `MemoryManagerSurface` | Mock data (telemetry is wired, management UI is not) |
| Metrics | `MetricsBoardSurface` | Mock data; no aggregated metrics endpoint |
| Agents | `AgentsSurface` | Mock profiles; agent system not built |
| MCP | `ComputerAsToolSurface` | Mock servers; MCP integration pending |
| Instruments | `InstrumentsSurface` | Card layout only, no backend |

### Missing Backend Prerequisites

| Endpoint | Purpose | Status |
| --- | --- | --- |
| `GET /api/commands` | Expose CLI metadata to GUI for parity rendering | **Not implemented** (cli-metadata.json ready) |
| `GET /api/config` | Expose runtime config (providers, models, features) | **Not implemented** |
| `GET/PATCH /api/admin/settings` | Unified admin settings CRUD | **Not implemented** |
| `GET /api/admin/surfaces` | Surface visibility/toggle management | **Not implemented** |
| Memory management CRUD | Store/recall/delete from GUI | Partial (store/recall exist, no GUI wiring) |

---

## 2) What Is Missing From the Frontend Foundation

### A. Admin Settings Surface (Critical — "Everything Surfaced")
The current `SettingsSurface` is **100% mock data** with only 4 tabs and a fixed set of hardcoded options.

**What's needed**: A comprehensive admin panel where the operator can toggle on/off and modify **every** available node, button, function, surface, feature flag, preference, and config value.

Missing pieces:
1. **`GET /api/commands` endpoint** — serve `cli-metadata.json` so the GUI can render every command + its flags dynamically.
2. **`GET /api/config` endpoint** — expose runtime config (providers, models, feature flags, preferences, security settings).
3. **`GET/PATCH /api/admin/settings` endpoint** — unified read/write for all admin-configurable values.
4. **Surface visibility manager** — let the admin show/hide/reorder any surface from the left rail.
5. **Feature flag registry** — wire to real flags (not the 6 hardcoded mocks), pull from config + encrypted store.
6. **Provider management panel** — add/remove/configure LLM providers, search providers, memory backends.
7. **Command toggle panel** — enable/disable CLI commands from the GUI.
8. **Notification & alert preferences** — configure what events trigger alerts, toast styles, sound.
9. **Security panel** — rate limits, CSRF config, session timeout, IP allowlist (from `config.security.*`).
10. **Keyboard shortcut editor** — view and rebind all keyboard shortcuts.

### B. Chromium Agent Browser Surface (New)
Agents need their own embedded browser to navigate the web, fill forms, and scrape content.

Missing pieces:
1. **`BrowserSurface` component** — embedded Chromium view (iframe to a Puppeteer/Playwright-controlled page or a Browserless endpoint).
2. **Browser control bar** — URL bar, back/forward/refresh, agent takeover toggle.
3. **Session management** — isolated browser sessions per agent, with cookie/storage sandboxing.
4. **Screenshot/DOM capture** — snapshot current page state for agent reasoning.
5. **Backend endpoint** — `POST /api/browser/navigate`, `POST /api/browser/screenshot`, `POST /api/browser/action`.
6. **Surface registration** — add `browser` to `SurfaceId` and surface registry.

### C. Modern UX/UI Design Refresh
The current shell is functional but visually sparse — needs modern design patterns.

Missing pieces:
1. **Bento grid dashboard** — telemetry/metrics in a modern card grid layout (planned but not built).
2. **Micro-interactions** — hover states, transitions, skeleton loading states for all data-fetching surfaces.
3. **Responsive audit** — no responsive testing done; breakpoints defined but not validated (320/768/1024/1440).
4. **Onboarding/empty states** — surfaces show raw mock data or nothing; need guided empty states with CTAs.
5. **Notification system** — toast/snackbar system for async events (mission complete, research done, errors).
6. **Command palette** — `Cmd+K` / `Ctrl+K` omni-search across commands, surfaces, settings.
7. **Breadcrumb/context bar** — show current surface path and quick navigation.
8. **Drag-and-drop surface arrangement** — let admin rearrange the shell layout.
9. **Dark mode polish** — current dark theme is functional but needs refinement for contrast ratios.
10. **Loading/streaming UX** — skeleton screens, progressive content reveal, typing indicators for chat.

### D. Page Structure & Clarity
The current layout is a single-shell catch-all. Needs clearer information architecture.

Missing pieces:
1. **Welcome/dashboard page** — landing surface showing system health, recent activity, quick actions.
2. **Surface groups as pages** — ability to view knowledge/operations/workspace groups as distinct contexts.
3. **Breadcrumb navigation** — clear "where am I" indicator.
4. **Tab management** — close/pin/reorder tabs, tab overflow scrolling.
5. **Focus mode** — `Cmd+F` collapse chrome (planned, not wired).
6. **Split view** — side-by-side surface comparison (layout supports it, not exposed in UI).

---

## 3) Next Big Wins — Prioritized Work Packages

### Win 1: Wire the Admin Settings Surface (HIGH — foundation for everything)
**Why**: Until settings are wired, the admin cannot control the system from the GUI. This blocks the "everything surfaced" mandate.

**Deliverables**:
1. `GET /api/commands` endpoint serving `cli-metadata.json`.
2. `GET /api/config` endpoint exposing runtime config.
3. `GET/PATCH /api/admin/settings` unified settings CRUD.
4. Rewrite `SettingsSurface` with dynamic tabs:
   - **General**: all preferences from terminal + research prefs APIs.
   - **API Keys**: wired to encrypted config store (existing `/api/preferences/terminal` + secure-config).
   - **Providers**: model browser (wire to `/api/models/venice`), add/configure providers.
   - **Commands**: render from `/api/commands`, toggle enable/disable.
   - **Surfaces**: visibility toggles for all 17+ surfaces, reorder left rail.
   - **Feature Flags**: real flags from config, wire toggle to backend.
   - **Theme**: already scaffolded, wire to theme persistence.
   - **Security**: rate limits, CSRF, session config.
   - **Keyboard Shortcuts**: view/rebind shortcuts.
   - **About/System**: version, uptime, diagnostics summary.
5. SettingsProvider context to distribute config to all surfaces.

**Effort**: High | **Impact**: Critical | **Dependencies**: Backend endpoints

### Win 2: Command Palette + Notification System (HIGH — modern UX essentials)
**Why**: These two features make the entire app feel modern and responsive.

**Deliverables**:
1. `Cmd+K` command palette — search commands, surfaces, settings, recent items.
2. Toast/snackbar notification system with severity levels and auto-dismiss.
3. Notification center (bell icon) with history of events.
4. Wire WebSocket events to notifications (research done, mission complete, errors).

**Effort**: Medium | **Impact**: High | **Dependencies**: None (can use existing data)

### Win 3: Welcome Dashboard + Empty States (MEDIUM — first impressions)
**Why**: Brand new operators see blank/mock surfaces with no guidance.

**Deliverables**:
1. `DashboardSurface` as default landing: system status card, recent activity feed, quick-action buttons.
2. Empty-state components for every unwired surface with helpful CTAs.
3. Onboarding checklist widget (configure keys, run first research, etc.).
4. Register `dashboard` in surface registry as default primary surface.

**Effort**: Medium | **Impact**: High | **Dependencies**: Status API (already wired)

### Win 4: Chromium Agent Browser Surface (HIGH — agent autonomy)
**Why**: Agents need web navigation capability. This is a core platform differentiator.

**Deliverables**:
1. Backend: Puppeteer/Playwright service behind `/api/browser/*` endpoints.
2. `BrowserSurface` component with embedded viewer.
3. URL bar, navigation controls, agent session indicator.
4. Screenshot capture API for agent reasoning loops.
5. Surface registration + left rail icon.
6. Browser tool schema for agent tool registry (`web_browse`, `web_screenshot`, `web_action`).

**Effort**: High | **Impact**: High | **Dependencies**: Container/runtime setup

### Win 5: Chat Surface Modernization (HIGH — primary interaction surface)
**Why**: Chat is the primary user interaction surface but currently uses local state only.

**Deliverables**:
1. Wire to real `/api/research/ws` for streaming responses.
2. Message actions: copy, edit, regenerate, fork.
3. Inline tool output cards (code blocks, search results, memory citations).
4. File/image attachment support.
5. Model selector + temperature/token controls in chat header.
6. Typing indicator + streaming token display.
7. Conversation persistence via chat history API.

**Effort**: High | **Impact**: Critical | **Dependencies**: WebSocket (already available)

### Win 6: Modern Design Polish Pass (MEDIUM — visual quality)
**Why**: Current UI is functional but visually sparse. Needs professional finish.

**Deliverables**:
1. Skeleton loading states for all data-fetching surfaces.
2. Micro-interactions (hover, focus, transition animations on cards/buttons).
3. Responsive grid audit (verify 320/768/1024/1440 breakpoints).
4. Contrast ratio audit for WCAG 2.2 AA across all 3 themes.
5. Bento grid layout for metrics/telemetry dashboard.
6. Consistent icon sizing and spacing.
7. Improved tab management (close, pin, reorder, overflow).

**Effort**: Medium | **Impact**: Medium | **Dependencies**: None

### Win 7: Wire Remaining Phase 3 Surfaces (MEDIUM — complete coverage)
**Why**: 7 surfaces are still fully mock. Wiring them completes the migration.

**Deliverables**:
1. Memory management UI — wire `/api/memory/*` for store/recall/delete.
2. Metrics board — wire `/api/status/summary` for aggregated metrics + sparklines.
3. Instruments panel — define backend contract, wire to missions/scheduler.
4. Vector/Database/MCP/Agent surfaces — backend contracts needed first.

**Effort**: High (cumulative) | **Impact**: Medium | **Dependencies**: Backend contracts

---

## 4) Verification Checklist — All Plans Accounted For

### From Canonical Plan (01-frontend-priorities.md)
| Planned Item | Status | Next Action |
| --- | --- | --- |
| Phase 1: Shell Foundation | Done | — |
| Phase 1: WebSocket transport layer | Done | Research + Terminal wired |
| Phase 1: Keyboard navigation | Partial | Command palette (Win 2) fills this |
| Phase 2: Research telemetry card | Done | Research surface wired |
| Phase 2: Memory timeline | Not started | Win 7 |
| Phase 2: Logs viewer | Done | Logs surface wired |
| Phase 2: Archive explorer | Not started | Needs backend route |
| Phase 3: Chat UI with memory context | Not started | Win 5 |
| Phase 3: Settings drawer (keys, prefs, config) | Scaffolded (mock) | Win 1 |
| Phase 3: Mission board + MCP dock | Missions done, MCP not started | Win 7 |
| Phase 3: Parity matrix automation | Not started | Win 1 enables this |
| Phase 4: Bundle < 350 KB gzip | Unknown | Audit after Win 6 |
| Phase 4: WCAG 2.2 AA | Not started | Win 6 |
| Phase 4: Retro skin parity | Exists but untested | Win 6 |
| Phase 5+: Mission canvas | Not started | Deferred |
| Phase 5+: Vector DB UI | Not started | Win 7 |

### From Canonical Plan (02-frontend-blueprints.md)
| Planned Item | Status | Next Action |
| --- | --- | --- |
| Streaming UX baseline | Not started | Win 5 |
| Chat ergonomics (copy/edit/regenerate) | Not started | Win 5 |
| Conversation branch/fork | Not started | Win 5 |
| Preset manager | Not started | Win 1 (settings) |
| Scheduler board | Done (Tasks surface) | — |
| Multi-model compare | Not started | Deferred (agent system first) |
| Assistant builder | Not started | Deferred |
| Plan approval gate | Not started | Deferred (agent system first) |
| Clarification prompt | Not started | Win 5 |
| Context Canvas | Not started | Deferred (Phase 5+) |
| Integrated web browser | Not started | Win 4 |

### From Canonical Plan (03-interface-details-examples.md)
| Planned Item | Status | Next Action |
| --- | --- | --- |
| Win95 skin implementation | Token exists, not built | Deferred |
| Modern chat skin | Token exists | Win 5 + Win 6 |
| TUI skin | Not started | Deferred |
| Console embedding | Not started | Deferred |
| Context Canvas surface | Not started | Deferred |
| Generative UI artifacts | Not started | Deferred |
| Code interpreter surface | Not started | Deferred |
| Rich text editor | Not started | Deferred |

### New Requirements (This Session)
| Requirement | Planned Win | Priority |
| --- | --- | --- |
| Every setting surfaced + admin toggle everything | Win 1 | Critical |
| Chromium agent browser | Win 4 | High |
| Modern UX/UI design refresh | Win 6 | Medium-High |
| Page setup modernization + clarity | Win 3 + Win 6 | Medium-High |

---

## 5) Recommended Execution Sequence

```
Sprint A (Immediate):  Win 1 (Settings) + Win 2 (Command Palette + Notifications)
Sprint B (Next):       Win 3 (Dashboard) + Win 5 (Chat Modernization)
Sprint C (Following):  Win 4 (Agent Browser) + Win 6 (Design Polish)
Sprint D (Complete):   Win 7 (Remaining Surfaces)
```

**Rationale**: Settings wiring (Win 1) unblocks the "everything surfaced" mandate and is the prerequisite for admin control. Command palette (Win 2) is high-leverage UX. Chat (Win 5) is the primary interaction surface. Agent browser (Win 4) is a differentiator. Design polish (Win 6) and remaining surfaces (Win 7) complete the migration.

---

## 6) Architecture Decisions for New Features

### Admin Settings Architecture
- **SettingsProvider** (React context) fetches config from `/api/config` + `/api/commands` on mount.
- **Dynamic tab renderer** generates settings tabs from a schema (not hardcoded).
- **Optimistic updates** with rollback on save failure.
- **Section registry** so new settings sections can be added by dropping a schema file.

### Agent Browser Architecture
- **Browserless** or **Playwright** service running in a sibling container.
- **WebSocket bridge** for real-time page events (navigation, console, network).
- **Session pool** with per-agent isolation (cookies, storage, proxy).
- **Tool integration**: `web_browse`, `web_screenshot`, `web_action` added to agent tool registry.

### Notification System Architecture
- **NotificationProvider** context with a zustand store.
- **WebSocket event subscription** for async notifications.
- **Toast queue** with severity levels (info, success, warning, error).
- **Persistent notification log** accessible from a bell icon in the TopBar.
