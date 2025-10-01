# Venice Integration – Project Guide

This guide documents how BITcore integrates with Venice.ai across chat, research, and token classification workflows (state as of **October 2025**). It focuses on the opinionated wrapper (`LLMClient`) and the defaults defined under `app/infrastructure/ai` rather than the full public API surface.

---

## 1. Client Wrapper (`LLMClient`)

- Location: `app/infrastructure/ai/venice.llm-client.mjs`
- Responsibilities:
  - Normalise base URL (`https://api.venice.ai/api/v1`), headers, and auth.
  - Provide `completeChat({ messages, venice_parameters, ... })` with automatic JSON parsing.
  - Surface structured errors with context (HTTP status, response body snippet).
- Configuration:
  - Requires `apiKey` at construction. The commands layer passes the resolved Venice key (`resolveResearchKeys`).
  - Optional `timeoutMs` (defaults to 60s) and `fetchImpl` for testing.
  - Retries: not currently handled by the client; higher layers decide when to retry.

Example usage within the project:

```javascript
const llmClient = new LLMClient({ apiKey: veniceKey });
const response = await llmClient.completeChat({
  model: 'llama-3.3-70b',
  messages: [
    { role: 'system', content: 'You are a research assistant.' },
    { role: 'user', content: query },
  ],
  temperature: 0.5,
  venice_parameters: { character_slug: 'archon' },
});
```

The helper returns an object shaped like Venice’s OpenAI-compatible response. Callers typically read `response.content` and run it through `cleanChatResponse` when `<thinking>` blocks are expected.

---

## 2. Default Models & Characters

Source files:
- `app/infrastructure/ai/venice.models.mjs`
- `app/infrastructure/ai/venice.characters.mjs`

| Use case | Default model | Default character slug | Notes |
| --- | --- | --- | --- |
| Chat sessions | `qwen3-235b` | `bitcore` | Bitcore persona emits `<thinking>` tags. |
| Research engine | `dolphin-2.9.2-qwen2-72b` | `archon` | Used for query generation, summarisation, learnings. |
| Token classifier | `dolphin-2.9.2-qwen2-72b` | `metacore` | Applied when `/research --classify` is enabled. |

The defaults can be overridden at runtime:
- `/chat --model=<id> --character=<slug>`
- `/research --model=<id>` (future work; currently depth/breadth/classify are the primary flags)
- Web terminal exposes character/model selectors for chat.

All model IDs are defined in `VENICE_MODELS`. Keep this file in sync with Venice’s catalog when new deployments require capability changes.

---

## 3. Request Parameters We Use

Although Venice supports the entire OpenAI-style request payload, the project relies on a small subset:

| Field | Value | Location |
| --- | --- | --- |
| `model` | Defaults listed above; can be overridden for chat. | `LLMClient.completeChat` callers |
| `messages` | Ordered array of `{ role, content }`. | Chat/research/token classifier flows |
| `temperature` | Usually `0.1` (classifier) or `0.4–0.7` (chat/research). | Command/engine logic |
| `maxTokens` / `max_completion_tokens` | Set when specific flows need caps; otherwise defaults. | Rarely set; see research engine. |
| `venice_parameters.character_slug` | Persona slug from `venice.characters.mjs`. | All flows |
| `venice_parameters.include_venice_system_prompt` | Currently left as Venice default (`true`). | None yet – consider exposing toggle if prompts require full control. |

The wrapper does **not** enable streaming; the research engine relies on synchronous responses to maintain deterministic progress handling. If we implement streaming later, expand `LLMClient` accordingly.

---

## 4. Integration Points

- **Chat** (`app/commands/chat/session.mjs` & `chat/service.mjs`):
  - Instantiates `LLMClient` per turn with the active model/persona.
  - Cleans responses to split `<thinking>` and final content for the Web UI.
  - Stores transcripts via chat history + memory services.

- **Research** (`app/commands/research.cli.mjs`, `app/infrastructure/research/research.engine.mjs`):
  - Uses Venice to generate breadth queries, follow-ups, summarise learnings, and craft the final Markdown.
  - Depends on the (currently broken) `app/features/ai/research.providers.mjs` shim—fix required before the engine runs.

- **Token Classification** (`app/utils/token-classifier.mjs`):
  - Calls Venice once per query when classification is enabled.
  - Returns cleaned metadata merged into `query.metadata`.

- **Memory** (`app/infrastructure/memory/memory.manager.mjs`):
  - Leverages Venice for summarisation/scoring when persisting long-term memories (uses chat defaults).

---

## 5. Error Handling & Logging

- `LLMClient` throws when the HTTP layer fails (non-2xx). Callers catch these errors and either retry or surface succinct messages to the user.
- Token classifier treats most errors as non-fatal (returns `null`) except explicit “API key is required” responses, which bubble up so `/research` can prompt for missing credentials.
- Chat and research flows pipe Venice errors through `cli-error-handler.mjs` or WebSocket `error` events, preserving context without leaking raw payloads.
- When `--verbose` is set, `/research` prints `[DEBUG]` lines describing Venice call stages. Avoid dumping full responses to keep secrets out of logs.

---

## 6. Credentials & Storage

- Venice keys live in `~/.bitcore-terminal/global-user.json` (plaintext) or environment variables (`VENICE_API_KEY`, `VENICE_PUBLIC_API_KEY`).
- The `/keys set venice <token>` command updates the profile file immediately; no encryption is applied in the current single-user mode.
- For containerised deployments, mount the storage directory with restricted permissions or inject the key through environment variables to avoid writing to disk.

---

## 7. Practical Examples

### Research summarisation call (pseudo flow)

```javascript
const veniceKey = await resolveResearchKeys(...);
const client = new LLMClient({ apiKey: veniceKey });
const summary = await client.completeChat({
  model: 'dolphin-2.9.2-qwen2-72b',
  messages: [
    { role: 'system', content: 'You are Archon, a structured research analyst.' },
    { role: 'user', content: buildSummarisationPrompt(pathResults) },
  ],
  temperature: 0.3,
  venice_parameters: { character_slug: 'archon' },
});
return cleanChatResponse(summary.content);
```

### Token classifier call

```javascript
const metadata = await callVeniceWithTokenClassifier(
  researchQuery,
  veniceKey,
  (msg) => debug(`[Classifier] ${msg}`)
);
if (metadata) {
  enrichedQuery.metadata = metadata;
}
```

---

## 8. Known Gaps & Follow-ups

- `research.providers.mjs` must be replaced to restore Venice-backed query generation. Until then, `/research` and dependent tests fail during module import.
- Streaming support is absent; adding it would require updating `LLMClient` and downstream output plumbing.
- System prompt toggles (`include_venice_system_prompt`, custom personas) are hard-coded. Consider exposing them via preferences when we reintroduce multi-user profiles.
- Monitor Venice API changes: update `venice.models.mjs` and `venice.characters.mjs` whenever the provider catalog evolves.

---

Keep this guide up to date whenever we change model defaults, add new personas, or adjust how the research/chat stack interacts with Venice.


Show child attributes

​
tool_choice

object

Show child attributes

​
response_format
object
Format in which the response should be returned. Currently supports JSON Schema formatting.


Show child attributes

Response
200

200
application/json
OK
​
id
stringrequired
The ID of the request.

Example:
"chatcmpl-abc123"

​
object
enum<string>required
The type of the object returned.

Available options: chat.completion 
Example:
"chat.completion"

​
created
integerrequired
The time at which the request was created.

Example:
1677858240

​
model
stringrequired
The model id used for the request.

Example:
"llama-3.3-70b"

​
choices
object[]required
A list of chat completion choices. Can be more than one if n is greater than 1.


Show child attributes

Example:
[
  {
    "index": 0,
    "message": {
      "role": "assistant",
      "reasoning_content": null,
      "content": "The sky appears blue because of the way Earth's atmosphere scatters sunlight. When sunlight reaches Earth's atmosphere, it is made up of various colors of the spectrum, but blue light waves are shorter and scatter more easily when they hit the gases and particles in the atmosphere. This scattering occurs in all directions, but from our perspective on the ground, it appears as a blue hue that dominates the sky's color. This phenomenon is known as Rayleigh scattering. During sunrise and sunset, the sunlight has to travel further through the atmosphere, which allows more time for the blue light to scatter away from our direct line of sight, leaving the longer wavelengths, such as red, yellow, and orange, to dominate the sky's color.",
      "tool_calls": []
    },
    "logprobs": null,
    "finish_reason": "stop",
    "stop_reason": null
  }
]
​
usage
objectrequired

Show child attributes

​
venice_parameters
objectrequired

Show child attributes

​
prompt_logprobs

null · any | null
Log probability information for the prompt.