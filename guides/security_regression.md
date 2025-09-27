# Security Regression & Threat Model Guide

This document captures the current security threat model for BITcore Terminal (September 2025) and defines the regression checks that every release must satisfy. It reflects the latest surfaces delivered in Phase A/B of the COREAI uplift: logs dashboard, scheduler, GitHub sync workflows, memory intelligence, and WebSocket telemetry.

---

## 1. Threat Model Snapshot

| Attack Surface | Entry Vector | Key Assets | Primary Controls |
| --- | --- | --- | --- |
| CLI commands (`app/commands/*.cli.mjs`) | Authenticated local user issuing verbs (memory, missions, logs) | User credentials, decrypted API keys, mission definitions | Role-enforced verb dispatch, inquirer password prompts, Argon2 + AES-GCM storage |
| HTTP routes (`app/features/*/routes.mjs`) | Authenticated browser session over HTTPS | Mission queue, memory corpus, prompt library | Express auth middleware, Zod schema validation, rate limiting, feature flags |
| WebSocket telemetry (`app/public/*.js`, `app/config/websocket.mjs`) | Authenticated terminal/web dashboard connections | Live research/memory/log telemetry, command output | Session binding per socket, per-channel capability map, throttled replay buffer |
| GitHub sync adapters (`app/infrastructure/*/github*.mjs`) | Outbound GitHub API calls with user token | Research reports, mission templates, memory snapshots | Encrypted token storage, scoped repo permissions, upload path allow-list |
| Persistent storage (`~/.mcp/users`, `missions/`, `memory/`) | Local filesystem access, GitHub repo access | User metadata, scheduler definitions, research artifacts | Encrypted API keys, git history monitoring, per-role read/write gates |
| Logs dashboard (`app/features/logs`) | HTTP/WebSocket access to log streaming | Structured event feed, retention buffers | Admin-only role check, schema validation, retention caps, redaction filters |

**Assumptions:**
- Transport runs behind TLS termination (reverse proxy or managed ingress).
- OS-level user separation prevents non-admin users from reading `~/.mcp` on shared systems.
- GitHub tokens have repo-scoped permissions only; org-wide scopes are disallowed.

---

## 2. Surface-by-Surface Controls

### 2.1 CLI Extensions
- Verb registry (`app/commands/index.mjs`) enforces role gates before execution.
- `user-manager.mjs` decrypts API keys only after password verification; decrypted keys live in memory for the session duration only.
- Commands emitting file writes (memory sync, mission scaffolding) validate target paths against allow-lists to prevent directory traversal.

### 2.2 HTTP Routes & Dashboards
- Each route module documents its request/response schema with Zod validators in `*.schema.mjs`; invalid requests return HTTP 422.
- Admin dashboards (logs, organizer, GitHub sync) assert `user.role === "admin"` prior to executing controller logic.
- Feature flags guard experimental endpoints; defaults keep new behavior disabled until explicitly configured.

### 2.3 WebSocket Telemetry
- `webcomm` channel registry ties socket sessions to capability scopes (e.g., `research:read`, `memory:read`); write operations require elevated roles.
- Replay buffers cap at 50 events per channel, rotated per connection, mitigating memory amplification attacks.
- Heartbeat ping/pong disconnects idle sockets and nulls cached secrets on disconnect.

### 2.4 GitHub Integrations
- Upload services normalise paths to `missions/` or `research/` prefixes and refuse all `..` segments.
- Push/pull flows require explicit confirmation in CLI/UI and emit structured audit logs for each GitHub action.
- Rate limiter (utils) applies exponential backoff when GitHub returns `403`/`429` codes.

### 2.5 Scheduler & Missions
- Mission definitions run from disk with immutable snapshots; controller clones payloads before mutating.
- Concurrent mission execution is capped to `MISSIONS_MAX_CONCURRENCY` (default 2) and gated behind user role checks.
- Timezone handling leverages `cron-parser` with guardrails for impossible schedules; invalid crons throw before persistence.

---

## 3. Security Regression Checklist (Per Release)

### 3.1 Automated Checks
- Run full Vitest suite in CI:
  - Scheduler, mission templates, GitHub sync, memory, logs, prompts, chat history, and terminal CLI tests must pass.
- Execute static schema validation tests:
  - `tests/logs-routes.test.mjs` (admin role enforcement + schema).
  - `tests/missions.routes.test.mjs` (cron validation and RBAC).
  - `tests/prompt-controller.test.mjs` (input sanitisation).
- Ensure linting (if configured) and TypeScript builds (if introduced later) succeed without warnings.

### 3.2 Manual Smoke Tests
- **Auth boundary:** Attempt admin-only dashboard access while logged in as `public` user; UI must redirect/deny.
- **Log retention:** Trigger `logs.cli.mjs --tail` and verify retention cap trimming.
- **WebSocket replay:** Disconnect and reconnect web terminal during an active research run; telemetry history must replay without duplication or loss.
- **GitHub sync:** Execute `/missions github sync status` with an intentional rate-limit scenario to confirm backoff message is surfaced.
- **Scheduler guardrail:** Create mission with invalid cron via UI/CLI and ensure validation error surfaces without writing file.

### 3.3 Secrets & Config Hygiene
- Confirm no `.env` or config files are writable through UI paths.
- Rotate sample API keys used in tests if nearing expiry; update encrypted fixtures accordingly.
- Audit `package.json` for dependency upgrades with security advisories; apply patches prior to shipping.

### 3.4 Incident Response Drill
- Review past release audit logs for anomalies.
- Verify backup/restoration script for `~/.mcp/users` and mission repositories.
- Confirm security contact rotation (on-call) and escalation path remain up-to-date.

---

## 4. Documentation & Change Management
- Update this guide whenever new surfaces launch or controls change.
- Reference `guides/auth_api.md` for detailed key management flows and integrate updates there when authentication logic shifts.
- For feature rollouts, attach a security sign-off summary to the release notes summarising completed regression checks.

---

## 5. Future Enhancements
- Introduce automated RBAC snapshot tests that diff route permission maps against golden files.
- Expand dependency scanning to include `npm audit` with allow-listed CVEs.
- Explore integrating husky pre-commit hooks to auto-run focused security tests (`npm test -- logs-routes missions.routes auth`).

Maintain a culture of continuous security review—these checks only stay effective if run routinely and refined whenever new insights emerge.
