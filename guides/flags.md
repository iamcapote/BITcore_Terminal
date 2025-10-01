## Command Flags Reference (Web & CLI)

The platform exposes the same slash-command grammar across the Web terminal and CLI shell. This guide summarises the supported flags, their defaults, and how they interact with stored preferences. Unless noted otherwise, all flags are supplied using the `--flag=value` form.

---

### `/chat`

| Flag | Values | Purpose | Notes |
| --- | --- | --- | --- |
| `--model` | Any key from `VENICE_MODELS` (see `app/infrastructure/ai/venice.models.mjs`) | Override the language model for the current chat session. | Defaults to `qwen3-235b` if omitted. Persisted only for the active session. |
| `--character` / `--persona` | `archon`, `bitcore`, `metacore`, or any custom persona slug | Swap to a different persona prompt. | Defaults to `bitcore`. The command resolves the slug via the persona controller and raises if unknown. |
| `--memory` | `true` / `false` | Enable long-term memory capture. | If enabled, you can further tune depth via `--depth`. |
| `--depth` | `short` / `medium` / `long` | Control how aggressively chat history is summarised when memory is on. | Ignored unless `--memory=true`.
| `--json` | `true` | Return JSON payloads rather than formatted text. | Useful for scripts calling the CLI. |

#### Defaults
- Model: `qwen3-235b`
- Persona: `bitcore`
- Memory: disabled

> Bitcore persona responses often include reasoning blocks such as `<thinking> … </thinking>` before the final message. The Web UI renders these as separate “thought” and “reply” segments; custom clients should parse and display them accordingly.

---

### `/research`

| Flag | Values | Purpose | Notes |
| --- | --- | --- | --- |
| `--depth` | `1`-`6` | Number of exploration passes per query. | Defaults to the stored research preference (initially `2`). Values are clamped to the 1–6 range. |
| `--breadth` | `1`-`6` | Parallel query width. | Defaults to stored preference (initially `3`). |
| `--classify` | `true` / `false` | Run the Venice token classifier before searching. | When `true`, metadata from the classifier is merged into the query object passed to the research engine. |
| `--public` / `--isPublic` | `true` / `false` | Toggle public vs private visibility metadata for telemetry. | Defaults to preference (`false`). Both spellings are accepted. |
| `--verbose` | `true` | Emit debug diagnostics during pipeline execution. | CLI prints to stdout; Web sessions stream `[DEBUG]` lines to the client. |
| `--json` | `true` | Return structured JSON instead of human-readable logs (CLI only). | Handy for automation. |

Additional overrides—such as injecting pre-computed queries or skipping post-research prompts—are only exposed internally via the WebSocket handlers and are not part of the public CLI surface.

#### Defaults
- Research model: `dolphin-2.9.2-qwen2-72b`
- Research character: `archon`
- Depth: `2`
- Breadth: `3`
- Token classification: disabled unless explicitly requested or stored in preferences.

---

### Token Classifier

The token classifier module shares the same Venice backend and defaults:

- Model: `dolphin-2.9.2-qwen2-72b`
- Character: `metacore`

The classifier runs automatically when `/research --classify=true` or when the Web terminal toggles classification on. It annotates the research query with enriched metadata but does not make additional CLI flags available.

---

### Persistence & Preferences

- **Terminal preferences** (widgets, auto-scroll, etc.) live in `~/.bitcore-terminal/terminal-preferences.json` and can be adjusted with `/terminal prefs ...`. These do not affect models or characters.
- **Research preferences** (depth, breadth, visibility, classifier opt-in) live in `~/.bitcore-terminal/research-preferences.json`. The Web UI exposes sliders/toggles; the CLI obeys the same defaults whenever a flag is omitted.
- **Chat personas** can be listed and overridden via `/chat persona list|get|set|reset`. The default persona is stored separately by the persona controller.

---

### Quick Reference Table

| Context | Default Model | Default Character |
| --- | --- | --- |
| Chat | `qwen3-235b` | `bitcore` |
| Research | `dolphin-2.9.2-qwen2-72b` | `archon` |
| Token Classifier | `dolphin-2.9.2-qwen2-72b` | `metacore` |

Keep this document in sync with `venice.models.mjs`, `venice.characters.mjs`, and the CLI command modules whenever new models, personas, or flags are introduced.

