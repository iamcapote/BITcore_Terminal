<!--
Why: Drive Nova delivery with a front-end-first plan that starts with high-leverage wins.
What: Nova status, vision, gaps, roadmap, checklist, parity, immediate actions, metrics, rollout, and blockers.
How: Preserve canonical content while ordering for front-end execution.
Status: active
Last Updated: 2025-07-18
-->

# Front-End Priorities (Nova-First)

## 5) Current State (Nova Canonical)
**Nova is the supported GUI surface.** The legacy UI remains available as a benchmark reference to measure improvements and preserve historical patterns.

**Completed Nova work**:
- Design tokens and theme foundations.
- Shell layout + surface manager + status bar.
- Navigation + explorer surfaces.
- UI primitives (buttons, cards, inputs, dropdowns, tabs, menubar, select, switch, table, textarea, tooltip, checkbox, scroll-area, separator, badge).
- Terminal provider + operations/agent surfaces.
- Nova integration and build verification.
- NovaShell split: extracted TopBar, ShellMenubar, ThemeSwitcher, SurfaceStage, shellTypes, shellMenuData, surfaceRegistry (NovaShell 1112→274 LOC).
- KnowledgeSurfaces split: VectorManagerSurface, DatabaseManagerSurface, MemoryManagerSurface, MetricsBoardSurface as individual files (barrel re-export preserved).
- SettingsSurface: tabbed settings with General, API Keys, Theme, Feature Flags panels (mock data, unwired).
- Additional UI primitives: Dialog, Skeleton, Progress, Avatar, Alert, Accordion.
- Dead file cleanup: removed empty chatMocks.ts, mockChat.ts, StatusChips.tsx, tailwind.config.ts.
- SurfaceId: 17 entries (added "settings").

**Foundation assets (still active)**:
- React + Vite + TypeScript scaffold (Nova).
- Zustand stores (drafts) and ThemeProvider (draft) for state + skin control.
- Ladle component catalog (draft) to preview primitives and surfaces.

**Verification log**: `pnpm run "nova:build"` succeeded (2025-07-18). `tsc --noEmit` clean. `vite build` 624 KB gzip.
**Implementation note**: References to `app/public/ui` have been removed across the codebase and documentation; legacy screens remain for comparison and measurement.

## 6) Nova Vision & Layout
- Chat-first IDE shell with left rail, central studio, right inspector, bottom tasks/logs.
- Skins: Hacker Console, Modern Chat, Retro Win95.
- Core views: Command Deck, Mission Briefs, Memory/Knowledge, Logs, Telemetry, Dry-run simulations.
- Agent flow stages: Plan → Simulate → Act.

**UX principles (Nova)**:
- Clarity & minimalism: every UI element has a single, explicit purpose.
- Elegant micro-interactions: subtle animations to reinforce action outcomes.
- Themeable: dark/light/retro parity with shared token contract.
- Fractal organization: layered surfaces stay scannable, not chaotic.
- Bento grid dashboards for telemetry and mission insights.

**Nova implementation sequence (explicit steps)**:
1) Establish app structure under `app/nova/` (base on `vscodefork.md`).
2) Restructure layout to match `vsagentic.md` (activity bar + sidebar).
3) Swap iconography to `novaide.md` standards.
4) Apply shadcn theme tokens for the Bitcore Nova identity.
5) Incrementally port features from vendor patterns and mockups.
6) Wire components to existing backend services and WebSocket streams.

## 6.1) Front-End Quick Wins (Vendor Pattern Harvest)
- **Streaming UX baseline**: token-by-token stream renderer, abortable stream handling, and recoverable stream errors.
- **Chat ergonomics**: message actions (copy/edit/regenerate), inline tool output cards, and file/vision attachments.
- **Conversation control**: branch/fork from any message and keep a history tree (single-user scoped).
- **Preset manager**: save/reuse chat presets (model + temp + system prompt) with instant switching.
- **Local embedding fallback**: browser-side embedding option for small docs with server-side override.
- **RAG chunking defaults**: 4k chunk size with 200 overlap as a starting point for ingestion pipelines.
- **Context canvas entry**: seed a “Context Canvas” surface (graph editor) as a read-only preview in Phase 2.
- **PWA readiness**: offline shell + service worker for cached UI shell and partial offline read.
- **Secrets editor**: masked-value editing with comment preservation and placeholder preview.
- **Scheduler board**: task list with `idle|running|disabled|error` states and run/wait controls.
- **Multi-model compare**: side-by-side response comparison panel for model evaluation (Chatbot-UI pattern).
- **Assistant builder**: create custom assistants with instructions, file attachments, and tool selection.
- **Clarification prompt**: inline clarification questions with round counter and history accordion (Deerflow pattern).
- **Plan approval gate**: show plan preview modal; user can `[EDIT_PLAN]` or `[ACCEPTED]` before execution.

## 9) Gap Analysis (Legacy + Nova)

**Legacy UI gaps**
Clutter, inconsistent tokens, weak hierarchy, minimal responsiveness, no MCP tooling.

**Nova gaps**
Telemetry deck, chat UI polish, memory timeline, responsive testing, accessibility audits. Settings surface scaffolded (mock data). Shell split complete — modules under 500 LOC.

**Legacy design debt (explicit)**:
- No cohesive token system; hardcoded colors and ad-hoc spacing.
- Typography inconsistency across surfaces; no scale.
- No reusable primitives; repeated bespoke CSS/HTML.
- Minimal responsiveness; desktop-first layouts.
- Hardcoded models and no provider abstraction.

## 10) Roadmap (Nova Expansion)

### Phase 1: Shell Foundation
- WebSocket transport layer
- Keyboard navigation
**Acceptance**: Lighthouse FCP <2.5s; keyboard audit green.

### Phase 2: Telemetry & Archives
- Research telemetry card
- Memory timeline
- Logs viewer
- Archive explorer
**Acceptance**: WebSocket contract tests; research run E2E; axe ≥90.

### Phase 3: Command Coverage & Responsive
- Chat UI with memory context
- Settings drawer (keys, preferences, config)
- Mission board + MCP dock
- Parity matrix automation
**Acceptance**: CLI parity script green; Percy snapshots for 3 skins.

### Phase 4: Polish & Rollout
- Performance budgets (bundle <350 KB gzip)
- WCAG 2.2 AA
- Retro skin parity
- Migration guide
**Acceptance**: WebSocket connect <500 ms median; accessibility pass.

### Phase 5+ (Horizon)
Mission canvas, advanced file navigator, vector DB UI, MCP orchestration, computer environment shell.

### Migration Controls (Legacy ↔ Nova)
- Dual-surface operating window: legacy UI (port 3000) remains available as a benchmark through parity verification and post-parity comparison windows.
- Rollback controls: feature flags reserved for rollback only; default behavior is Nova-first and not gated in daily use.
- Legacy route: keep `/ui-legacy` as a temporary fallback during the rollout window; remove after acceptance.
- Flag name: `UI_NEXT_ENABLED` (boolean) when used for incident rollback; default on for Nova once parity is confirmed.

## 11) Feature Checklist (Legacy → Nova)

### Research
| Component | Legacy | Nova | Phase |
| --- | --- | --- | --- |
| Research form | ✅ | ❌ | 1 |
| Query builder | ✅ | ❌ | 1 |
| Progress indicator | ✅ (text) | ❌ | 2 |
| Token counter | ✅ (text) | ❌ | 2 |
| Result display | ✅ | ❌ | 2 |
| Archive browser | ✅ | ❌ | 2 |

### Chat
| Component | Legacy | Nova | Phase |
| --- | --- | --- | --- |
| Chat form | ✅ | ❌ | 3 |
| Message display | ✅ | ❌ | 3 |
| Memory context | ✅ (text) | ❌ | 3 |
| Memory timeline | ✅ (text) | ❌ | 2 |
| In-chat commands | ✅ | ❌ | 3 |

### Settings
| Component | Legacy | Nova | Phase |
| --- | --- | --- | --- |
| API keys panel | ✅ (inline) | ⚠️ (mock) | 3 |
| Theme switcher | ✅ (basic) | ✅ (3 themes) | 3 |
| Config options | ✅ (inline) | ⚠️ (mock) | 3 |
| User preferences | ✅ (basic) | ⚠️ (mock) | 3 |

### Missions
| Component | Legacy | Nova | Phase |
| --- | --- | --- | --- |
| Mission list | ❌ (CLI basic) | ❌ | 3 |
| Task kanban | ❌ | ❌ | 3 |
| Intervention controls | ❌ | ❌ | 3 |

### Observability
| Component | Legacy | Nova | Phase |
| --- | --- | --- | --- |
| Logs tail | ✅ (text) | ❌ | 2 |
| Logs filter | ⚠️ (basic) | ❌ | 2 |
| Token metrics | ✅ (text) | ❌ | 2 |
| Event timeline | ❌ | ❌ | 2 |

## 12) Parity Strategy (CLI ↔ GUI)

**Pattern**
1) CLI metadata exports per command.
2) `GET /api/commands` serves metadata.
3) GUI renders forms/controls from metadata.
4) Parity tests assert exact match.

**Parity checklist**
- `/keys set` → Keys settings panel (Phase 3)
- `/config set ui.theme` → Theme switcher (Phase 3)
- `/research` → Research form + progress (Phases 1–2)
- `/chat` → Chat interface (Phase 3)
- `/memory stats` → Memory timeline (Phase 2)
- `/missions` → Mission board (Phase 3)
- `/help` → Help modal (Phase 1)
- `/security status` → Security status panel (Phase 3)
- `/export` → Download action (Phase 2)

## 13) Immediate Next Actions (Execution)

### Frontend
1) Responsive grid audit (320/768/1024/1440).
2) Theme token expansion for all component states.

### Backend/Infrastructure
1) Export CLI metadata (`app/commands/*.cli.mjs`).
2) Add `GET /api/commands` endpoint.
3) Align WebSocket telemetry schema + contract tests.
4) Ensure telemetry events carry `correlationId` + timestamp.

### Testing
1) Generate parity matrix in CI.
2) Add Vitest for stores and WebSocket event parsing.

## 15) Success Metrics

**Phase 1**
- Shell responsive, keyboard nav green.
- Lighthouse FCP <2.5s; Accessibility ≥90.

**Phase 2**
- Research telemetry live.
- Memory timeline + logs tail streaming.
- Archive explorer functional.
- WebSocket event tests ≥80% coverage.

**Phase 3**
- CLI ↔ Web parity matrix 100%.
- Chat UI with memory context.
- Settings drawer complete.
- Mission board with intervention controls.

**Phase 4**
- Bundle <350 KB gzip; WebSocket connect <500 ms.
- WCAG 2.2 AA across pages.
- Rollout complete; GUI telemetry dashboarded.

## 16) Rollout Strategy

| Period | Status | Surface | Users | Controls |
| --- | --- | --- | --- | --- |
| Sprint 1–2 | Dev | 5173 | Developers | Rollback flag |
| Sprint 2–3 | Staging | 5173 | Internal QA | Rollback flag |
| Sprint 3–4 | Beta | 5173 | Opt-in users | Rollback flag + feedback |
| Sprint 4+ | Production | Primary URL | All | Gradual rollout |

**Fallback**
- Legacy UI reference view remains available as historical context.
- Rollback uses prior Nova builds or CLI-only mode; a feature flag is reserved for rollback, not as a daily GUI gate.

## 17) Dependencies & Blockers

**External**
- React/Vite/TypeScript installed.
- Zustand installed.
- Telemetry endpoint alignment pending.
- CLI metadata export endpoint pending.

**Internal**
- Frontend depends on telemetry schema.
- Backend depends on telemetry store shape.
