# AGENTS

Pragmatic guidance for building, extending, and maintaining agents and modules in this codebase. Keep it small, modular, testable, and scalable by design.

## Core Principles

- Contract first: define Inputs, Outputs, Error modes, and performance budgets (time/memory) before coding.
- One intent per change: keep slices small, consistent, and verifiable.
- Separate concerns: one module, one role; isolate IO from core logic.
- Favor composition over inheritance: build small pieces and wire them.
- Test behavior: verify observable outcomes, not implementation details.
- Immutability at boundaries: copy on input/output; treat external data as read-only.
- Improve code health with every change: naming, docs, tests, and structure.
- Read top-down: Guard → Do → Verify. Make the code tell a story.
- Scalability by design: design for future growth without rewrites.
- Keep files small: target 300–500 lines per file (soft ceiling 500). Split earlier if clarity improves.
- Agent is autopoeitic, indendependent and self-evolving.
- Ideally, you always try to min-max.
- Every feature, setting, option and similar toggles should be included in the terminal cli and in the web gui as well. Users must be able to use the ENTIRE app from the CLI and be able to use the ENTIRE app from the web gui.

## Repository Conventions (Context-aware)

- ESM everywhere: `.mjs` modules with named exports. Avoid default exports.
- Directory roles:
  - `app/commands/*.cli.mjs`: Thin CLI entrypoints; parse args and call feature modules.
  - `app/features/*`: Feature-level HTTP/WS routes, handlers, controllers; compose infrastructure and utils.
  - `app/infrastructure/*`: External systems (AI/LLM, memory, search). Pure adapters; no domain logic.
  - `utils/`: Pure utilities; no side effects; reusable across features.
  - `tests/` and `app/tests/`: Unit and integration tests (Vitest).
- Avoid circular deps; if boundaries get fuzzy, split or introduce an interface in `utils/`.
- Keep `index.mjs` files minimal; prefer explicit imports at call sites.

## Contract-First Design

Before writing code, define and document the contract in the top-of-file docblock and tests.

Include:
- Inputs: types, required/optional fields, constraints, and defaults.
- Outputs: structure, invariants, and partial/streamed shapes when applicable.
- Error modes: typed error classes or result discriminants; retries/idempotency.
- Time budget: e.g., soft 2s, hard 5s; add timeouts and cancellation (AbortSignal).
- Space budget: peak memory expectations; streaming vs. buffering.
- Side effects: IO calls, cache writes, WS messages; ensure they are explicit.
- Telemetry: log events, metrics, correlation IDs, and sampling.

Template:

```
/**
 * Contract
 * Inputs:
 *   - input: ResearchQuery { topic: string; depth?: number }
 *   - signal?: AbortSignal
 * Outputs:
 *   - ResearchPlan { steps: Step[]; costEstimate?: number }
 * Error modes:
 *   - ValidationError, TimeoutError, ProviderRateLimited, UpstreamError
 * Performance:
 *   - time: soft 2s, hard 5s; memory: <50 MB peak
 * Side effects:
 *   - Calls venice LLM, writes to memory cache when enabled
 */
```

## Guard → Do → Verify (Top‑down flow)

Write functions so readers see the decision path immediately.

```
export async function planResearch(input, opts = {}) {
  // Guard
  requireValid(input);       // validate, normalize, default
  const { signal, logger } = prepareContext(opts);

  // Do
  const draft = await composePlan(input, { signal, logger });

  // Verify
  assertPlan(draft);         // invariants, shape, cost bounds
  return freezeResult(draft);
}
```

- Guard: `require(valid(input))` — validate and normalize near the boundary.
- Do: only the essential steps; delegate details to helpers.
- Verify: assert invariants and constraints before returning.

## Modularity and File Size

- 300–500 LOC per file. If a file grows beyond ~400 lines, consider splitting by responsibility.
- Keep public surface area small. Export the minimum needed.
- Separate side-effectful wiring from pure logic. Pure logic is easiest to test.

Recommended split for non-trivial features:
- `*.controller.mjs` (orchestrates use-cases)
- `*.service.mjs` (domain operations; composed)
- `*.adapter.mjs` (talks to external APIs; infrastructure)
- `*.schema.mjs` (validation and normalization)
- `*.types.mjs` (JSDoc typedefs or TS types if adopted later)

## Composition over Inheritance

- Prefer small functions and pipelines. Example: research pipeline composes search → summarize → cite.
- Use higher-order functions to inject concerns (logging, caching, rate-limiting) without coupling.

```
const withRateLimit = (fn, limiter) => async (...args) => limiter.schedule(() => fn(...args));
```

## Testing (Vitest)

- Put tests near features (e.g., `tests/research-*.test.mjs`). See `vitest.config.js`.
- Test behavior: happy path, one boundary, one failure mode.
- Keep tests fast and deterministic. Mock external IO at edges.
- Use contract-based tests: Inputs → Outputs → Error modes → Timing.
- Add a tiny smoke test for each new CLI entry.

Test checklist:
- Valid input returns correct shape and invariants.
- Invalid input triggers ValidationError with clear message.
- Timeouts/cancellation respected (AbortSignal).
- Retries capped; backoff applied for rate-limits.
- Logs include correlation id; no secrets leaked.

## Observability and Logging

- Structured logs: `{ level, msg, module, correlationId, ...context }`.
- Use consistent levels: debug (dev), info (milestones), warn (recoverable), error (actionable).
- Never log secrets or raw provider payloads without redaction.
- Correlate: pass `correlationId` across module boundaries.

## Configuration and Secrets

- Load config via `app/config/index.mjs`; wire once at boundaries.
- Secrets via environment variables; never commit them.
- Feature flags: guard experimental paths; default to safest behavior.

## External Services (LLM, Search, Memory)

- Venice LLM: go through `infrastructure/ai/venice.*.mjs` clients and processors.
- Rate limits: use `utils/research.rate-limiter.mjs` or a provider-specific limiter.
- Retries: limited attempts with jittered backoff; classify retryable vs. fatal errors.
- Streaming: prefer streaming outputs; process incrementally instead of buffering everything.

## Data and Immutability at Boundaries

- Freeze or clone outputs returned from a module to prevent accidental mutation.
- Validate and normalize inputs immediately upon entry.
- Represent time and IDs explicitly; avoid hidden global state.

## Comments and Documentation

- Each file starts with a short “Why/What/How” block explaining purpose and role.
- Public functions have JSDoc with param/return/error docs and invariants.
- Reference related guides in `guides/` when helpful.
- Keep examples updated and runnable.
- Summarize architecture and behavior only; keep comments concise, precise, timeless, and never use them for TODOs or meta-notes.

## Coding Standards (ESM + async)

- Use `async/await`; propagate errors with context (wrap with cause when needed).
- Define error classes for domain errors; avoid throwing strings.
- Avoid default exports; prefer named exports for clearer composition.
- No magic numbers/strings: centralize constants.
- Avoid shared mutable state; prefer passing explicit context objects.

## Change Management and PR Hygiene

- One intent per PR; keep diffs small and cohesive.
- Update docs and tests alongside code changes.
- Commit message format:
  - `feat(scope): short summary`
  - `fix(scope): short summary`
  - `refactor(scope): short summary`
  - Body: motivation, approach, risks, follow-ups.
- PR checklist:
  - Contract documented (inputs/outputs/errors/perf)
  - Tests added/updated; pass locally
  - Logs/metrics added where useful; secrets redacted
  - File size within guideline; no cycles introduced
  - Reviewers can run it in <5 minutes

## Surgical Mindset: precision over velocity

Treat the codebase like surgery: one wrong move can “kill the patient.” Success means keeping the system alive while making precise, minimal, reversible improvements that demonstrate planning and prudence.

Principles:
- First, do no harm: prefer the smallest viable change that solves the problem.
- Make it reversible: keep a clear rollback path (feature flag, revertible commit, or isolation).
- Reduce blast radius: isolate changes to a single module/role and introduce seams rather than rewrites.

Pre‑op (Preparation):
- Trace the call graph: identify entry points, side effects (IO), and downstream invariants.
- List contracts and invariants that must not break (inputs/outputs, timing, memory, retries).
- Identify boundaries where to add guards and assertions; note unknowns and assumptions explicitly.
- Choose instrumentation points (logs, metrics, correlationId) for verification after the change.

Operation (Execution):
- One intent per change; avoid mixing refactors and features.
- Prefer additive changes (new function/module) over invasive edits; wire it behind interfaces.
- Guard → Do → Verify in every public function; assert invariants before returning.
- Keep diffs small; avoid drive‑by edits; respect the 300–500 LOC/file guidance.
- Log only structured, non‑sensitive context; include `correlationId` and module name.

Safety nets:
- Feature flags or toggles default‑off; provide a kill‑switch.
- Timeouts using AbortSignal; bounded retries with jitter; classify retryable vs. fatal errors.
- Idempotency for external side effects; partial failures leave the system recoverable.
- Backpressure and rate limits where applicable; avoid unbounded concurrency.

Post‑op (Verification & Monitoring):
- Tests: happy path + boundary + one failure mode; fast and deterministic.
- Smoke test critical paths (CLI and WS when relevant); run lint/type checks.
- Verify logs/metrics show expected events without leaking secrets.
- Observe in real usage; be ready to roll back immediately if anomalies appear.

Evidence of planning (what reviewers look for):
- Clear contract comment and updated tests.
- Short rationale in the commit/PR body: goal, approach, risks, rollback plan.
- Minimal blast radius; modular composition; explicit flags/timeouts/retries.

Rollback playbook:
- Revert the last commit or disable the feature flag; roll forward only after root cause is confirmed.
- Ensure data migrations (if any) are reversible or guarded behind an opt‑in.

## Performance Budgets

- Set soft/hard timeouts for network calls and end-to-end actions.
- Memory: prefer streaming and generators when handling large payloads.
- Complexity: aim for linear or near-linear; call out hotspots in comments.

## Example: Agent Skeleton (Contextualized)

```
// Why: Plans and executes a focused research task.
// What: Composes search, LLM summarization, and memory citation.
// How: Guard → Do → Verify; rate-limited and cancelable.

import { search } from "app/infrastructure/search/search.mjs";
import { llmClient } from "app/infrastructure/ai/venice.llm-client.mjs";
import { withLimiter } from "utils/research.rate-limiter.mjs";

export async function runResearchAgent(request, { signal, logger, limiter }) {
  // Guard
  const input = normalizeRequest(request);
  validateRequest(input);

  // Do
  const limitedSearch = withLimiter(search, limiter);
  const results = await limitedSearch(input.query, { signal });
  const summary = await llmClient.summarize(results, { signal });

  // Verify
  assertSummary(summary);
  return Object.freeze({ summary, sources: results.slice(0, 5) });
}
```

## Review Questions (Use in PRs)

- Does the module have exactly one responsibility and a clear contract?
- Are inputs validated and outputs verified (invariants) at the boundaries?
- Is the file <500 LOC and logically organized?
- Are error modes clear and tested? Are retries/idempotency appropriate?
- Is composition favored over inheritance? No hidden coupling?
- Are logs structured and secrets redacted?
- Are time/memory budgets defined and enforced?
- Would a new contributor understand the why/how from the docblock?

---

This document is living. If a guideline helps us move faster with confidence, adopt it. If it gets in the way, refine it. Build systems that are timeless because they are simple, explicit, and well-factored.