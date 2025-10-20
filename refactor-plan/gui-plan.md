---
why: "Deliver a cohesive BITcore interface that mirrors CLI capability, exposes agent telemetry, and supports multi-skin experiences without regressing velocity."
what: "Actionable modernization blueprint describing layout architecture, state flows, parity requirements, and milestone gates for web UI delivery."
how: "Translate perfected-architecture mandates and MIT exemplar patterns into a staged React/Vite implementation with shared design tokens and CLI-linked telemetry."
status: active
lastUpdated: "2025-10-20"
revision: 3
owners:
  - Web Platform Team
  - UX-Systems Guild
inputs:
  current_codebase:
    - app/public/ui/src/App.tsx (ThemeProvider + shell prototype)
    - app/public/ui/src/components/primitives/* (token-aware primitives)
    - app/commands/*.cli.mjs (CLI metadata for parity matrix)
    - guides/ (perfected-architecture references)
  mit_exemplars:
    - sandbox/vendor/agent-zero/
    - sandbox/vendor/semantic-flow/
    - sandbox/vendor/chatbot-ui/
outputs:
  - "Modular shell layout with sidebar, command surface, and insight deck across three skins"
  - "Instrumentation surfaces exposing research, memory, mission, and tool telemetry"
  - "Command palette bound to CLI metadata with keyboard-first navigation"
nonGoals:
  - "Introduce multi-tenant authentication during this modernization cycle"
  - "Rebuild backend transport protocols beyond required telemetry contracts"
constraints:
  - "UI/CLI parity for every command and toggle (AGENTS doctrine)"
  - "300–500 LOC envelope per module, split before bloat"
  - "WCAG 2.2 AA compliance and 3G FCP <2.5s"
---

# GUI Modernization Blueprint (Revision 3)

## 1. Strategy Snapshot
- **Parity First**: Every CLI command, flag, and toggle must appear in the web surface with the same defaults and guardrails.
- **One Engine, Many Skins**: Hacker Console (default), Modern Chat, and Retro Win95 skins share logic through ThemeProvider overrides.
- **Observability Native**: Telemetry, mission states, and tool usage render as live, filterable dashboards beside the command surface.
- **Keyboard Priority**: Command palette (`⌘K`), global shortcuts (`⌘,`, `⌘B`, `⌘M`, `⌘T`, `⌘⇧A`), and accessible focus rings drive the interaction model.
- **Progressive Migration**: Legacy DOM scripts bridge via event bus until milestones hit coverage gates; feature flag `UI_NEXT_ENABLED` controls rollout.

## 2. Baseline Audit
| Surface | Current Pain | Target Outcome |
| --- | --- | --- |
| Shell layout | Wiki-styled chrome, console buried, no responsive grid | Three-column responsive shell with collapsible sidebar and focus mode |
| Command invocation | CLI-only discovery, no fuzzy search, modals inline | Command palette with CLI metadata, accessible prompt components |
| Telemetry | Text streams, no charts, logs hard to parse | Card-based telemetry deck with progress rings, sparklines, log tail filters |
| Memory & archives | Sparse dashboards, GitHub sync opaque | Memory cortex timeline + archive explorer with diff/export actions |
| Tooling & missions | MCP/tool registry and mission control absent | Tool dock, engine deck, agent mission control with intervention controls |

## 3. Reference Motifs (MIT Exemplars)
- **Agent Zero**: Multi-panel dashboard, MCP/tool management, scheduler controls → informs tool dock, mission control, cron drawer.
- **Semantic Flow**: Win95 chrome, node canvas, theme token discipline → drives Retro skin, drag-to-rewire mission canvas (Phase 5+).
- **Chatbot UI**: Sidebar conversations, streaming message actions, settings drawer → influences Modern Chat skin and quick settings approach.

## 4. Architecture Plan

### 4.1 Layout & Skins
- Shell comprised of `ShellLayout`, `Sidebar`, `CommandSurface`, `InsightDeck` components; skins override primitives via ThemeProvider registry.
- Breakpoints: `<1024px` stacked tabs; `1024–1439px` shell + collapsible deck; `>=1440px` sidebar + command surface + deck.
- Focus mode (`⌘F`) collapses chrome; theme switcher lives in settings panel and CLI command `/config set ui.theme`.

### 4.2 State & Transport
- Zustand stores (`terminalStore`, `telemetryStore`, `agentStore`, `toolStore`, `memoryStore`) isolate responsibilities and expose selectors.
- React Query handles HTTP polling (status, archives); WebSocket adapter normalizes `telemetry:*`, `agent:*`, `instrument:*` events with discriminated unions.
- Legacy bridge class dispatches `react:*` CustomEvents to maintain old script compatibility until cutover gate is satisfied.

### 4.3 Observability Surfaces
- Telemetry deck modules: Research status (progress ring + stage timeline), token usage (gauge + sparkline), log tail (streaming list + filters), memory commits (timeline), mission board (kanban), engine deck (parallel run timelines).
- Tool & MCP dock reveals registry, connection state, dry-run actions; mission control tree shows hierarchy, timers, intervention buttons.

## 5. Milestones & Acceptance Gates
| Sprint | Focus | Acceptance Tests | Flag Criteria |
| --- | --- | --- | --- |
| Sprint 0 (Week 1) | Plan alignment, token contract, CLI metadata export | Updated `gui-plan.md`, todos, ANSI mapping stub | Documentation sign-off |
| Sprint 1 (Weeks 2–3) | Shell layout + palette | Vitest for stores, Playwright palette search, keyboard nav audit | Feature flag `UI_NEXT_ENABLED=true` (dev only) |
| Sprint 2 (Weeks 4–5) | Telemetry deck + archives | WebSocket contract tests, Playwright research run, axe scan ≥90 | Enable flag for staging |
| Sprint 3 (Weeks 6–7) | Skin parity + responsive modes | Percy snapshots (3 skins), Lighthouse FCP <2.5s, CLI parity script green | Enable flag for beta users |
| Sprint 4 (Weeks 8–9) | Mission control + tool dock | Agent/tool stores coverage, mission intervene E2E, MCP connect flow | Flip flag default to new UI |

## 6. Parity, Accessibility, Performance
- Auto-generate parity matrix from `app/commands/*.cli.mjs` to assert GUI coverage in CI.
- Keyboard shortcuts documented in help modal (`?`) and denoted with badges in UI.
- WCAG 2.2 AA: semantic landmarks, live regions for streaming text, focus-visible outlines, color contrast checks per theme.
- Performance budgets: initial bundle <350 KB gzip, WebSocket connect <500 ms median, command palette render <100 ms, theme swap <50 ms.

## 7. Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| Event schema drift between backend and stores | Generate TypeScript event schemas, add contract tests in `tests/ui-events.test.mjs` |
| Bundle bloat from multi-skin assets | Enforce budgets with bundle analyzer, lazy-load skin-specific overrides |
| Accessibility regressions during rapid iteration | Run axe in CI, schedule weekly manual keyboard audits |
| Operator confusion during rollout | Feature flag with CLI toggle, publish migration guide, maintain `/ui-legacy` fallback through Sprint 3 |

## 8. Immediate Next Actions (Week of 2025-10-20)
- Finalize motif capture from Agent Zero, Semantic Flow, Chatbot UI and attach snapshots to design board.
- Publish token + ANSI mapping contract and wire into ThemeProvider documentation.
- Implement CLI metadata extractor producing JSON for command palette ingestion.
- Draft low-fidelity wireframes for shell layout across three skins and circulate for review.

## 9. Metrics Dashboard
- Lighthouse (Performance ≥90, Accessibility ≥90) on CI.
- Web telemetry events for palette open duration, theme switch latency, WebSocket connect time.
- CLI parity script: fail build if any command lacks GUI binding metadata.

## 10. Rollout & Rollback
- Rollout: dev → staging (Sprint 2) → beta (Sprint 3) → default (Sprint 4) with 2-week soak each.
- Rollback: flip `UI_NEXT_ENABLED=false`, redeploy, retain legacy bundles until Sprint 5 completion.

> This blueprint supersedes revision 2. Review weekly and update metrics, milestones, and risks as work progresses.
