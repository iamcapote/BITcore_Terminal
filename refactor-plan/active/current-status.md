<!--
Why: Track the current refactor position and define the next high-leverage frontend wins.
What: Status assessment, gap inventory, and prioritized work packages for Nova Phase 2→3 delivery.
How: Audit completed/pending work, identify missing foundations, and sequence big-win deliverables.
Status: active
Last Updated: 2026-04-02
-->

# Frontend Next Wins — Status & Execution Plan

## 1) Where We Are (2026-04-02)

### Unwired / Placeholder (5 surfaces)

| Surface | Component | Status | Blocker |
| --- | --- | --- | --- |
| Explorer | `EditorSurface` | `unwired` | Still imports `explorerTree` from `mockWorkspace`; `/api/files/tree` backend exists (Pass-07) but Nova client not connected |
| Databases | `DatabaseManagerSurface` | `unwired` | Still renders `mockWorkspace.databaseConnections`; no DB backend contract defined |
| Agents | `AgentSurfaces.tsx` | `partial` | Swarm backend wired (Passes 1-12); component still imports agent profiles + MCP server rows from `mockWorkspace` for display |
| Skills/Instruments | `OperationsSurfaces.tsx` | `unwired` | Mock instruments; no skills backend; amber preview banner present |
| Workflows/Schema | `WorkflowBuilderSurface` + `WorkflowCoreSurfaces` | `partial` | Semantic ontology vendor import removed (stub); workflow execution contract not yet defined |

---

## 2) What Is Missing From the Frontend Foundation

### A. Admin Settings Surface — Remaining Gaps
The `SettingsSurface` is wired to `adminClient` (`/api/commands`, `/api/config`, `/api/admin/settings`). The scaffolding is live. Remaining gaps:

1. **Provider management panel** — add/remove/configure LLM providers, search providers, memory backends (not yet surfaced in settings tabs).
2. **Command toggle panel** — enable/disable CLI commands from the GUI (framework present, not wired).
3. **Security panel** — rate limits, CSRF config, session timeout, IP allowlist (from `config.security.*`).
4. **Keyboard shortcut editor** — view and rebind all keyboard shortcuts.
5. **Notification & alert preferences** — configure what events trigger alerts, toast styles, sound.

### B. Chromium Agent Browser Surface
Agents need their own embedded browser to navigate the web, fill forms, and scrape content. `BrowserSurface` is registered (`wiringStatus: "wired"`) but the implementation is a stub iframe to localhost — not a real Puppeteer/Playwright-backed view.

Missing pieces:
1. **Backend service** — `POST /api/browser/navigate`, `POST /api/browser/screenshot`, `POST /api/browser/action`.
2. **Session management** — isolated browser sessions per agent, cookie/storage sandboxing.
3. **Screenshot/DOM capture** — snapshot current page state for agent reasoning.
4. **Proper `BrowserSurface` component** — live Puppeteer-controlled page view or Browserless endpoint, not iframe stub.

### C. Modern UX/UI Design Refresh
Shell is functional. Remaining gaps:

1. **Micro-interactions** — hover states, transitions, skeleton loading states for all data-fetching surfaces.
2. **Responsive audit** — breakpoints defined (320/768/1024/1440) but not validated.
3. **Quick access launcher** — unified search across commands, surfaces, and settings.
4. **Drag-and-drop surface arrangement** — rearrange shell layout from the GUI.
5. **Dark mode contrast polish** — functional but needs WCAG 2.2 AA audit.
6. **Loading/streaming UX** — skeleton screens, progressive content reveal, typing indicators for chat.

Completed: notification system (Pass-13 + wired), dashboard landing (DashboardSurface), empty states (LeftRail sections), tab close buttons, layout mode toggles.

### D. Page Structure & Clarity
Dashboard surface is live; onboarding checklist and quick actions are wired. Remaining gaps:

1. **Tab management** — close/pin/reorder tabs, tab overflow scrolling (close button done; pin/overflow not yet built).
2. **Focus mode** — `Cmd+F` collapse chrome (layout presets done; no keyboard shortcut hook).
3. **Split view** — side-by-side surface comparison (layout supports it via resizable panels, not exposed in UI controls).

---

## 3) Next Big Wins — Prioritized Work Packages

> Wins 1–3 from the 2026-02-13 plan are **complete**. New priority order below.

### Win 1: Chat Surface Modernization (HIGH — primary interaction surface)
**Why**: Chat is the primary interaction surface; currently uses local React state with no backend persistence.

**Deliverables**:
1. Wire to `/api/research/ws` for streaming responses.
2. Message actions: copy, edit, regenerate, fork conversation.
3. Inline tool output cards (code blocks, search results, memory citations).
4. File/image attachment support.
5. Model selector + temperature/token controls in chat header.
6. Typing indicator + streaming token display.
7. Conversation persistence via chat history API.

**Effort**: High | **Impact**: Critical | **Dependencies**: WebSocket (already available)

### Win 2: Edge-of-Mock Explorer Surface (MEDIUM — backend exists, just needs client)
**Why**: `/api/files/tree` and git routes are all live (Pass-07); `EditorSurface` still uses `mockWorkspace.explorerTree`.

**Deliverables**:
1. Replace mock tree in `EditorSurface` with `fetchFileTree()` call to `/api/files/tree`.
2. Wire git branch/status/checkout/revert controls to existing `/api/files/git/*` routes.
3. Remove `explorerTree` import from `mockWorkspace`; update `wiringStatus` to `"wired"`.

**Effort**: Low | **Impact**: Medium | **Dependencies**: None (backend exists)

### Win 3: Agent Surface Mock Cleanup (MEDIUM — swarm backend is live)
**Why**: `AgentSurfaces.tsx` still imports `AgentProfile`, `AgentActivityEntry`, `MCPServerRow` from `mockWorkspace` for display only. The swarm backend already has all 12 passes complete.

**Deliverables**:
1. Replace agent profile/activity display with live `/api/ai/swarm/overview` data.
2. Remove `mockWorkspace` imports from `AgentSurfaces.tsx` and `swarmClient.ts`.
3. Update `wiringStatus` from `"partial"` to `"wired"`.

**Effort**: Low | **Impact**: Medium | **Dependencies**: Swarm backend (already wired)

### Win 4: Browser Surface Real Backend (HIGH — agent autonomy)
**Why**: `BrowserSurface` is registered as `"wired"` but is a stub iframe. Agents need real web navigation.

**Deliverables**:
1. Backend: Puppeteer/Playwright service behind `/api/browser/* ` endpoints.
2. `BrowserSurface` component with live viewer, URL bar, navigation controls.
3. Screenshot capture API for agent reasoning loops.
4. Browser tool schema for agent tool registry (`web_browse`, `web_screenshot`, `web_action`).

**Effort**: High | **Impact**: High | **Dependencies**: Container/runtime setup

### Win 5: Modern Design Polish Pass (MEDIUM — visual quality)
**Why**: Shell is functional across 21 surfaces but visually sparse. These are the remaining finish items.

**Deliverables**:
1. Skeleton loading states for all data-fetching surfaces.
2. Micro-interactions (hover, focus, transition animations).
3. Responsive audit (320/768/1024/1440 breakpoints).
4. WCAG 2.2 AA contrast audit across all 3 themes.
5. Improved tab management (pin/overflow — close already done).

**Effort**: Medium | **Impact**: Medium | **Dependencies**: None

---

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


