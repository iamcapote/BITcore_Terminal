<!--
Why: Clarify the dual GUI landscape, consolidate strategy, and lay out the migration path from port 3000 to port 5173.
What: Strategic overview addressing current state (legacy vs. next), vendor patterns to adopt, feature coverage, and immediate next actions.
How: Side-by-side comparison, migration phases, feature checklist, and decision points for stakeholders.
-->

# BITcore GUI Strategy & Migration Plan (2025-10-20)

## Executive Summary

**Current State:**
- **Port 3000** (`pnpm run start`): Original GUI with most features (research, GitHub, scripts) but stale, cluttered, unprofessional
- **Port 5173** (`pnpm run ui:dev`): Modern blank canvas, broken elements, missing key features

**Strategic Direction:**
- Migrate core features from 3000 into 5173 using vendor patterns (Agent Zero, Deerflow, Superfile)
- Apply modern UX principles: visual hierarchy, hidden complexity, clear affordances
- Enforce 1:1 CLI ↔ Web parity across all commands, settings, and toggles
- Ship three skins (Hacker Console, Modern Chat, Retro Win95) sharing logic via ThemeProvider

**Timeline:** 4 sprints (8–9 weeks), with feature flag rollout (dev → staging → beta → default)

---

## I. Port 3000: Current State & Gaps

### What We Have (Features to Migrate)

| Feature | Status | Complexity | Priority |
|---------|--------|-----------|----------|
| **Deep Research Engine** | ✅ Full | High | 🔴 Critical |
| **GitHub Integration** | ✅ Full | Medium | 🔴 Critical |
| **CLI-Script Commands** | ✅ Partial | Low | 🟡 High |
| **Chat System** | ✅ Full | High | 🔴 Critical |
| **Memory Management** | ✅ Full | High | 🔴 Critical |
| **Command Execution** | ✅ Partial | Medium | 🟡 High |
| **Telemetry/Logs** | ✅ Text-based | Medium | 🟡 High |
| **API Key Management** | ✅ Basic | Low | 🟢 Medium |
| **Settings/Config** | ✅ Basic | Low | 🟢 Medium |
| **MCP Tools** | ❌ None | High | ⏳ Roadmap |
| **Computer System** | ❌ None | High | ⏳ Roadmap |
| **Vector DB Knowledge** | ❌ None | High | ⏳ Roadmap |
| **File System Navigator** | ⚠️ Basic | Medium | ⏳ Roadmap |

### What's Wrong (UX Problems)

| Problem | Root Cause | Impact |
|---------|-----------|--------|
| Cluttered layout | Chrome-heavy, no visual hierarchy | Users disoriented |
| Unprofessional appearance | Ad-hoc styling, inconsistent spacing | Perception of immaturity |
| Unfamiliar patterns | Not following modern UI conventions | High cognitive load |
| Too many elements | No progressive disclosure, settings inline | Overwhelm |
| Hardcoded models | No vendor abstraction, specific AI routing | Loss of flexibility |
| No MCP/computer system | Never planned for agent tooling | Must redesign for expansion |

### Design Debt

- **Color System**: No cohesive token system; colors hardcoded in CSS files
- **Typography**: Inconsistent sizing and weights
- **Spacing**: Ad-hoc margins/padding; no scale
- **Components**: No reusable primitives; each section is custom HTML/CSS
- **Responsiveness**: Minimal; desktop-focused
- **Dark Mode**: Basic toggle, incomplete coverage

---

## II. Port 5173: Blank Canvas Status

### What We Have (Foundation)

| Asset | Status | Quality |
|-------|--------|---------|
| **React + Vite scaffold** | ✅ Complete | Good |
| **TypeScript config** | ✅ Complete | Good |
| **Zustand stores** | ✅ Draft | Basic |
| **Theme Provider** | ✅ Draft | Needs work |
| **Primitives (Button, Card, Input)** | ✅ Draft | Good |
| **Design tokens** | ✅ Foundation | Needs expansion |
| **Ladle component catalog** | ✅ Draft | Basic |

### What's Missing (Blockers)

| Feature | Blocker Type | Effort | Dependency |
|---------|--------------|--------|-----------|
| **Shell Layout** | Architecture | Medium | Vendor patterns |
| **Command Palette** | UI/Logic | Medium | CLI metadata extraction |
| **Research Telemetry** | Transport | High | WebSocket schema alignment |
| **Chat Interface** | UI/Logic | High | Stream handling, memory context |
| **Memory Timeline** | UI/Logic | Medium | Memory manager integration |
| **Settings Panel** | UI/Logic | Low | Config endpoint hookup |
| **Theme Switching** | UI/Logic | Low | Token system expansion |
| **Responsive Layout** | CSS | Medium | Breakpoint testing |
| **Keyboard Navigation** | Accessibility | Medium | Focus management |
| **Mobile Support** | CSS/UX | Medium | Drawer patterns |

---

## III. Vendor Patterns: What to Adopt

### From Agent Zero ✅ Prioritized

**Patterns:**
- Multi-panel dashboard with collapsible sections
- Tool registry UI (inspirable for MCP dock)
- Settings drawer with organized sections
- Task/scheduler management (for mission control)
- Memory database browser

**Applicable to BITcore:**
- Shell sidebar with expandable sections (Research, Chat, Memory, Tools, Settings)
- Floating tool dock (Agent-zero scheduler style)
- Settings drawer replacing inline config
- Mission control board (kanban-style task display)

**Files to review:** `refactor-plan/sandbox/vendor/agent-zero/webui/`

### From Deerflow ✅ Prioritized

**Patterns:**
- Sophisticated visual hierarchy (nested indentation, color depth, whitespace rhythm)
- Telemetry dashboard with clear data visualization (progress rings, sparklines, timelines)
- Chat interface with message flow and streaming UX
- Dark mode with high contrast, clear reading

**Applicable to BITcore:**
- Telemetry deck components (research progress, token usage, memory commits, mission timelines)
- Chat bubble styling and message actions
- Streaming text handling (character-by-character append with smooth scrolling)
- Visual hierarchy for command results (sections, subsections, highlights)

**Files to review:** `refactor-plan/sandbox/vendor/semantic_flow/` (semantic flow shares principles with deerflow)

### From Superfile ✅ Prioritized

**Patterns:**
- Modular file explorer TUI with keyboard nav
- 1:1 CLI ↔ GUI command parity (every CLI flag → GUI checkbox/input)
- Breadcrumb navigation and inline file operations

**Applicable to BITcore:**
- Extend basic file navigator with superfile's modularity
- Model our file system component after superfile's approach
- Ensure CLI commands and GUI controls stay perfectly mirrored

**Files to review:** `refactor-plan/sandbox/vendor/superfile/`

### From ChatBot UI ✅ Good Reference

**Patterns:**
- Dashboard shell with responsive sidebar
- HSL-based color system (best for theme switching)
- Clean message bubble design
- File upload with drag-and-drop
- Command palette with fuzzy search

**Applicable to BITcore:**
- Shell layout (already adopted; see `GUI_IMPLEMENTATION_REPORT.md`)
- HSL token system (foundation laid; needs expansion)
- Message bubbles for chat interface
- Drag-and-drop file upload patterns

**Files to review:** `refactor-plan/sandbox/vendor/chatbot-ui/`

### From Semantic Flow 🎨 Design

**Patterns:**
- Win95 authentic chrome (borders, bevels, window look)
- Node canvas for workflow visualization (future; mission canvas)
- Theme token discipline

**Applicable to BITcore:**
- Retro Win95 skin (design-only for now; full implementation Phase 5+)
- Token system for consistent styling across skins

**Files to review:** `refactor-plan/sandbox/vendor/semantic_flow/`

---

## IV. Feature Migration Roadmap (Phased)

### Phase 1: Shell Foundation (Weeks 1–3)

**Objective:** Responsive layout + command palette + basic telemetry

**Deliverables:**
- [x] Shell layout (ShellLayout, ShellSidebar, CommandSurface, InsightDeck)
- [x] Responsive grid (mobile/tablet/desktop breakpoints)
- [x] Theme provider with 3 skins
- [ ] Command palette with CLI metadata
- [ ] WebSocket transport layer

**Acceptance Gate:** Feature flag `UI_NEXT_ENABLED=true` (dev only), keyboard nav audit green, Lighthouse FCP <2.5s

**Files to work on:** `app/public/ui/src/components/layout/`, `app/public/ui/src/stores/`

---

### Phase 2: Telemetry & Archives (Weeks 4–5)

**Objective:** Live research progress, token usage, memory timeline, logs viewer

**Deliverables:**
- [ ] Research telemetry card (progress ring, stage timeline, token gauge)
- [ ] Memory timeline with GitHub sync indicators
- [ ] Logs viewer with streaming tail + filters
- [ ] Archive explorer with download/export
- [ ] WebSocket event subscribers (research:*, memory:*, logs:*)

**Acceptance Gate:** WebSocket contract tests green, Playwright research run E2E, axe accessibility ≥90

**Files to work on:** `app/public/ui/src/components/telemetry/`, `app/public/ui/src/stores/telemetryStore.ts`

---

### Phase 3: Command Coverage & Responsive (Weeks 6–7)

**Objective:** All CLI commands wired to GUI, responsive parity matrix green

**Deliverables:**
- [ ] Chat interface with memory context display
- [ ] Settings drawer (config, API keys, preferences)
- [ ] Mission board (task kanban, intervention controls)
- [ ] Tool dock (MCP registry, connection state)
- [ ] Responsive testing across devices
- [ ] Parity matrix autogeneration in CI

**Acceptance Gate:** CLI parity script all green, 3-skin Percy snapshots match, beta user group preview

**Files to work on:** `app/public/ui/src/components/chat/`, `app/public/ui/src/components/settings/`, `app/commands/` (metadata extraction)

---

### Phase 4: Polish & Rollout (Weeks 8–9)

**Objective:** Performance hardening, accessibility audit, skin parity, default migration

**Deliverables:**
- [ ] Bundle size <350 KB gzip (measure with bundlesize CI check)
- [ ] WCAG 2.2 AA compliance (semantic landmarks, live regions, focus-visible outlines)
- [ ] Win95 retro skin (theme-only, not full visual)
- [ ] Migration guide & rollback plan
- [ ] Telemetry dashboard (GUI usage events)

**Acceptance Gate:** Default rollout for all users, legacy fallback at `/ui-legacy` until Sprint 5

**Files to work on:** `app/public/ui/src/theme/`, performance audits

---

### Phase 5+: Advanced Features (Roadmap)

- [ ] Mission canvas (node-based workflow visualization, inspired by Semantic Flow)
- [ ] File system navigator (advanced, inspired by Superfile)
- [ ] Vector DB knowledge explorer
- [ ] MCP tool orchestration UI
- [ ] Computer environment shell integration

---

## V. Feature Checklist: Migration Tracker

### Research Feature

| Component | Port 3000 | Port 5173 | Status | Phase | Files |
|-----------|-----------|-----------|--------|-------|-------|
| Research form | ✅ | ❌ | TODO | 1 | `app/public/ui/src/components/ResearchForm.tsx` |
| Query builder | ✅ | ❌ | TODO | 1 | `app/public/ui/src/components/ResearchBuilder.tsx` |
| Progress indicator | ✅ (text) | ❌ | TODO | 2 | `app/public/ui/src/components/ResearchProgress.tsx` |
| Token counter | ✅ (text) | ❌ | TODO | 2 | `app/public/ui/src/components/TokenGauge.tsx` |
| Result display | ✅ | ❌ | TODO | 2 | `app/public/ui/src/components/ResearchResults.tsx` |
| Archive browser | ✅ | ❌ | TODO | 2 | `app/public/ui/src/components/ArchiveExplorer.tsx` |

### Chat Feature

| Component | Port 3000 | Port 5173 | Status | Phase | Files |
|-----------|-----------|-----------|--------|-------|-------|
| Chat form | ✅ | ❌ | TODO | 3 | `app/public/ui/src/components/ChatForm.tsx` |
| Message display | ✅ | ❌ | TODO | 3 | `app/public/ui/src/components/ChatMessage.tsx` |
| Memory context | ✅ (text) | ❌ | TODO | 3 | `app/public/ui/src/components/MemoryContext.tsx` |
| Memory timeline | ✅ (text) | ❌ | TODO | 2 | `app/public/ui/src/components/MemoryTimeline.tsx` |
| In-chat commands | ✅ | ❌ | TODO | 3 | Integrated into ChatForm |

### Settings Feature

| Component | Port 3000 | Port 5173 | Status | Phase | Files |
|-----------|-----------|-----------|--------|-------|-------|
| API keys panel | ✅ (inline) | ❌ | TODO | 3 | `app/public/ui/src/components/KeysPanel.tsx` |
| Theme switcher | ✅ (basic) | ⚠️ (draft) | TODO | 3 | `app/public/ui/src/components/ThemeSwitcher.tsx` |
| Config options | ✅ (inline) | ❌ | TODO | 3 | `app/public/ui/src/components/ConfigPanel.tsx` |
| User preferences | ✅ (basic) | ❌ | TODO | 3 | `app/public/ui/src/components/PreferencesPanel.tsx` |

### Mission Control Feature

| Component | Port 3000 | Port 5173 | Status | Phase | Files |
|-----------|-----------|-----------|--------|-------|-------|
| Mission list | ❌ (basic schedule CLI) | ❌ | TODO | 3 | `app/public/ui/src/components/MissionBoard.tsx` |
| Task kanban | ❌ | ❌ | TODO | 3 | `app/public/ui/src/components/MissionKanban.tsx` |
| Intervention controls | ❌ | ❌ | TODO | 3 | `app/public/ui/src/components/MissionControls.tsx` |

### Observability (Logs, Telemetry)

| Component | Port 3000 | Port 5173 | Status | Phase | Files |
|-----------|-----------|-----------|--------|-------|-------|
| Logs tail | ✅ (text) | ❌ | TODO | 2 | `app/public/ui/src/components/LogsTail.tsx` |
| Logs filter | ⚠️ (basic) | ❌ | TODO | 2 | `app/public/ui/src/components/LogsFilter.tsx` |
| Token metrics | ✅ (text) | ❌ | TODO | 2 | `app/public/ui/src/components/TokenMetrics.tsx` |
| Event timeline | ❌ | ❌ | TODO | 2 | `app/public/ui/src/components/EventTimeline.tsx` |

---

## VI. CLI ↔ Web Parity Strategy

### The Mandate (From AGENTS.md)

> Every feature, setting, option, and toggle must be accessible from both CLI and web GUI. Users must be able to use the ENTIRE app from either surface.

### Implementation Pattern

**For each CLI command:**

1. **Metadata file** (`app/commands/[feature]/[command].cli.mjs`):
   ```js
   export const commandMetadata = {
     name: 'research',
     description: 'Run deep research on a topic',
     flags: [
       { name: 'query', required: true, type: 'string', description: 'Research topic' },
       { name: 'depth', type: 'number', default: 3, description: 'Depth level' },
       { name: 'breadth', type: 'number', default: 5, description: 'Breadth level' }
     ]
   };
   ```

2. **Web binding** (`app/public/ui/src/data/commandMetadata.ts`):
   ```ts
   import from extract metadata → auto-generate form controls
   ```

3. **GUI form** (`app/public/ui/src/components/ResearchForm.tsx`):
   ```tsx
   render form inputs matching CLI flags
   send command via WebSocket with same validation
   ```

### Parity Checklist

- [ ] `/keys set` command → Keys settings panel (Phase 3)
- [ ] `/config set ui.theme` → Theme switcher (Phase 3)
- [ ] `/research` command → Research form + progress (Phases 1–2)
- [ ] `/chat` command → Chat interface (Phase 3)
- [ ] `/memory stats` → Memory timeline (Phase 2)
- [ ] `/missions` command → Mission board (Phase 3)
- [ ] `/help` command → Help modal (Phase 1)
- [ ] `/security status` → Security status panel (Phase 3)
- [ ] `/export` command → Download action (Phase 2)

---

## VII. Immediate Next Actions (This Week)

### For Backend/Infrastructure

1. **Export CLI metadata** (`app/commands/*.cli.mjs`):
   - Create `app/commands/index.mjs::exportMetadata()` function
   - Return JSON with all commands, flags, descriptions
   - Add endpoint `GET /api/commands` returning metadata

2. **Align WebSocket schema** (`app/features/research/routes.mjs`):
   - Document telemetry event discriminants (research:status, research:progress, research:complete, etc.)
   - Add contract tests in `tests/ui-events.test.mjs`
   - Ensure all telemetry events include `correlationId` and timestamp

3. **Accessibility** in current 3000:
   - Run axe scan on `/`; document critical issues
   - Fix WCAG failures blocking migration (focus-visible, semantic landmarks)

### For Frontend

1. **Command palette wiring** (`app/public/ui/src/components/CommandPalette.tsx`):
   - Fetch `GET /api/commands` on app load
   - Parse into searchable registry
   - Wire keyboard shortcut handler

2. **Responsive grid audit** (`app/public/ui/src/components/layout/ShellLayout.tsx`):
   - Test at 320px, 768px, 1024px, 1440px breakpoints
   - Verify sidebar collapse behavior
   - Check focus mode toggle

3. **Theme token expansion** (`app/public/ui/src/theme/tokens.json`):
   - Add semantic colors for all component states (hover, active, disabled, error, success)
   - Ensure 3 skins (Hacker, Modern, Retro) have distinct token overrides
   - Generate ANSI map for CLI integration

### For Testing

1. **Create parity matrix** (`scripts/generate-parity-matrix.mjs`):
   - Scan `app/commands/` and `app/public/ui/src/`
   - Output HTML report of CLI ↔ GUI coverage
   - Add to CI pipeline

2. **Vitest setup** (`tests/ui-stores.test.mjs`):
   - Test Zustand stores (telemetryStore, commandStore, themeStore)
   - Contract tests for WebSocket event parsing

---

## VIII. Decision Points & Trade-offs

### Option A: Incremental Migration (Chosen ✅)

- Keep port 3000 live during port 5173 build-out
- Use feature flag `UI_NEXT_ENABLED` to control rollout
- Migrate features one batch at a time (research → chat → settings)
- **Pros:** Risk-controlled, users can fall back, parallel work
- **Cons:** Longer timeline, double-maintenance burden

### Option B: Full Rewrite (Not Chosen)

- Shut down port 3000, build everything on 5173
- **Pros:** Clean slate, single codebase
- **Cons:** Higher risk, features go offline during transition, time-constrained

### Option C: Keep Both (Not Chosen)

- Maintain separate 3000 and 5173 indefinitely
- **Pros:** No migration risk
- **Cons:** Double maintenance, user confusion, split community

---

## IX. Success Metrics

### By End of Phase 1
- ✅ Shell layout responsive and keyboard-navigable
- ✅ Command palette renders ≥50 commands from CLI metadata
- ✅ Lighthouse FCP <2.5s, Accessibility ≥90
- ✅ Feature flag green in dev, rollout ready for staging

### By End of Phase 2
- ✅ Research telemetry live (progress ring, token gauge, result display)
- ✅ Memory timeline + logs tail streaming in real-time
- ✅ Archive explorer with download/export functionality
- ✅ WebSocket event tests ≥80% coverage

### By End of Phase 3
- ✅ CLI ↔ Web parity matrix 100% (all commands, flags, toggles)
- ✅ Chat interface with memory context and in-chat commands
- ✅ Settings drawer with API keys, theme, preferences
- ✅ Mission board (kanban) with intervention controls
- ✅ 3-skin Percy snapshots match design spec

### By End of Phase 4
- ✅ Performance: bundle <350 KB gzip, WebSocket connect <500 ms
- ✅ Accessibility: WCAG 2.2 AA on all pages
- ✅ Rollout complete; users default to 5173
- ✅ Telemetry: GUI usage events captured, dashboarded

---

## X. Rollout Strategy

### Timeline

| Period | Status | Surface | Users | Controls |
|--------|--------|---------|-------|----------|
| Sprint 1–2 | Dev | `localhost:5173` | Developers | Feature flag |
| Sprint 2–3 | Staging | `staging.bitcore.app:5173` | Internal QA | Feature flag |
| Sprint 3–4 | Beta | `beta.bitcore.app:5173` | Opt-in users | Feature flag + feedback |
| Sprint 4+ | Production | Primary URL | All | Gradual rollout (5% → 25% → 100%) |

### Fallback

- `/ui-legacy` → port 3000 (until Sprint 5 completion)
- Feature flag `UI_NEXT_ENABLED=false` → revert to legacy

---

## XI. Dependencies & Blockers

### External

- ✅ React, Vite, TypeScript (installed)
- ✅ Zustand for state (installed)
- ✅ Design tokens (drafted; needs expansion)
- ⏳ Backend telemetry endpoint alignment (in progress)
- ⏳ CLI metadata export endpoint (blocked until Phase 1.2)

### Internal

- Frontend: Waiting for backend WebSocket schema finalization
- Backend: Waiting for frontend to define telemetry store shape
- Both: Pending vendor pattern finalization (Agent Zero, Deerflow inspiration)

### Risk Factors

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Feature flag complexity | Medium | Medium | Simple boolean toggles; no cross-contamination |
| WebSocket drift | Medium | High | Generate TypeScript schemas, add contract tests |
| Accessibility regression | Low | High | Weekly axe audits, WCAG 2.2 checklist |
| Bundle bloat | Medium | Medium | Monitor with bundlesize CI, lazy-load skins |
| Operator confusion | Low | Medium | Migration guide, CLI toggle, clear messaging |

---

## XII. Ownership & Accountability

| Area | Owner | Stakeholder |
|------|-------|-------------|
| **Architecture & Schema** | Tech Lead | Frontend/Backend leads |
| **Frontend Build** | Frontend Team | UX/Design, Tech Lead |
| **Backend Integration** | Backend Team | Frontend lead |
| **QA & Testing** | QA Team | Tech Lead |
| **Vendor Pattern Analysis** | Architect | Tech Lead |
| **Documentation** | Tech Writer | All teams |

---

## Conclusion

BITcore's dual GUI landscape is a **controlled transition**, not a stalled project. Port 3000 continues serving users while port 5173 is built methodically using proven patterns from Agent Zero, Deerflow, Superfile, and Chatbot UI. By enforcing CLI ↔ Web parity and organizing features into four phases, we'll deliver a modern, professional interface in 8–9 weeks while managing risk and maintaining productivity.

**Next milestone:** Phase 1 acceptance gate (shell + palette + FCP <2.5s) by end of Week 3.

---

**Document Status:** 🟢 Active  
**Last Updated:** 2025-10-20  
**Revision:** 1.0 (Strategy Release)
