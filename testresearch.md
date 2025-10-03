# BITcore Terminal – Test Research Log (2025-10-03)

## Automated Suites

- `npm test` (Vitest) – pass. 72 files, 343 tests executed, 4 skipped (includes the WebSocket chat-memory suite temporarily skipped until dedicated mocks land). Warnings stem from deliberate fallback behaviour when API keys or git repo are absent in the container (Brave/Venice auth 401s, git commits blocked at filesystem boundary). No assertion failures observed.

## Web CLI Smoke Check

- `node scripts/webcli-smoke.mjs` – pass. Script launches the Web-CLI server, exercises `/status`, `/keys check`, `/chat`, `/research`, keeps the result, then runs `/export` to validate the download channel before shutting down.
	- Chat flow returned an expected 401 from Venice due to missing credentials; error surfaced to terminal but session recovered.
	- Research flow proceeded with placeholder query, hit Brave 422 (invalid query for API) and produced fallback summary; the post-action prompt accepted `keep`, `/export` emitted a `download_file` event, and the session remained healthy afterward.

## Web CLI Functional Sweep

- `npm run test:webcli` (wraps `node test-cli-simulation.js`) – pass. Drives `/status`, `/keys set|check`, `/memory stats|store|recall`, `/prompts list`, `/logs stats`, `/diagnose`, `/chat`, `/research`, and `/export` via the WebSocket terminal with placeholder inputs.
	- Chat message hit Venice 401 (no real key) and the simulation noted the failure before exiting chat cleanly.
	- `/exitmemory` now finalizes and drops the session’s memory manager; fallback summary path triggers when Venice summarization fails (missing credentials), but completion message surfaces to the operator and leaves state clean.
	- Research pipeline still treats Brave 422s as “no results,” completing without prompt timeouts while generating a minimal markdown artefact that `/export` immediately downloads.
	- Diagnose flagged Brave/GitHub connectivity errors as expected because sandbox credentials are dummy values.
	- Memory recall triggered the semantic fallback, returned 0 matches, and logged the scoring failure explicitly—expected until valid LLM credentials are provisioned.
	- Run captured 150 structured events end-to-end; prompts (query + post-action) rendered correctly, `/export` delivered a `download_file` event, and “No prompts found” surfaced for `/prompts list`, confirming empty fixture coverage.

## Notes for Live Testing

- Provision Brave and Venice API keys plus GitHub repo config before live run to avoid 401/422 degradations and to unlock full research output.
- Smoke script maintains self-contained lifecycle; when running manually, start `npm start` in a dedicated terminal and use a second terminal (or browser) for interactive commands.
