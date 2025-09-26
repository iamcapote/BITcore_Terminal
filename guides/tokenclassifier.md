# Token Classification Module – Technical Guide

The token classification module enriches research queries by delegating analysis to the Venice LLM service. This document reflects the implementation in `app/utils/token-classifier.mjs` and related helpers (September 2025).

---

## 1. Responsibilities & Flow

| Step | Responsibility | Module |
| --- | --- | --- |
| 1 | Collect user query and decide whether to classify | `app/commands/research.cli.mjs`, `app/features/research/routes.mjs` |
| 2 | Retrieve decrypted Venice API key | `app/features/auth/user-manager.mjs` (CLI/Web sessions) |
| 3 | Send query to Venice classifier character | `app/utils/token-classifier.mjs` |
| 4 | Clean response and attach to query object | `token-classifier.mjs`, `research.providers.mjs` |
| 5 | Continue research pipeline using enriched query metadata | Research engine stack |

High-level execution:

1. User runs `/research` (CLI or Web). They are prompted to opt-in to classification (`--classify` flag or prompt).
2. The command layer retrieves the user’s Venice API key (or falls back to environment variable).
3. `callVeniceWithTokenClassifier(query, veniceApiKey, debugFn)` is invoked.
4. Venice responds using the default classifier character slug (`getDefaultTokenClassifierCharacterSlug`).
5. The raw model output is cleaned with `cleanChatResponse` and stored on the query object as `tokenClassification`.
6. Research providers use this metadata when generating breadth/depth queries.

---

## 2. Function Signature

```javascript
async function callVeniceWithTokenClassifier(query, veniceApiKey, debugHandler = console.log)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `string` | Required user query text. Empty/null queries short-circuit and return `null`. |
| `veniceApiKey` | `string` | Decrypted Venice API key. Missing keys produce a debug log and return `null`. |
| `debugHandler` | `function` | Optional logger used for verbose instrumentation. Defaults to `console.log`. |

Return value: cleaned string classification or `null` if classification is skipped/failed non-critically. Critical API key errors throw.

---

## 3. Venice Request Details

- Client: `LLMClient` instantiated with `{ apiKey: veniceApiKey }`.
- Character: `getDefaultTokenClassifierCharacterSlug()` from `venice.characters.mjs`.
- Payload:

```javascript
llmClient.completeChat({
  messages: [{ role: 'user', content: query }],
  temperature: 0.1,
  maxTokens: 1000,
  venice_parameters: { character_slug: characterSlug }
});
```

- Response handling:
  - `response.content` is logged (first 200 chars) for debugging.
  - `cleanChatResponse` removes `<thinking>` tags or formatting noise.
  - Empty/whitespace results yield `null`, allowing the pipeline to continue.

---

## 4. Error Handling Strategy

| Scenario | Behaviour |
| --- | --- |
| Missing API key | Logged via `debugHandler`; returns `null`. |
| Empty query | Logged; returns `null`. |
| Venice returns usable content | Cleaned string returned. |
| Venice returns empty/invalid content | Logs warning with raw response; returns `null`. |
| API key error ("api key is required") | Throws error to caller so research flow can surface credential issue. |
| Other exceptions | Logged to console (with stack); returns `null` so research continues without classification. |

The research pipeline treats `null` as “classification unavailable” and falls back to non-classified behaviour without user interruption.

---

## 5. Integration Points

- **CLI (`app/commands/research.cli.mjs`)**: Prompts with “Use token classification? (y/n)” unless `--classify` flag present.
- **WebSocket (`app/features/research/routes.mjs`)**: `wsPrompt` asks the same question during interactive flows; `--classify` flag also supported.
- **Research Providers (`app/features/ai/research.providers.mjs`)**: Expect optional `tokenClassification` on query objects and incorporate metadata into query generation prompts.
- **Debug Logging**: Pass a bound logger (e.g., `outputManager.debug`) so classification steps show up in CLI or Web logs.

---

## 6. Testing

Automated coverage:

- `tests/token-classifier.test.mjs` – Mocks Venice responses and validates cleaning/error behaviour.
- `tests/research-pipeline.test.mjs` – Ensures classification metadata passes through the pipeline when available.

Manual checks:

```bash
npm start -- cli
/login <username>
/research --classify "evaluate quantum internet milestones"
```

Observe debug logs for classifier invocation. Set `VENICE_API_KEY` or user-specific key before running.

On Web terminal, execute `/research --classify <query>` or `/research` and accept the prompt.

---

Maintain this document alongside any future classifier character, prompt, or error-handling changes.

