# Live Test Readiness Checklist

Short, repeatable script to validate the BITcore Terminal before inviting operators into a live session. Run through it after every major change or upgrade.

---

## 1. Environment & Accounts

- [ ] **Dependencies installed:** `npm install`
- [ ] **API keys configured:** Brave, Venice, and GitHub token set via `/keys set` or environment variables.
- [ ] **Encrypted overlay verified (if enabled):** `BITCORE_CONFIG_SECRET` defined, `/keys set brave ...` logs "Credentials stored via encrypted secure-config overlay", and `BITCORE_ALLOW_CONFIG_WRITES=1` (or the encrypted flag) is set when running outside tests.
- [ ] **Single-user profile verified:** `~/.bitcore-terminal/global-user.json` exists with correct owner/repo/branch/token values.
- [ ] **Optional guards toggled as needed:**
  - CSRF enforcement (`RESEARCH_WS_CSRF_REQUIRED=true`)
  - Research scheduler flags (disabled for manual testing unless explicitly validating the cron worker)

## 2. CLI Smoke

```bash
npm start -- cli
/status
/keys check
/keys test
/chat --memory=false
# say "hello"; expect a response, then `/exit`
/research "Impact of solar storms on undersea cables" --depth=2 --breadth=2 --classify=false
# choose "Keep" when prompted so it persists across restarts
/export report-solar-storms.md --keep
/storage save research/solar-storms.md
/storage list research --json
/exit
# restart CLI to confirm session persistence (Ctrl+C if needed)
npm start -- cli
/export restored-solar-storms.md
/storage delete research/solar-storms.md
/research "Quick reset check" --depth=1 --breadth=1 --classify=false
# choose "Discard" to clear the snapshot
/exit
```

Confirmations:
- Status shows `operator` / `admin`
- `/keys set brave ...` (if rerun) prints the secure overlay notice when the encrypted store is active
- `/chat` enters and exits cleanly without prompting for passwords
- First `/research` retains its result after `/export --keep`, and the second CLI start can export without re-running research
- Restarted `/research` run with **Discard** clears the persisted snapshot

## 3. Web Terminal Smoke

```bash
npm start
```

1. Open `http://localhost:3000`
2. Run `/status`, `/keys check` in the terminal pane
3. Issue `/chat` (ensure persona banner appears, send a message, `/exit`)
4. Run `/research` without arguments, provide a query via prompt, wait for completion, select **Keep**, issue `/export`, confirm the `download_file` event banner, then `/storage save research/web-smoke.md`
5. Refresh the browser (or reopen the tab) and confirm the banner *"Previous research result restored from last session"* appears; immediately run `/export` to prove the snapshot survived the reconnect
6. Use `/storage list research` to confirm the upload, optionally `/storage get research/web-smoke.md --out=./web-smoke.md --overwrite` and `/storage delete research/web-smoke.md`
7. Re-run `/research` and select **Upload** to GitHub (expect commit + file URLs)
8. Trigger the rate limiter by firing `/research` three times quickly and confirm retry message
9. Toggle CSRF (if enabled) by refreshing the page; ensure commands succeed with the new token

## 4. Logs & Telemetry

- [ ] Inspect server console for structured `research.websocket.command-handler` messages (no stack traces)
- [ ] Verify `download_file`, `research_start`, and `research_complete` events in Web terminal
- [ ] If scheduler enabled, confirm it remains idle or logs expected poll output

## 5. Cleanup

- [ ] Stop the server (`Ctrl+C`)
- [ ] Optionally clear `session.currentResearchResult` by running `/research` → `Discard` (both CLI and Web should drop the persisted snapshot)
- [ ] Document results in the release notes or incident tracker

Keep this checklist living—extend it when new features land so the finish line stays obvious before every live run.
