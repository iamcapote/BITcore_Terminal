# Chat & Memory System – Technical Guide

This guide documents the current chat subsystem and memory integration implemented in the `/app` directory as of September 2025. It replaces prior aspirational documentation and tracks the live codebase.

---

## 1. Architecture Overview

| Layer | Modules | Responsibility |
| --- | --- | --- |
| **Entry Points** | `app/commands/chat.cli.mjs`, `app/features/research/routes.mjs` (WebSocket chat command handling) | Parse `/chat` invocations, configure session state, and acknowledge chat readiness. |
| **Session State** | WebSocket session objects (`session.isChatActive`, `session.chatHistory`, `session.memoryManager`) | Persist chat context, selected model/character, and memory manager instance for Web clients. |
| **LLM Access** | `app/infrastructure/ai/venice.llm-client.mjs`, `app/infrastructure/ai/venice.response-processor.mjs` | Submit chat turns to Venice LLM and clean model responses before display. |
| **Memory Management** | `app/infrastructure/memory/memory.manager.mjs`, `app/infrastructure/memory/github-memory.integration.mjs` | Store, retrieve, summarise, and optionally commit memories to GitHub depending on user configuration. |
| **Output Plumbing** | `app/utils/research.output-manager.mjs`, `app/utils/websocket.utils.mjs` | Mirror chat output across CLI stdout and WebSocket connections, respecting enable/disable input events. |

---

## 2. Chat Session Flow

1. **Command Dispatch**
   - CLI: `/chat [--memory=true] [--depth=short|medium|long]` triggers `executeChat` in `chat.cli.mjs`.
   - WebSocket: `handleCommandMessage` (`app/features/research/routes.mjs`) interprets `/chat` and updates the session, then sends a `chat-ready` event.

2. **Session Initialisation**
   - A Venice `LLMClient` is prepared with the requested model/character (defaults: model `qwen3-235b`, character `bitcore`).
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
   - `/research …` transitions into the research pipeline using accumulated chat context via `startResearchFromChat`.

---

## 3. Memory Manager Details

`MemoryManager` supports three depth profiles defined in `app/infrastructure/memory/memory.manager.mjs`:

| Depth | Max Memories | Retrieval Limit | Similarity Threshold | Summarise Every |
| --- | --- | --- | --- | --- |
| `short` | 10 | 2 | 0.7 | 10 turns |
| `medium` | 50 | 5 | 0.5 | 20 turns |
| `long` | 100 | 8 | 0.3 | 30 turns |

Key behaviours:
- **Storage**: Every turn is assigned an ID, timestamp, role, and score placeholder before entering the ephemeral store.
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
| `/research <query>` | CLI & Web | Uses `startResearchFromChat` to bridge into the research pipeline while preserving chat context. |

Additional behaviours:
- Password prompts for key decryption (if required) are routed through the existing prompt infrastructure (`promptHiddenFixed` for CLI, `wsPrompt` for Web).
- Chat history is cleared when the session exits; Web clients receive `enable_input` to unlock the terminal.

---

## 5. GitHub Memory Finalisation Flow

1. User issues `/exitmemory` (or closes chat with memory enabled).
2. `MemoryManager.summarizeAndFinalize()` composes the dialogue, generates summaries using Venice if necessary, and prepares upload content.
3. `GitHubMemoryIntegration.commitMemory()` pushes the summary to the configured repository/branch.
4. On success, a `memory_commit` WebSocket event is emitted with the commit SHA; CLI prints the SHA via `outputManager`.
5. The session’s `memoryManager` instance is cleared.

If GitHub settings are missing or commit fails, the memory is still summarised locally and a fallback message is shown.

---

## 6. Testing & Validation

Automated coverage:
- `tests/chat.test.mjs` – Core chat flow smoke tests.
- `tests/token-classifier.test.mjs` – Classifier integration used in chat-to-research handoff.
- `tests/memory.test.mjs`, `tests/github-memory.test.mjs` – Memory manager and GitHub integration behaviour.

Manual smoke tests:

```bash
# Start CLI chat with memory
npm start -- cli
/login <user>
/chat --memory=true --depth=medium
```

```bash
# Web chat
npm start
# Connect via browser and run /chat --memory=true
```

Verify `/memory stats`, `/exitmemory`, and `/research <query>` inside the chat session.

---

## 7. Extensibility Notes

- **Custom Prompts**: Extend persona definitions in `app/infrastructure/ai/venice.characters.mjs` and expose via CLI/Web prompts.
- **Memory Scoring**: Refine `calculateSimilarity` or integrate a vector store if higher fidelity relevance is required.
- **Audit Logging**: Leverage `research.output-manager.mjs` to stream chat events to external telemetry.
- **Multi-User Web Sessions**: Current implementation keeps per-WebSocket session state. Ensure scaling strategies consider memory footprint per session.

---

Treat this guide as canonical for the live chat system. Update it whenever command semantics, memory behaviour, or GitHub integration changes.


