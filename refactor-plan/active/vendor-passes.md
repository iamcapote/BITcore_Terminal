<!--
Why: Standardize how BITcore extracts architecture lessons from each vendor and turns them into safe executable scaffolds.
What: Defines the vendor-pass lifecycle, acceptance gates, deliverables, and a reusable pass worksheet.
How: Enforces a mock-first then gradual-wire cadence across backend, CLI, and Nova with parity and guardrails.
Status: active
Last Updated: 2026-02-17
-->

# Vendor Pass Framework

## Objective

Every vendor pass answers three questions before coding:

1. What architecture pattern is worth adapting?
2. What executable seam must exist in BITcore (infra + feature + CLI + Nova)?
3. What is the smallest reversible slice that moves from mock to live safely?

## Pass Lifecycle (Mandatory)

1. **Discovery**
   - Read vendor docs and architecture notes.
   - Record swarm/orchestration semantics (roles, delegation, retries, handoffs, observability).
   - Capture BITcore target modules and constraints.

2. **Scaffold (Mock-First)**
   - Add infrastructure adapter/service contract.
   - Add feature controller/routes with strict validation.
   - Add CLI command parity for every operator action.
   - Add Nova partial wiring that fetches backend data and gracefully falls back to mocks.

3. **Staged Wiring**
   - Replace one mocked segment at a time behind feature flags.
   - Preserve stable response contracts so UI/CLI do not churn.
   - Keep rollback simple (toggle/route disable).

4. **Verification**
   - Targeted unit tests for service/controller/routes/CLI.
   - Nova build + targeted frontend tests for new client wiring.
   - Update canonical docs with status and next wire step.

## Required Deliverables Per Pass

- **Architecture Note**: What we adapted and what we rejected.
- **Backend Seam**: infrastructure + feature routes with explicit contracts.
- **CLI Parity**: command(s) for inspect/status/mutate paths.
- **Nova Parity**: GUI consumes backend seam with fallback strategy.
- **Validation Log**: exact tests/build commands and outcomes.

## Acceptance Gates

### Gate A — Contract Integrity
- Inputs, outputs, and error modes documented in code docblocks.
- Public responses are immutable or treated read-only at boundaries.

### Gate B — Surface Parity
- Equivalent capability exists in CLI and Nova.
- Any intentionally deferred operation is listed explicitly.

### Gate C — Operational Safety
- Risky actions require validation and guardrail defaults.
- Rollback path exists (feature flag, route disable, or no-op mock mode).

### Gate D — Incremental Upgrade Path
- Mock behavior and live behavior share response shape.
- Next live wiring slice is scoped to one intent.

## Pass Worksheet Template

Copy this section for each vendor pass:

### Pass ID
- Vendor:
- Scope:
- Date:

### Findings
- Wiring model:
- Swarm semantics:
- Adapted patterns:
- Rejected patterns:

### BITcore Mapping
- Infrastructure target(s):
- Feature route target(s):
- CLI command target(s):
- Nova surface target(s):

### Execution Slice
- Mock seams added:
- Partial wiring added:
- Guardrails and rollback:

### Validation
- Tests run:
- Build checks:
- Result:

### Next Slice
- First live integration step:
- Deferred work:

## Next Vendor Queue

1. `flowise` — deterministic tool-chain graph execution tracing and replay-safe node logs.
2. `deerflow` — live coordinator event handoff (next slice: checkpoint continuity).
3. `anything-llm` — document ingestion pipeline with MIME gating.
4. `librechat` — live OAuth provider adapter (next slice: MCP OAuth reconnect).
3. `anything-llm` — document ingestion pipeline with MIME gating and quota checks wired to vector surface.