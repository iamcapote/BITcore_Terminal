# Authentication & API Key Management – Technical Reference

This guide captures the current single-user authentication façade, storage layout, and API key flows for the Deep Research Privacy App. It reflects the simplified implementation present in `app/features/auth/user-manager.mjs` and associated helpers as of **October 2025**.

---

## 1. System Snapshot

| Concern | Current Behaviour | Key Modules |
| --- | --- | --- |
| User storage | Single JSON file `global-user.json` under `~/.bitcore-terminal` (override via `BITCORE_STORAGE_DIR`) | `app/features/auth/user-manager.mjs`, `app/utils/research.ensure-dir.mjs` |
| Authentication | Hard-wired single-user mode (`operator`/`admin`). `/login` is a no-op, `/logout` clears nothing. | `app/commands/login.cli.mjs`, `app/commands/logout.cli.mjs` |
| Passwords | Not persisted. Commands that historically required passwords now skip prompts unless downstream logic (e.g., GitHub upload) explicitly asks for one. | Same as above |
| API key storage | Plaintext values in `global-user.json` (Brave, Venice) plus GitHub metadata. No encryption layer is active. | `user-manager.mjs::setApiKey`, `setGitHubConfig` |
| API key resolution | Session cache → user JSON → environment variables | `app/utils/api-keys.mjs` |
| CLI/Web parity | `/keys`, `/status`, `/memory`, `/missions`, etc. run without login. WebSocket sessions clone the global user on connect. | `app/features/research/websocket/connection.mjs` |

> ⚠️ **Security Trade-off:** The legacy encrypted vault (`argon2id`, `scrypt`, AES-GCM) remains in the git history but is no longer invoked. Treat the storage directory as sensitive configuration and guard it at the OS level.

---

## 2. Storage Layout

```
~/.bitcore-terminal/
  global-user.json      # canonical single-user profile
  terminal-preferences.json
  research-preferences.json
  ...
```

`global-user.json` structure:

```json
{
  "username": "operator",
  "role": "admin",
  "apiKeys": {
    "brave": "...",
    "venice": "..."
  },
  "github": {
    "owner": "...",
    "repo": "...",
    "branch": "main",
    "token": "..."
  },
  "features": {
    "modelBrowser": true
  }
}
```

No other user files are created; all commands read and update this record.

---

## 3. User Manager Responsibilities

1. **Initialisation**
   - `initialize()` ensures the storage directory exists, reads `global-user.json`, and merges it with defaults derived from environment variables (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_*`, `BITCORE_*`).
   - If the file is missing, a new document is written to disk with the merged defaults.

2. **Session Accessors**
   - `getCurrentUser()` and `getUserData()` return the in-memory copy (creating it on demand).
   - `isAuthenticated()` always returns `true`.
   - `getUsername()` / `getRole()` surface the fixed identity.

3. **Mutations**
   - `setApiKey(service, value)` writes Brave/Venice tokens directly.
   - `setGitHubConfig(config)` upserts owner/repo/branch/token.
   - `setFeatureFlag(feature, bool)` toggles feature switches (currently only `modelBrowser`).

4. **Persistence**
   - `save()` rewrites `global-user.json` with pretty-printed JSON.
   - Tests invoke the same API and run under a temporary directory by overriding `BITCORE_STORAGE_DIR`.

There is **no** password hash, salt management, rate limiting, or encrypted payload in the active code path.

---

## 4. CLI & Web Command Layer

### `/login`
Returns the active user and prints a diagnostic message confirming single-user mode. Useful for tests that expect a structured response.

### `/logout`
Stub that reports the fixed mode. No state change occurs.

### `/status`
Reports username, role, feature flags, and whether API keys/GitHub metadata are present.

### `/keys`
- `set brave <value>` / `set venice <value>` – update the stored plaintext keys.
- `set github --github-owner=ORG --github-repo=REPO [--github-branch=BRANCH] [--github-token=TOKEN]` – configure sync destinations.
- `check` / `stat` – display configuration status.
- `test` – perform live connectivity checks (Brave ping, Venice models endpoint, GitHub `GET /user`).

### WebSocket Sessions
`handleWebSocketConnection` clones the resolved user for each socket, retains decrypted keys in memory while the connection is open, and clears them on disconnect/inactivity. The Web terminal experience therefore mirrors the CLI without additional prompts.

---

## 5. API Key Resolution Order

1. Session-scoped cache (`session.apiKeyCache`) populated by previous lookups.
2. `global-user.json` via `userManager.getApiKey(service)`.
3. Environment fallbacks (`BRAVE_API_KEY`, `VENICE_API_KEY`, `VENICE_PUBLIC_API_KEY`).

If a key is still missing, the consumer raises a typed error:
- `MissingResearchKeysError` for `/research`
- Informational messages for `/diagnose`, `/github-sync`, etc.

GitHub configuration uses the same precedence rules with helper `resolveGitHubConfig`.

---

## 6. Operational Guidance

- **Backups**: Treat `~/.bitcore-terminal` as configuration. Copy the directory using OS tooling or automation (Ansible, cron). There is no key encryption—secure the directory itself.
- **Secrets Hygiene**: Rotate Brave/Venice/GitHub tokens where they originate. Consider re-enabling encryption if multi-user mode returns.
- **Environment Overrides**: Set `BITCORE_STORAGE_DIR` for tests or container deployments to keep operator state within the workspace.
- **Monitoring**: The `/keys test` command is the fastest way to confirm connectivity after credential changes.

---

## 7. Testing Checklist

Automated coverage (Vitest):

- `tests/auth.test.mjs` – verifies that `setApiKey`, `setGitHubConfig`, and retrieval helpers work end to end.
- `tests/cli-integration.test.mjs` – exercises `/login`, `/keys`, `/status` under single-user assumptions.
- Integration suites (`research`, `memory`, `missions`) rely on `resolveApiKeys` and therefore exercise the same path indirectly.

Manual smoke test:

```bash
npm start -- cli
/status
/keys check
/keys set brave "BRAVE-KEY"
/keys set venice "VENICE-KEY"
/keys set github --github-owner=me --github-repo=research --github-token=ghp_example
/keys test
```

For the Web terminal, open `http://localhost:3000`, issue `/status`, `/keys check`, and confirm the output mirrors the CLI.

---

## 8. Future Considerations

- Reintroduce encrypted-at-rest storage if multi-user support or remote deployments demand it. The existing `app/features/auth/encryption.mjs` helpers can be reused once the user manager regains password prompts.
- Harden the writable directory when packaging for production (run as non-root user, restrict permissions, mount as secret volume in containers).
- If telemetry or audit requirements expand, add a thin logging layer to record credential changes (`setApiKey`, `setGitHubConfig`) with redacted values.

Keep this guide aligned with the behaviour of `user-manager.mjs`—update it whenever authentication flows change or encryption returns.


