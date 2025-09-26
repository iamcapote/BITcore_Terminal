# Authentication & API Key Management – Technical Reference

This guide describes the production implementation of authentication, user storage, and API key management for the Deep Research Privacy App. It reflects the code in `/app/features/auth`, `/app/commands`, and supporting utilities as of September 2025.

---

## 1. System Overview

| Concern | Implementation | Key Modules |
| --- | --- | --- |
| User storage | JSON files under `~/.mcp/users` (override via `MCP_TEST_USER_DIR`) | `app/features/auth/user-manager.mjs` |
| Password hashing | Argon2id with per-user salts | `user-manager.mjs` (`argon2` dependency) |
| API key encryption | AES-256-GCM, key derived with `scrypt` | `app/features/auth/encryption.mjs` |
| Session tracking (CLI) | `~/.mcp/session.json` with expiry timestamps | `user-manager.mjs::createSession` / `loadUser` |
| Rate limiting | In-memory attempt tracker for login | `user-manager.mjs::RateLimiter` |
| CLI commands | `/login`, `/logout`, `/status`, `/users`, `/password-change`, `/keys` | `app/commands/*.mjs` |
| WebSocket auth | Session-local state within `app/features/research/routes.mjs` | `userManager.authenticateUser`, `userManager.getUserData` |

---

## 2. Directory & Files

```
~/.mcp/
  users/
    public.json
    <username>.json
  session.json          # CLI session persistence
```

- `MCP_TEST_USER_DIR` points the user directory (and session file) to an alternate location for tests.
- User files contain role, password hash, salts, encrypted keys, GitHub settings, and limit metadata.
- Public profile is created automatically with limited quotas and no encrypted keys.

---

## 3. User Manager (`user-manager.mjs`)

### 3.1 Initialisation

1. `ensureUserDir()` creates the target directory.
2. `createPublicProfile()` writes `public.json` with baseline limits and empty GitHub fields.
3. `adminExists()` scans user files for role `admin`.
4. If no admin exists, CLI entrypoints prompt for creation via `createInitialAdmin(username, password)`.
5. CLI mode attempts to restore the previous session (`session.json`) if not expired (default 30 days).

### 3.2 Password Handling

- Passwords are hashed with `argon2id` (via `argon2` dependency). Hash and salt are stored in the user JSON.
- `changePassword()` verifies the existing hash, decrypts stored keys, re-encrypts them with the new password, and updates the hash/salt.
- Public user has no password.

### 3.3 API Keys & Encryption

- Keys supported: Brave, Venice, GitHub token (plus GitHub owner/repo/branch metadata).
- Encryption pipeline:
  1. Prompt user for password (CLI hidden prompt / WebSocket prompt).
  2. Derive a 32-byte key from password + salt using `scrypt` (`deriveKey`).
  3. Encrypt plaintext key with AES-256-GCM (`encryptApiKey`).
  4. Store JSON payload (`{ iv, authTag, encrypted }`) in user file.
- Decryption reverses the process using the cached password or prompted password.

### 3.4 Rate Limiting

- `RateLimiter` enforces maximum attempts per time window (default 5 attempts per 15 minutes).
- Exponential backoff increases block window after repeated violations.
- Applied in both CLI and WebSocket login via `attempt(username)` and `reset(username)`.

### 3.5 Session Concepts

- **CLI Session (`currentUser`)**: Global process state used by CLI commands. Persisted to `session.json` with `expiresAt`.
- **WebSocket Session**: Each socket retains its own `session.user` object plus cached decrypted keys/passwords. `authenticateUser` returns a fresh user object without mutating global state.

---

## 4. Command Layer

### 4.1 `/login`

1. CLI: `app/commands/login.cli.mjs::executeLogin` prompts for username/password, calls `userManager.login`, caches password if successful, and writes CLI session.
2. WebSocket: `routes.mjs::handleLogin` uses `authenticateUser` and stores user data on the socket session.
3. On success, `/status` and downstream commands gain access to decrypted keys (with password prompt if necessary).

### 4.2 `/logout`

- CLI reloads the `public` profile, clears cached password, and removes session file.
- WebSocket clears session state and notifies client via `logout_success` event.

### 4.3 `/status`

- Reports username, role, memory mode, and API key configuration status. Reads from the active session (CLI global or WebSocket session).

### 4.4 `/users`

- Admin-only operations: `create`, `list`, `delete`, `createAdmin`.
- `createUser()` validates role, generates password if omitted, writes user file with initial limits, and returns the generated password (displayed once to the admin).
- Deletion checks safeguards (cannot remove last admin, active user, or public account).

### 4.5 `/password-change`

- Prompts current password and new password, invokes `userManager.changePassword`. Re-encrypts stored API keys.

### 4.6 `/keys`

- `set`: Prompts for Brave/Venice/GitHub tokens and stores them encrypted.
- `check` / `stat`: Displays whether keys are configured (without revealing values).
- `test`: Performs live API calls (Brave search ping, Venice prompt, GitHub repo metadata) to validate credentials. Implemented in `keys.cli.mjs` using helper functions in `user-manager.mjs`.

---

## 5. API Key Resolution

When a feature requests a key (research, chat, GitHub uploads):

1. First preference: decrypted user key from the session (`session.decryptedKeys`).
2. Fallback: environment variable (`BRAVE_API_KEY`, `VENICE_API_KEY`, `GITHUB_TOKEN`, etc.).
3. If neither is available, the command aborts with an informative error. WebSocket clients receive an `error` message and may be prompted to configure keys.

`user-manager.mjs::getDecryptedKeys(password)` handles the decryption pipeline. Commands typically cache the password for the duration of the CLI session to minimise prompts.

---

## 6. GitHub Settings

User files store the following fields for research/memory uploads:

- `githubOwner`
- `githubRepo`
- `githubBranch`
- `encryptedGitHubToken`

Helpers in `app/utils/github.utils.mjs` and `app/infrastructure/memory/github-memory.integration.mjs` expect these fields. If any are missing, uploads gracefully decline with guidance to run `/keys set github ...`.

---

## 7. Validation & Testing

Automated coverage (Vitest):

- `tests/auth.test.mjs` – End-to-end authentication flows.
- `tests/cli-integration.test.mjs` – Command router covering `/login`, `/keys`, `/users`.
- `tests/memory.test.mjs`, `tests/github-memory.test.mjs` – Ensure decrypted GitHub credentials work during commits.
- `tests/system-validation.mjs` – Full pipeline validation, including authentication prerequisites.

Manual smoke tests:

```bash
# Start in CLI mode
npm start -- cli

/status                # should show public user
/login admin           # enter password when prompted
/keys set brave        # store a Brave key (prompted)
/keys test             # validate credentials
/users list            # verify admin tooling
/logout
```

For WebSocket flows:

```bash
npm start
# Visit http://localhost:3000, open DevTools console
# Issue commands via terminal UI and confirm login_success/logout_success events
```

---

## 8. Operational Notes

- **Backups**: User JSON files are sufficient to restore accounts; keep them encrypted when backing up.
- **Password resets**: Admin users can reset another user's password via `/users create --force` or by editing the JSON file (followed by `argon2` hash generation). Prefer CLI flow to keep audit trail.
- **Environment overrides**: Setting `MCP_TEST_USER_DIR` is required for automated tests to avoid touching developer home directories.
- **Security posture**: Encourage HTTPS in production, rotate API keys regularly, and monitor rate-limiter logs for suspicious activity.

---

Use this document as the canonical reference when modifying authentication flows, user storage, or key management. Update it alongside substantive code changes.


