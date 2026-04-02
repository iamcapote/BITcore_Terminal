<!--
Why: Single authoritative entry point for the BITcore refactor plan.
What: Explains folder structure, links to the right doc for each reading context.
How: Three-tier layout — active trackers, stable reference, archived history.
Last Updated: 2026-04-02
-->

# BITcore Refactor Plan

Three folders. Read the right one for your context.

---

## `active/` — Open items. Read these when planning work.

| File | What it contains |
| --- | --- |
| [active/current-status.md](active/current-status.md) | Current wiring state of all 21 surfaces, next 5 wins, verification checklist |
| [active/vendor-passes.md](active/vendor-passes.md) | Pass lifecycle framework, completed pass log (1-13), next vendor queue |
| [active/migration-tracker.md](active/migration-tracker.md) | Surface-by-surface legacy→Nova migration status (19/23 wired) |

---

## `architecture/` — Stable reference. Read these when implementing.

| File | What it contains |
| --- | --- |
| [architecture/03-ui-examples.md](architecture/03-ui-examples.md) | Pending surfaces: Context Canvas, Generative UI, Code Interpreter, skins |
| [architecture/04-foundations.md](architecture/04-foundations.md) | Architecture layers, CLI↔GUI parity mandate, single-user contract |
| [architecture/04b-vendor-patterns.md](architecture/04b-vendor-patterns.md) | Implementation reference: Chat surface patterns, streaming, markdown, presets, tool orchestration |
| [architecture/05-agent-platform.md](architecture/05-agent-platform.md) | Agent platform roadmap (Phases 0-8), tool surface, extensibility |
| [architecture/06-environments.md](architecture/06-environments.md) | Docker environment system, filesystem isolation, memory architecture |
| [architecture/07-protocols-qa.md](architecture/07-protocols-qa.md) | WebSocket protocol spec, memory sync, test patterns |
| [architecture/08-ops-risks.md](architecture/08-ops-risks.md) | Risk register, monitoring thresholds, alert definitions |

---

## `vendor-analysis/` — Vendor architecture studies with pending passes.

| File | Pending work |
| --- | --- |
| [vendor-analysis/deerflow-architecture.md](vendor-analysis/deerflow-architecture.md) | Pass-12 next slice: live coordinator event handoff |
| [vendor-analysis/anything-llm-architecture.md](vendor-analysis/anything-llm-architecture.md) | Next queue: document ingestion pipeline with MIME gating |
| [vendor-analysis/librechat-architecture.md](vendor-analysis/librechat-architecture.md) | Pass-11 next slice: live OAuth provider adapter |
| [vendor-analysis/semantic-flow-architecture.md](vendor-analysis/semantic-flow-architecture.md) | Workflow builder — context engineering canvas pending backend |
