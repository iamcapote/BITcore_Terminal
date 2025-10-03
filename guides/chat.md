# Chat & Memory System – Technical Guide

This guide documents the current chat subsystem and memory integration implemented in the `/app` directory as of October 2025. It replaces prior aspirational documentation and tracks the live codebase.

---

## 1. Architecture Overview

| Layer | Modules | Responsibility |
| --- | --- | --- |
| **Entry Points** | `app/commands/chat.cli.mjs`, `app/features/chat/routes.mjs` (WebSocket chat command handling) | Parse `/chat` invocations, configure session state, and acknowledge chat readiness. The CLI file fans out to purpose-built helpers in `app/commands/chat/` (session, persona, interactive CLI, research, memory). |
| **Session State** | WebSocket session objects (`session.isChatActive`, `session.chatHistory`, `session.memoryManager`) | Persist chat context, selected model/character, and memory manager instance for Web clients. |
| **LLM Access** | `app/infrastructure/ai/venice.llm-client.mjs`, `app/infrastructure/ai/venice.response-processor.mjs` | Submit chat turns to Venice LLM and clean model responses before display. Web handler relies on env-provided keys; CLI paths go through `resolveApiKeys`. |
| **Memory Management** | `app/infrastructure/memory/memory.manager.mjs`, `app/infrastructure/memory/github-memory.integration.mjs` | Store, retrieve, summarise, and optionally commit memories to GitHub depending on user configuration. |
| **Output Plumbing** | `app/utils/research.output-manager.mjs`, `app/utils/websocket.utils.mjs` | Mirror chat output across CLI stdout and WebSocket connections, respecting enable/disable input events. |

### 1.1 Chat Command Modules

All chat command logic now lives in small, single-responsibility modules under `app/commands/chat/`:

| Module | Responsibility |
| --- | --- |
| `session.mjs` | Bootstrap `/chat`, manage session flags, persist chat history metadata, and bridge persona subcommands. |
| `persona.mjs` | Handle `/chat persona …` commands, flag parsing, and output formatting. |
| `interactive-cli.mjs` | Provide CLI-only helpers for hidden prompts and the readline chat loop. |
| `memory.mjs` | Implement `/exitmemory`, including finalisation messaging and session cleanup. |
| `research/queries.mjs` | Generate LLM-backed or heuristic research queries from chat context. |
| `research/start.mjs` | Launch chat-derived research by normalising options, wiring telemetry, and instantiating the research engine. |
| `research/exit.mjs` | Orchestrate `/exitresearch`, including WebSocket prompts, classification opt-in, and session teardown. |
| `research.mjs` (facade) | Re-export the research helpers so existing imports stay stable while actual code stays modular. |

This structure keeps each file well under the 300–500 line guidance in `AGENTS.md` and mirrors the modular terminal public bundle.

---

## 2. Chat Session Flow

1. **Command Dispatch**
   - CLI: `/chat [--memory=true] [--depth=short|medium|long]` triggers `executeChat` in `chat.cli.mjs`.
   - WebSocket: `handleCommandMessage` (`app/features/research/routes.mjs`) interprets `/chat` and updates the session, then sends a `chat-ready` event.

2. **Session Initialisation**
   - A Venice `LLMClient` is prepared with the requested model/character (defaults: model `qwen3-235b`, character `bitcore`). CLI flows resolve the API key through `resolveApiKeys`; the Web handler relies on `VENICE_API_KEY` or the single-user profile.
   - `session.chatHistory` is initialised and the UI prompt switches to `[chat] >` for Web clients.
   - If memory is enabled, `MemoryManager` instantiates with depth-specific settings (short/medium/long) and optional GitHub integration derived from the authenticated user profile.

3. **Message Loop**
   - User input is appended to `chatHistory` and optionally stored in the memory manager.
   - Relevant memories are retrieved via `MemoryManager.retrieveRelevantMemories` and injected into the LLM prompt when available.
   - Venice generates a response; the result is cleaned by `cleanChatResponse` and routed back to the user.
   - Memory-enabled sessions persist both user and assistant turns for future retrieval and summarisation.

4. **Exit Conditions**
   - `/exit` ends the chat session.
   - `/exitmemory` finalises memory and optionally commits to GitHub (details below).
   - `/research …` transitions into the research pipeline using accumulated chat context via `startResearchFromChat` (implemented in `app/commands/chat/research/start.mjs`).

---

## 3. Memory Manager Details

`MemoryManager` supports three depth profiles defined in `app/infrastructure/memory/memory.manager.mjs`:

| Depth | Max memories | Retrieval limit | Relevance threshold | Summarise every |
| --- | --- | --- | --- | --- |
| `short` | 10 | 2 | 0.7 | 10 turns |
| `medium` | 50 | 5 | 0.5 | 20 turns |
| `long` | 100 | 8 | 0.3 | 30 turns |
- **Retrieval**: Semantic similarity heuristics prioritise relevant memories before LLM calls.
- **Summarisation**: Periodic summarisation compacts stored memories; summaries are retained in the validated store.
- **Stats**: `/memory stats` returns counters (stored, retrieved, validated, summarised) plus depth and store sizes.

GitHub integration (`GitHubMemoryIntegration`):
- Enabled when the user has GitHub owner/repo/token set (or environment fallback) and memory mode is active.
- On finalisation it packages summaries into Markdown and commits via Octokit, returning a commit SHA.

---

## 4. In-Chat Commands & Behaviours

| Command | Availability | Description |
| --- | --- | --- |
| `/exit` | CLI & Web | Terminates chat session, restores command prompt. |
| `/exitmemory` | CLI & Web (memory enabled) | Calls `MemoryManager.summarizeAndFinalize()`, clears memory manager from the session, and emits `memory_commit` if a GitHub commit occurs. |
| `/memory stats` | CLI & Web (memory enabled) | Invokes `app/commands/memory.cli.mjs::executeMemoryStats` to display depth, counts, and GitHub status. |
| `/research <query>` | CLI & Web | Uses `startResearchFromChat` to bridge into the research pipeline while preserving chat context. If no chat history exists and no override queries are provided, the command now returns a guard message (`Chat history is required to start research.`) instead of surfacing a generic failure. Web sessions without an inline query fall back to an immediate `wsPrompt` so the operator can provide the question interactively. |
Additional behaviours:
- Password prompts for key decryption (if required) are routed through the existing prompt infrastructure (`promptHiddenFixed` for CLI, `wsPrompt` for Web).
- Chat history is cleared when the session exits; Web clients receive `enable_input` to unlock the terminal.

---

## 5. GitHub Memory Finalisation Flow

1. User issues `/exitmemory` (or closes chat with memory enabled).
2. `MemoryManager.summarizeAndFinalize()` composes the dialogue, generates summaries using Venice if necessary, and prepares upload content.
3. `GitHubMemoryIntegration.commitMemory()` pushes the summary to the configured repository/branch.
4. On success, a `memory_commit` WebSocket event is emitted with the commit SHA; CLI prints the SHA via `outputManager`.
5. The session’s `memoryManager` instance is cleared by `app/commands/chat/memory.mjs`.

If GitHub settings are missing or commit fails, the memory is still summarised locally and a fallback message is shown.

---

## 6. Persona Management

The chat stack now exposes Venice personas (a.k.a. characters) through both CLI and web surfaces. Persona selection influences the system prompt and Venice `character_slug` when running `/chat`.

| Surface | Action | Notes |
| --- | --- | --- |
| CLI | `/chat persona list` | Shows available personas and marks the current default. `--json` emits machine-readable output. |
| CLI | `/chat persona set <slug>` | Persists a new default. Use `/chat persona reset` to return to `bitcore`. |
| CLI | `/chat --character=<slug>` | Overrides the persona for a single session without changing the persisted default. |
| Web | Status bar selector | Dropdown reads/writes `/api/chat/personas` endpoints. Changes propagate to CLI via shared storage. |
| Web & CLI | Chat bootstrap output | Displays the active persona name and slug when `/chat` starts. |

Persona metadata is stored in `~/.bitcore-terminal/chat-persona.json` (overridable via `BITCORE_STORAGE_DIR`). Route handlers live in `app/features/chat/chat-persona.routes.mjs`; CLI controls reside in `app/commands/chat.cli.mjs`.

---

## 7. Testing & Validation

Automated coverage:
- `tests/chat.test.mjs` – Core chat flow smoke tests.
- `tests/chat-persona.service.test.mjs`, `tests/chat-persona.cli.test.mjs` – Persona persistence and CLI coverage.
- `tests/token-classifier.test.mjs` – Classifier integration used in chat-to-research handoff.
- `tests/memory.test.mjs`, `tests/github-memory.test.mjs` – Memory manager and GitHub integration behaviour.

Manual smoke tests:

```bash
# Start CLI chat with memory (single-user mode)
npm start -- cli
/status
/chat --memory=true --depth=medium
```

```bash
# Web chat
npm start
# Connect via browser and run /chat --memory=true
```

Verify `/memory stats`, `/exitmemory`, and `/research <query>` inside the chat session.

---

## 8. Extensibility Notes

- **Custom Prompts**: Extend persona definitions in `app/infrastructure/ai/venice.characters.mjs` and expose via CLI/Web prompts.
- **Memory Scoring**: Refine `calculateSimilarity` or integrate a vector store if higher fidelity relevance is required.
- **Audit Logging**: Leverage `research.output-manager.mjs` to stream chat events to external telemetry.
- **Multi-User Web Sessions**: Current implementation keeps per-WebSocket session state. Ensure scaling strategies consider memory footprint per session.

---

Treat this guide as canonical for the live chat system. Update it whenever command semantics, memory behaviour, or GitHub integration changes.


