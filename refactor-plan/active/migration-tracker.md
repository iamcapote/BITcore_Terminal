<!--
Why: Track remaining legacy→Nova migration surfaces and Phase 4 retirement plan.
What: 4 unwired surfaces, phase checklist, next steps.
How: Phases 1 and 2 complete; Phase 3 partial; focus is resolution of remaining mocks.
Last Updated: 2026-04-02
-->

# Nova Surface Migration

**Phases 1 and 2 complete. Phase 3 partial. 4 surfaces (+ 1 workflow stub) remain.**

## Remaining Surfaces (Phase 3 open items)

| Surface | Component | Status | What's Needed |
| --- | --- | --- | --- |
| Explorer | `EditorSurface` | unwired | Connect to `/api/files/tree` + `/api/files/git/*`; backend exists (Pass-07) |
| Databases | `DatabaseManagerSurface` | unwired | Define backend route contract first; currently full mock |
| Agents display | `AgentSurfaces.tsx` | partial | Replace `mockWorkspace` profile/activity/MCP rows with live `/api/ai/swarm/overview`; swarm backend complete (Passes 1-12) |
| Instruments/Skills | `OperationsSurfaces.tsx` | unwired | Define backend contract; amber preview banner present |
| Workflows/Schema | `WorkflowBuilderSurface` + `WorkflowCoreSurfaces` | partial | Execution contract not defined; semantic ontology vendor import stubbed |

## Phase 4: Retirement (once remaining surfaces wired)
- [ ] Feature flag for legacy GUI toggle
- [ ] Acceptance testing with operators
- [ ] Legacy GUI deprecation notices
- [ ] Final switchover + legacy route removal

## Next Actions
1. Wire Explorer — connect `EditorSurface` to Pass-07 backend (`/api/files/tree` + `/api/files/git/*`)
2. Clean Agents — remove `mockWorkspace` profile/activity imports; wire `/api/ai/swarm/overview`
3. Define DB + Instruments contracts before wiring
