## WebSocket Session Architecture

The terminal UI relies on a single WebSocket channel managed by `handleWebSocketConnection` in `app/features/research/routes.mjs`. This guide summarizes the current behaviour so you can extend it safely.

### Connection lifecycle

| Phase | Responsibilities |
| --- | --- |
| **Connect** | Generate a `sessionId`, clone the active user, hydrate telemetry channels, attach GitHub activity stream, and register the socket in `activeChatSessions`/`wsSessionMap`. Initial handshake messages (`connection`, `login_success`, `mode_change`) are pushed immediately. |
| **Activity** | Every incoming frame is parsed, the session timestamp is updated, and the handler disables client input via `disableClientInput` unless a prompt is already pending. Command/chat/input messages are routed to their dedicated helpers. Progress and status updates stream back through `safeSend`. |
| **Disconnect** | `close`, `error`, and `cleanupInactiveSessions` share the same teardown ritual: reject pending prompts, null out `session.password`, drop research artifacts, dispose telemetry streams, and remove the socket from `outputManager`. |

### Message types

The server emits structured packets which the browser consumes through `app/public/webcomm.js` and the terminal handlers. Key types include:

* `disable_input` / `enable_input` — sent exclusively via the `disableClientInput`/`enableClientInput` helpers. The former fires before work begins; the latter only fires after the downstream handler signals it is safe to restore typing.
* `prompt` — produced by `wsPrompt`. It sets `session.pendingPromptResolve` and starts a timeout; `handleInputMessage` resolves the prompt and clears state before resuming the originating flow.
* `progress`, `status-summary`, `telemetry:*` — streaming updates for research and diagnostics.
* `download_file`, `chat-response`, `memory_commit`, etc. — domain-specific events consumed by the terminal UI.

Incoming messages are limited to a small set (`command`, `chat-message`, `input`, `ping`, `github-activity:command`, `status-refresh`). Anything else is rejected with `wsErrorHelper`, which will optionally re-enable input.

### Prompt & password handling

* Commands may cache a decrypted password in `session.password` while they execute (e.g., GitHub uploads). That value is cleared automatically during any teardown path.
* When a prompt expects sensitive input, `session.promptIsPassword` ensures logging redacts it and the client obscures the characters.
* Nested prompts are rejected: `wsPrompt` cancels the previous pending resolver before registering a new one, preventing dangling promises.

### Telemetry and status

Research telemetry is multiplexed per user via `telemetryRegistry`. When a socket reconnects, existing telemetry replay buffers push recent events back to the new consumer. The `pushStatusSummary` helper emits `status-summary` frames on an interval and on-demand when the client sends `status-refresh`.

### Heartbeats

The browser initiates `ping` frames on an interval (see `webcomm.js`). The server responds with `pong`, refreshes `session.lastActivity`, and does not disable input in this fast path. There is no server-driven ping timer—keeping the logic on the client avoids redundant timers per connection.

### Inactivity cleanup

`cleanupInactiveSessions` runs every five minutes. Sessions that have been idle beyond `SESSION_INACTIVITY_TIMEOUT` are closed gracefully (`session-expired` message + close code 1000). The cleanup routine mirrors the disconnect logic so secrets and telemetry are always released.

### Extending the channel safely

1. **Add new message types deliberately.** Update both the router in `routes.mjs` and the terminal handlers, and document the payload contract.
2. **Respect the input contract.** If a handler needs to keep the UI locked, return `{ keepDisabled: true }` or an equivalent boolean so `enableClientInput` is not called prematurely.
3. **Clean up after yourself.** Attach any new stream disposers to the session record and null them out in every teardown path.
4. **Log without leaking.** Always redact passwords or other secrets before logging payloads.

With these guardrails in place, the single WebSocket channel remains responsive while preventing deadlocks or credential leaks.