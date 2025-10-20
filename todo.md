<!--
Why: Keep GUI overhaul execution aligned with gui-plan and exemplar research while communicating precise, auditable work slices.
What: Tracks remaining implementation batches for the BITcore UI Next surface with file-level references and test/verification hooks.
How: Presents machine-readable backlog data plus terse narrative sections so engineers and automations can consume the same source of truth.
-->

```json
{
	"artifact": "ui-next-overhaul",
	"inputs": [
		"app/public/ui/src/App.tsx",
		"app/public/ui/src/components/layout/",
		"app/public/ui/src/components/primitives/",
		"refactor-plan/gui-plan.md",
		"refactor-plan/perfected-architecture/08-interface-system.md",
		"refactor-plan/sandbox/vendor/agent-zero/webui/",
		"refactor-plan/sandbox/vendor/semantic_flow/",
		"refactor-plan/sandbox/vendor/chatbot-ui/"
	],
	"outputs": [
		"Refactored shell layout with Sidebar + CommandSurface + InsightDeck",
		"Navigation parity matrix sourced from CLI metadata",
		"Modular insight deck with mission/tool controls",
		"Skin-specific overrides honoring ThemeProvider tokens",
		"Transport adapters for telemetry/log streams",
		"Updated Ladle captures and test coverage"
	],
	"batches": [
		{
			"id": "FR-401",
			"title": "Implement ShellLayout orchestration",
			"status": "in-progress",
			"references": [
				"app/public/ui/src/components/layout/ShellLayout.tsx",
				"app/public/ui/src/App.tsx",
				"refactor-plan/gui-plan.md#41-layout--skins"
			]
		},
		{
			"id": "FR-402",
			"title": "Build ShellSidebar + CommandSurface wiring",
			"status": "in-progress",
			"references": [
				"app/public/ui/src/components/layout/ShellSidebar.tsx",
				"app/public/ui/src/stores/commandPaletteStore.ts",
				"refactor-plan/sandbox/vendor/chatbot-ui/app/[locale]/[workspaceid]/page.tsx"
			]
		},
		{
			"id": "FR-403",
			"title": "Responsive grid + focus mode behavior",
			"status": "in-progress",
			"references": [
				"app/public/ui/src/components/layout/ShellLayout.tsx",
				"app/public/ui/src/stores/interfaceStore.ts",
				"refactor-plan/sandbox/vendor/vector-admin/frontend/src/layout"
			]
		},
		{
			"id": "FR-404",
			"title": "CLI metadata ingestion + sidebar navigation",
			"status": "in-progress",
			"references": [
				"app/commands",
				"app/public/ui/src/data/commandMetadata.ts",
				"refactor-plan/gui-plan.md#21-strategy-snapshot"
			]
		},
		{
			"id": "FR-405",
			"title": "Command palette parity enhancements",
			"status": "todo",
			"references": [
				"app/public/ui/src/components/CommandPalette.tsx",
				"refactor-plan/sandbox/vendor/agent-zero/webui/src/lib/components/CommandPalette.svelte"
			]
		},
		{
			"id": "FR-406",
			"title": "Modular InsightDeck with telemetry panels",
			"status": "todo",
			"references": [
				"app/public/ui/src/components/ResearchTelemetryCard.tsx",
				"app/public/ui/src/components/LogsViewer.tsx",
				"refactor-plan/sandbox/vendor/deerflow/web/src/components/telemetry"
			]
		},
		{
			"id": "FR-407",
			"title": "Mission control + tool dock scaffolding",
			"status": "todo",
			"references": [
				"app/public/ui/src/stores/missionStore.ts",
				"refactor-plan/sandbox/vendor/agent-zero/webui/src/routes/(app)/scheduler",
				"refactor-plan/gui-plan.md#43-observability-surfaces"
			]
		},
		{
			"id": "FR-408",
			"title": "Skin-specific shell overrides (Hacker/Modern/Retro)",
			"status": "todo",
			"references": [
				"app/public/ui/src/theme/ThemeProvider.tsx",
				"refactor-plan/sandbox/vendor/semantic_flow/src/styles",
				"refactor-plan/sandbox/vendor/chatbot-ui/components/ui"
			]
		},
		{
			"id": "FR-409",
			"title": "Transport adapters (React Query + WebSocket bridge)",
			"status": "todo",
			"references": [
				"app/public/ui/src/utils/time.ts",
				"app/public/ui/src/stores/researchTelemetryStore.ts",
				"refactor-plan/gui-plan.md#42-state--transport"
			]
		},
		{
			"id": "FR-410",
			"title": "Accessibility + performance hardening",
			"status": "todo",
			"references": [
				"app/public/ui/src/components/primitives",
				"refactor-plan/gui-plan.md#6-parity-accessibility-performance"
			]
		},
		{
			"id": "FR-411",
			"title": "Regression guards + Ladle capture",
			"status": "todo",
			"references": [
				"tests/ui",
				"gui-improvements/",
				"refactor-plan/sandbox/current_gui_photos"
			]
		}
	]
}
```

# UI Next Overhaul Backlog (Revision 2025-10-20)

- **Batch FR-401 → FR-403 (Shell Architecture — In Progress)**: split `App.tsx` into `ShellLayout`, `ShellSidebar`, `CommandSurface`, `InsightDeck`; apply responsive breakpoints and focus-mode collapse using tokenized styles (refs: `app/public/ui/src/components/layout/`, `refactor-plan/gui-plan.md §4.1`, Agent Zero dashboard shell).
- **Batch FR-404 → FR-405 (Navigation Parity)**: hydrate sidebar from `app/commands/*.cli.mjs`, surface categories, flags, shortcuts, and deepen command palette parity with keyboard badges (refs: Chatbot UI sidebar, `refactor-plan/gui-plan.md §2`).
- **Batch FR-406 → FR-407 (Insight & Missions)**: compose telemetry/log/memory panels into a slot-based deck, add mission control and tool dock scaffolds inspired by Agent Zero and Deerflow observability modules (`refactor-plan/gui-plan.md §4.3`).
- **Batch FR-408 (Skin Overrides)**: ensure Hacker/Modern/Retro skins restyle the new shell, cards, and typography consistently with Semantic Flow and Chatbot UI motif captures; respect `/config set ui.theme` parity.
- **Batch FR-409 (Transport Bridge)**: add cancellable React Query polling and WebSocket adapters for telemetry + mission events, exposing discriminated unions per blueprint (`refactor-plan/gui-plan.md §4.2`).
- **Batch FR-410 (A11y + Performance)**: enforce WCAG focus states, semantic landmarks, lazy loading, and bundle guardrails; verify with axe + Lighthouse targets (`refactor-plan/gui-plan.md §6`).
- **Batch FR-411 (Verification Assets)**: extend Vitest coverage for new stores/components, run Ladle smoke, capture updated screenshots for change log, and sync with `gui-improvements/` gallery.

> Status legend: `todo` = not started, `in-progress` = active development, `blocked` = awaiting dependency, `done` = merged & verified.
# UI Next Overhaul

## Batch 1 – Phase 0 Foundations (In Progress)
- [x] FR-001 Extract canonical design tokens from legacy CSS into `app/public/ui/tokens.json` plus generator script for `tokens.css` and ANSI map.
- [x] FR-002 Scaffold Vite + React + TypeScript workspace under `app/public/ui/` with linting aligned to repo standards.
- [x] FR-003 Implement `ThemeProvider` with Hacker/Modern/Retro skins and persisted selection.
- [x] FR-004 Stand up Ladle component catalog showcasing primitives (Button, Input, Card, ProgressRing) fed by shared tokens.

## Batch 2 – Phase 1 Console Core (Queued)
- [x] FR-101 Implement `useTerminalStore` with Zustand and scaffold `TerminalShell` using `react-window` virtualization.
- [x] FR-102 Draft command palette shell with Fuse-powered fuzzy search and CLI metadata stubs.
- [x] FR-103 Introduce prompt modal primitives for password/confirm/select flows (placeholder wiring).
- [x] FR-104 Wire keyboard shortcut handlers (`⌘K`, focus mode toggles) guarding browser conflicts.

## Batch 3 – Phase 2 Insights & Dashboards
- [x] FR-201 Stand up research telemetry card with progress ring, stage timeline, and token stats (demo wiring).
- [x] FR-202 Refresh model browser with filter chips, sortable columns, and detail drawer.
- [x] FR-203 Lay out memory timeline panel with commit history and GitHub sync indicators.
- [x] FR-204 Build logs viewer with streaming tail, severity filters, and search.

## Batch 4 – Phase 3 Multi-Skin Surface
- [x] FR-301 Ship retro Win95 skin with window chrome accents and theme-aware component styling.
- [x] FR-302 Deliver modern chat skin with bubble layout and avatar styling.
- [x] FR-303 Harden hacker console skin with ANSI accent states and reduced chrome.
- [x] FR-304 Surface theme switcher in settings drawer and wire `/config set ui.theme` parity.
- [x] FR-305 Allow skin-specific component overrides for card/window primitives.

## Verification Checklist
- [x] Document Why/What/How docblocks for every new source file.
- [x] Run `pnpm install` after dependency changes and capture output summary.
- [x] Add minimal unit tests (Vitest) for token generator and ThemeProvider switching.
- [ ] Capture Ladle smoke screenshot once UI primitives stabilize.
- [x] Validate new console primitives via targeted Vitest suites (Ladle stories pending).
