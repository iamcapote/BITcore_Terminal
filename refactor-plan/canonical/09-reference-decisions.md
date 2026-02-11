<!--
Why: Preserve governance, reference, and decision history for the refactor plan.
What: Ownership, reading guide, decision log, open questions, next steps, rollout, and reference summary.
How: Group the canonical reference and decision sections for quick lookup.
Status: active
Last Updated: 2026-02-02
-->

# Reference & Decisions

## 18) Ownership & Accountability

| Area | Owner | Stakeholder |
| --- | --- | --- |
| Architecture & Schema | Tech Lead | Frontend/Backend leads |
| Frontend Build | Frontend Team | UX/Design, Tech Lead |
| Backend Integration | Backend Team | Frontend lead |
| QA & Testing | QA Team | Tech Lead |
| Vendor Pattern Analysis | Architect | Tech Lead |
| Documentation | Tech Writer | All teams |

## 40) Recommended Reading & Vendor Resources

**Architects**: this plan → perfected-architecture/01 → perfected-architecture/02 → AGENTS.md

**Frontend**: this plan → GUI_MIGRATION_STRATEGY.md → refactor-plan/gui-plan.md → VENDOR_COMPARISON_MATRIX.md → todo.md → CLI metadata export

**Backend**: agent system + tools/capabilities + research pipeline

**QA/DevOps**: live-test checklist + security regression + performance budgets

Vendor sources are optional; delete after the Vendor Deletion Readiness Checklist is fully satisfied.
Visual references from `refactor-plan/assets/gui-improvements/*.png` remain canonical for UI layout snapshots.
Documentation updates tracked in `DOCUMENTATION_ROADMAP.md` and `langchain/migration-log-2025-10-17.md`.

## 40.1) How to Use the Perfected-Architecture Pack

**Entry path**
1) Core philosophy → system architecture → environment/agent/tools/filesystem/memory/interface/customizability.
2) Implementation roadmap for sequencing and QA gates.

**Roles**
- Architects: validate contracts and boundaries before roadmap signoff.
- Developers: implement in Guard → Do → Verify slices with contract docblocks.
- Operators: configure filesystem/memory/interfaces before launching missions.
- QA/Sentinel: align tests with tooling, memory, and roadmap modules.

**Change management**
- One module per change when possible; update docblocks and cross-links.

## 40.2) How BITcore Differs From Predecessors

**Agent Zero**: BITcore inherits tool registry and dashboards but emphasizes emergent reasoning and multi-tier memory over scheduled flows.

**Deerflow**: BITcore adopts orchestration + telemetry patterns while generalizing beyond research-only workflows.

**Superfile**: BITcore extends parity doctrine from file navigation into full-system CLI ↔ GUI symmetry.

## 40.3) Contributor Mindsets (Orientation)

- **Bottom-up**: follow `AGENTS.md` for contracts, Guard → Do → Verify, and module size limits.
- **Middle-out**: map features into concentric rings and guard boundaries.
- **Top-down**: preserve the ophanim vision and emergence-first composition.
- **Pragmatic**: track execution in the migration roadmap and QA gates.

## 41) Decision Log
- Nova is canonical UI.
- Legacy UI retained for benchmarking and historical reference.
- Single-user contract enforced.

## 41.1) Open Questions (Execution)
- Preferred Phase 1 starting point: BaseAgent core vs. environment system.
- Default environment choice: SeedCore vs. Debian Slim for coordinator workloads.
- UI skin priority: Win95 vs. Modern vs. TUI for Phase 6 sequencing.
- Memory consolidation cadence: daily vs. weekly.
- Extension naming convention: hooks vs. middleware.
- Context Canvas scope: read-only preview vs. full edit in Phase 3.
- Code interpreter rollout: CLI-only first vs. Nova surface in Phase 2.

## 41.2) Next Steps (Execution)
1) Review and approve the perfected architecture scope.
2) Prioritize phases (recommended sequence: Phase 0 → Phase 1 → Phase 3).
3) Begin BaseAgent implementation in the new modular layout.
4) Create the first custom environment (TinyCore).
5) Port Superfile file browser patterns into the TUI and web panels.

## 42) Rollout & Rollback
- Rollout: dev → staging → beta → production.
- Rollback: restore prior Nova build or revert to CLI-only mode.

## 42.1) Execution Resilience & Tracing
- Node-level error tolerance: failed nodes do not halt the full pipeline; aggregate failures into the final report with remediation hints.
- Tracing overlays: workflow graph renders node states (pending/active/complete/failed) with state snapshots at each transition.

## 43) Reference Guide
- Architecture philosophy and layering.
- Vendor pattern index.
- QA + parity doctrine.
- Immediate next actions.
