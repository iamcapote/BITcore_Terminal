<!--
Why: Record the live readiness exercise outcomes for 2025-10-15.
What: Summarizes the automated Web CLI sweep against the live-test checklist with key evidence.
How: Replayed the checklist via `test-cli-simulation.js` using placeholder credentials and captured pass/fail notes per section.
-->

# Live Test Dry Run — 2025-10-15

## Execution Summary

- Ran `WEBCLI_START_SERVER=true BRAVE_API_KEY=placeholder VENICE_API_KEY=placeholder node test-cli-simulation.js` twice to drive the Web CLI scenario end to end while verifying command parity.
- Server booted cleanly (`Express server running.`) and telemetry channel came online for the simulated session.
- `/status`, `/keys set`, `/keys check`, `/memory stats`, `/memory store`, `/memory recall`, `/prompts list`, `/logs stats`, `/diagnose`, `/chat`, `/research`, `/export`, and `/exitmemory` were exercised through the WebSocket path.
- Venice chat completions failed with HTTP 401 (unauthorized), Brave search returned HTTP 422 (query rejected), and GitHub checks reported `Bad credentials`, confirming the absence of real API tokens.
- Research pipeline completed with an empty result set, generating a downloadable report stub and keeping the session snapshot when prompted.

## Checklist Coverage

**Environment & Accounts**
- Dependencies already installed; no installation issues observed during the run.
- Placeholder API keys set successfully via `/keys set`, but `/diagnose` logged `Brave: Failed (API 422)` and `GitHub: Failed (Bad credentials)`, while Venice chat requests returned `401 Unauthorized`.
- Secure-config overlay not enabled in this environment; the run confirmed single-user profile persisted under `/home/codespace/.bitcore-terminal`.

**CLI Smoke (simulated via WebSocket automation)**
- `/status`, `/keys set`, `/keys check`, `/memory stats`, `/memory store`, `/memory recall`, `/prompts list`, `/logs stats`, `/diagnose`, `/chat`, `/exit`, `/research`, and `/export` executed; chat and research surfaced credential-related errors yet continued through success paths where possible.
- Memory and logs flows now return expected output after normalizing WebSocket command routing; memory recall fell back to semantic search because Venice remained unauthorized.
- `/chat` session established, but message completions failed due to Venice authentication; `/exitmemory` produced a fallback summary because the LLM call failed.

**Web Terminal Smoke**
- WebSocket handshake, CSRF negotiation, and command routing functioned; download events were emitted for `/export`.
- Session prompts for research query and post-research action appeared and accepted responses.
- Upload/Keep options were reachable; **Keep** retained the snapshot, and the export produced `research/research-placeholder-research-topic-for-regression-sweep-2025-10-15T23-20-33-375Z.md`.

**Logs & Telemetry**
- Structured logs captured `research.websocket.command-handler` phases and telemetry events (`research-status`, `research-progress`, `research-complete`).
- Security status summary emitted aggregate token usage (all zeros, as expected without completions).

**Cleanup**
- Automation terminated the server with `SIGINT`; no lingering sessions observed.
- Snapshot remains in memory because the run chose **Keep**; follow-up `/research` → `Discard` still pending for a full cleanup pass.

## Outstanding Issues

- Provide valid Brave, Venice, and GitHub credentials (or mocks) to allow `/diagnose`, `/chat`, and `/research` to complete without auth failures.
- Re-run the checklist once credentials are available to confirm the remaining red paths and optionally discard the kept research snapshot via `/research` → `Discard`.
