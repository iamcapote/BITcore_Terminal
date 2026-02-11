<!--
Why: Capture system protocols, QA gates, and test patterns that govern delivery.
What: Performance budgets, workflow pipeline, memory sync, WebSocket spec, and verification gates.
How: Preserve canonical protocol and QA content in a single reference file.
Status: active
Last Updated: 2026-02-02
-->

# Protocols, Testing, and QA

## 21) Protocol & Performance Budgets

### WebSocket Contract
- All messages must be JSON structured data (no plain-text payloads).
- Message schema: `{ type, id?, timestamp, data, metadata? }`.

### Performance Budgets
- LLM: soft 2s, hard 5s, exponential backoff (max 3).
- Memory: <50 MB per workflow, <200 MB concurrent.
- Events: 1000 events/sec sustained; emit → render <100 ms.
- Graph ops: 10k node export <2s; delta updates <50 ms.
- Abort propagation <10 ms; prefer streaming over buffering.

## 21.1) Research Workflow Pipeline (LangGraph.js)

**State Machine Nodes**
- Coordinator → Planner → Clarification (conditional) → Execution Team → Reporter.
- Checkpointing enabled for interruption/resume.

**Clarification Loop**
- Trigger when plan confidence is low or requirements ambiguous.
- User approves/edits plan before execution resumes.

## 26) Memory Sync Protocol & Conflict Resolution

**Bidirectional Sync Events**
- BITcore → Ontology: `mission:started`, `mission:step_completed`, `mission:completed`, `memory:inserted`, `graph:updated`.
- Ontology → BITcore: `workflow:planned`, `agent:profile_updated`, `secret:stored`.

**Event payload examples (canonical)**

`mission:started`
```json
{
	"type": "mission:started",
	"timestamp": "2025-10-17T10:00:00Z",
	"data": {
		"missionId": "mission-2025-10-17-abc",
		"title": "Research LangChain agent patterns",
		"goal": "Analyze Agent Zero and DeerFlow architectures",
		"agentProfile": "researcher",
		"tags": ["langchain", "agents"]
	}
}
```

`mission:step_completed`
```json
{
	"type": "mission:step_completed",
	"timestamp": "2025-10-17T10:05:00Z",
	"data": {
		"missionId": "mission-2025-10-17-abc",
		"stepId": "step-1",
		"action": "search",
		"query": "LangChain agent patterns",
		"resultSummary": "Found 45 sources covering...",
		"tokensUsed": 1200
	}
}
```

`mission:completed`
```json
{
	"type": "mission:completed",
	"timestamp": "2025-10-17T12:00:00Z",
	"data": {
		"missionId": "mission-2025-10-17-abc",
		"status": "completed",
		"finalSummary": "Agent Zero uses hierarchical delegation...",
		"telemetry": {
			"totalQueries": 12,
			"totalSources": 45,
			"tokensUsed": 15000,
			"durationMs": 120000
		},
		"archiveId": "archive-2025-10-17-abc"
	}
}
```

`memory:inserted`
```json
{
	"type": "memory:inserted",
	"timestamp": "2025-10-17T10:10:00Z",
	"data": {
		"memoryId": "mem_abc123",
		"text": "Agent Zero uses monologue loop for reasoning",
		"type": "summary",
		"missionId": "mission-2025-10-17-abc",
		"tags": ["agent-zero", "architecture"]
	}
}
```

`graph:updated`
```json
{
	"type": "graph:updated",
	"timestamp": "2025-10-17T10:15:00Z",
	"data": {
		"missionId": "mission-2025-10-17-abc",
		"graphDelta": {
			"nodesAdded": [
				{ "id": "query-5", "type": "QueryNode", "query": "...", "depth": 2 }
			],
			"edgesAdded": [
				{ "from": "query-4", "to": "query-5", "label": "DERIVES_FROM" }
			]
		}
	}
}
```

**Conflict Resolution**
- Last-write-wins with timestamp comparison.
- Graph merges: atomic node+edge updates; UI shows diff on conflicts.
- Memory dedupe: semantic similarity > 0.9 → merge metadata.

**Observability Metrics**
- `sync.events_published`, `sync.events_processed`, `sync.latency`, `sync.conflicts_detected`, `memory.faiss_size`.

## 27) WebSocket Protocol Specification (Extended)

**Message Schema**
```typescript
interface WebSocketMessage {
  type: string;
  id?: string;
  timestamp: number;
  data: object;
  metadata?: { agentId?: string; sessionId?: string; correlationId?: string; };
}
```

**Message Types**
- `command`: client → server command invocation
- `event`: server → client progress updates
- `response`: server → client final result
- `error`: structured errors
- `stream`: incremental output chunks

**Anti-Pattern**
- Never send unstructured text-only payloads; always wrap in structured `data`.

**Event Schema Registry (Standard Events)**
- `agent:started` → { agentId, profile, parentId }
- `agent:reasoning` → { agentId, reasoning, toolCalls }
- `agent:tool_called` → { agentId, tool, args }
- `agent:tool_result` → { agentId, tool, result, duration }
- `agent:completed` → { agentId, result, tokenUsage }
- `agent:error` → { agentId, error, stack }
- `mission:created` → { missionId, title, agentProfile }
- `mission:started` → { missionId, timestamp }
- `mission:progress` → { missionId, phase, percentComplete }
- `mission:completed` → { missionId, result, duration }
- `memory:saved` → { memoryId, text, area, tags }
- `memory:loaded` → { query, results[], count }
- `memory:consolidated` → { beforeCount, afterCount, mergedIds }
- `workflow:state_change` → { workflowId, fromState, toState, stateData }
- `workflow:checkpoint` → { workflowId, checkpointId, stateSnapshot }

## 27.1) WebSocket Message Examples (Operational)

**Command**: structured `command` messages with `data.command` + `data.args`.
**Event**: progress updates use `event` with `data.event` and contextual payloads.
**Response**: final results include `data.result` + `tokenUsage`.
**Error**: `error` payloads include `code`, `message`, `details`.
**Stream**: incremental chunks with `streamType`, `sequence`, `isComplete`.

## 28) Testing Patterns (Integration)

**Mission Lifecycle Test**
- Create mission from workflow → execute → assert completion + telemetry.

**Event Sync Test**
- Publish `mission:started` → assert all subscribers receive.

**Conflict Resolution Test**
- Concurrent updates with timestamps → assert last-write-wins.

## 28.1) Streaming & Retrieval Tests (Derived)
- Abortable stream reader test (cancel signal releases lock and stops decoding).
- Retrieval injection test ensures sources only append to the final user message.
- Chunking contract test for default 4k/200 overlap.
- Local embedding fallback test (browser pipeline returns vector shape).
- Scheduler state test: `idle → running → idle|error` with atomic updates and context isolation.
- Secrets editor test: masked value merge preserves existing secrets and comments.
- Streaming redaction test: partial secret prefixes never leak across chunks.
- MCP tool cache test: refresh on miss; per-call session closes cleanly.
- OAuth reconnect test: `reconnectServer` reinitializes MCP; emits `ON_RUN_STEP_DELTA` with auth URL.
- Tool instance test: schema derived via `convertWithResolvedRefs`; Zod fallback for empty params.
- Action set loading test: domain parser + OpenAPI validation + encrypted metadata flow.

## 28.2) Checkpointing & Replay (Derived)
- Workflow checkpoint saver persists state at `stop|interrupt`.
- Replay pipeline emits prior stream events deterministically.
- `ChatStreamManager` (Deerflow) tracks per-thread message chunks in memory and persists to MongoDB/Postgres on finalize.
- Finish reasons: `stop` (normal completion), `interrupt` (user or system halt).
- Chunk indexing via cursor in `InMemoryStore` namespace; all chunks merged on persist.

## 28.3) Human-in-the-Loop & Clarification Tests (Derived)
- Plan approval interrupt: agent halts at `human_feedback` node; user can `[EDIT_PLAN]` or `[ACCEPTED]`.
- Clarification loop test: simulate multi-round questions; assert `clarification_rounds` increments and history populates.
- Max rounds cap test: verify coordinator handoff when `max_clarification_rounds` exceeded.
- Flow state manager test: `createFlowWithHandler` → handler runs once; `failFlow` propagates abort.

## 28.4) Swarm & Fan-Out Tests (OpenAI-Swarm-derived)
- Manager bootstrap test: `findOrUpsertManager` creates assistant with `delegate` tool; existing manager upserted.
- Tool schema generation: `toolsFromAssistants` enumerates assistant IDs + `<none>` fallback.
- Delegation fan-out test: `delegateTaskToChildren` spawns parallel child runs via `Promise.all`; subRuns array populated.
- Child thread traceability: metadata includes `delegatedBy`, `viaFunc`, `toAssistant`, `originatingToolCallId`.
- Tool output deduplication: `deDupeToolOutputs` merges identical tool call outputs.
- Event emission test: `poll_event`, `parent_assistant_complete`, `child_assistants_complete` fire in order.
- Message history pagination: `messageHistoryForThread` iterates all pages and flattens content.

## 28.5) Vector Provider Tests (VectorAdmin-derived)
- Provider interface test: Pinecone, Chroma, Qdrant implement `connect`, `collections`, `rawGet`, `rawQuery`.
- Pinecone topK backoff: 3-try progressive reduction on 500 errors.
- Chroma distance conversion: `distanceToScore` maps L2 to 0–1 range.
- Document processor test: `/process` extracts text, returns `{ success, reason, metadata }`.
- Batch upsert test: chunks limited to 500 per batch; metadata always includes `text` key.
- Auth header injection: `#appendClientAuthHeaders` vs `#appendRawAuthHeaders` paths tested.

## 28.6) SSE & SSO Tests (Semantic-Flow-derived)
- SSE fan-out test: client set adds/removes correctly; heartbeat pings fire on interval.
- Webhook deduplication: `markSeen`/`wasSeen` respect 2-minute TTL; sweep cleans old entries.
- JWT session test: `signSession` creates valid HS256 token; `verifySession` rejects tampered/expired tokens.
- CSRF test: requests without `x-csrf-token` header or mismatched cookie rejected.
- `fetchWithRetry` backoff: 429/5xx trigger exponential delay up to 3 attempts.
- AI streaming proxy: NDJSON lines map to SSE events (`meta`, `token`, `done`, `error`).
- Persona cache test: stale cache bypasses fetch; 60s TTL honored.

## 28.7) Multi-Agent Graph Tests (AIbitat-derived)
- `start()` dispatches initial message to correct agent/channel.
- `selectNext()` LLM call returns valid speaker from group.
- `interrupt()` pauses flow; `continue()` resumes with feedback.
- Tool execution: `handleExecution` returns sync result; `handleAsyncExecution` streams.
- Hallucination recovery: invalid function name triggers retry prompt.
- `maxRounds` cap terminates runaway conversations.
- Provider factory returns correct client for each provider type.

## 28.8) Visual Workflow Tests (AgentFlows-derived)
- Flow JSON load/save round-trips correctly.
- `FlowExecutor.getValueFromPath` resolves dot/bracket notation.
- Step executors: API call, LLM instruction, web scraping return expected shapes.
- Flow plugin registration: `@@flow_{uuid}` appears in function registry.
- Start block variables bind correctly to downstream steps.

## 28.9) Prompting Engine Tests (Semantic-Flow-derived)
- `callProvider` aggregates internal SSE stream to final text.
- `convertTextToWorkflow` produces valid workflow JSON.
- `executeWorkflowWithFormat` sanitizes workflow and returns expected output.
- `enhanceNode` applies variant instructions (improve, optimize, simplify).
- Ontology mode: `force_framework` prefers known types; `novel_category` allows new.

## 28.10) ChatGPT-UI SSE Consumption Tests
- `fetchEventSource` handles partial chunks and reconnect.
- Message queue typewriter effect appends chunks with configurable delay.
- Abort controller terminates in-flight fetch cleanly.
- Title generation: `genTitle` fires after first user/assistant exchange.
- Scroll behavior: `scrollIntoView` called on new message arrival.

## 28.11) Clarification Flow Tests (Deerflow-derived)
- `needs_clarification()` returns true when enabled + rounds > 0 + not complete + not exceeded max.
- Coordinator branching: clarification-disabled path skips directly to planner.
- Clarification history accumulates user responses across rounds.
- `handoff_to_planner` tool call transitions state to planner node.
- Max rounds cap: after `max_clarification_rounds`, auto-handoff to planner.
- Clarified question injection: planner receives synthesized question, not raw history.

## 28.12) Stream Consumption Tests (Chatbot-UI-derived)
- `consumeReadableStream` reads until `done: true`.
- Abort signal triggers `reader.cancel()` and exits loop.
- TextDecoder `{ stream: true }` handles partial UTF-8 sequences.
- `reader.releaseLock()` called in finally block regardless of error.
- Token budget truncation: oldest messages dropped when budget exceeded.
- Retrieval text injection: appended to preceding user message content.

## 28.13) Agent Zero Monologue Tests (Agent-Zero-derived)
- `AgentContext` registry: `get(id)`, `first()`, `all()` return correct contexts.
- `communicate(msg)` with active task sets intervention on agent.
- `monologue()` loop: `InterventionException` restarts iteration; `HandledException` terminates.
- `LoopData` cleared between iterations; persistent extras preserved, temporary cleared.
- Extension hooks fire in order: `monologue_start` → `message_loop_start` → `before_main_llm_call` → `message_loop_end` → `monologue_end`.
- `handle_intervention()` raises `InterventionException` and appends user message.
- `process_tools()` parses `tool_name:method` format correctly.
- MCP tool lookup precedes local tool lookup; fallback works when MCP unavailable.
- `RepairableException` forwarded to history as warning; other exceptions fatal.
- Stream callbacks: `reasoning_callback` and `response_callback` receive incremental chunks.

## 28.14) MCP OAuth Flow Tests (LibreChat-derived)
- `createRunStepDeltaEmitter` emits `ON_RUN_STEP_DELTA` with auth URL and expiry timestamp.
- `createOAuthStart` registers flow handler; callback invoked on OAuth initiation.
- `createOAuthEnd` emits success event with tool call payload.
- `createAbortHandler` fails flow via `flowManager.failFlow` on abort signal.
- `reconnectServer` re-initializes server; returns tools array on success.
- `createMCPTool` converts parameters to Zod schema; falls back to optional string input.
- Tool key parsing: `{toolName}{delimiter}{serverName}` splits correctly.
- Google/Vertex response unwrapping: array results → first element; text content extracted.
- `mcpManager.callTool` receives OAuth callbacks and token methods.
- Flow state persists across reconnects; OAuth tokens stored via `createToken`/`updateToken`.

## 28.15) MCP Config & Client Tests (Agent-Zero-derived)
- Server type detection: explicit `type` overrides URL heuristic; stdio/SSE/streamable HTTP accepted.
- `normalize_config` accepts list or `mcpServers` map and produces a list.
- Disabled servers appear in `disconnected_servers` with error reason.
- `update_tools()` populates tool cache; `call_tool()` refreshes on cache miss.
- Session-per-operation: `ClientSession` created per tool call; no shared state leaks.
- `get_servers_status()` returns tool counts, error string, and log availability.

## 28.16) Secrets Redaction Tests (Agent-Zero-derived)
- `StreamingSecretsFilter` masks full secret values and holds prefix across chunk boundaries.
- `finalize()` masks unresolved partial with `***`.
- `save_secrets_with_merge` preserves comments/order and retains masked values.
- Placeholder replacement errors throw `RepairableException` for missing keys.

## 28.17) Task Scheduler Tests (Agent-Zero-derived)
- `TaskSchedule.to_crontab()` matches cron fields with timezone set.
- `TaskPlan` enforces timezone localization on todo/in_progress/done timestamps.
- `BaseTask.on_error()` moves task to `ERROR` and persists `last_result`.
- `BaseTask.on_success()` resets to `IDLE` and updates timestamps.
- Scheduler persists tasks under `tmp/scheduler` and reloads without loss.

## 28.18) History Compression Tests (Agent-Zero-derived)
- Large message compression replaces raw payloads with summary placeholder.
- Topic compression collapses middle messages into a summary record.
- Bulk compression triggers after `BULK_MERGE_COUNT` threshold.
- Token ratios preserve most recent topic while trimming older history.

## 28.19) Rate Limiter Tests (Agent-Zero-derived)
- Sliding window cleanup drops items older than timeframe.
- `wait(callback)` blocks until limits are under threshold.
- Multiple counters (`tokens`, `requests`) tracked independently.

## 28.20) Logging & Masking Tests (Agent-Zero-derived)
- Secret masking applies to heading/content/kvps recursively.
- Truncation inserts `<< N Characters hidden >>` marker.
- `updates[]` tracks incremental changes for UI polling.

## 28.21) Notification Tests (Agent-Zero-derived)
- Notification limit enforces oldest eviction and renumbers items.
- `group` field preserved for batching in UI.
- `mark_all_read()` flips `read` flag for all items.

## 28.22) Memory Consolidation Tests (Agent-Zero-derived)
- Similarity search filters deleted docs by ID before analysis.
- Timeout guard falls back to direct insert.
- `replace_similarity_threshold` blocks unsafe replacements.
- Consolidation actions map to expected inserts/updates/deletes.

## 28.23) Backup Patterns Tests (Agent-Zero-derived)
- Include/exclude patterns preserve defaults and skip embeddings cache.
- Pattern translation replaces old root with current root.
- Metadata includes system/environment info and integrity flags.

## 28.24) Prompt Truncation Tests (LibreChat-derived)
- `truncateText` appends truncation notice at max length.
- `smartTruncateText` keeps head/tail halves with ellipsis.
- `truncateToolCallOutputs` replaces tool outputs when over token threshold.

## 28.25) Assistant Swarm Tests (OpenAI Assistant Swarm-derived)
- `EnableSwarmAbilities()` attaches `swarm` to `client.beta.assistants`.
- Manager assistant is upserted by name and tools derived from assistants list.
- `delegateWithPrompt()` creates thread metadata and starts manager run.
- Parallel tool calls parsed from `multi_tool_use.parallel` with `tool_uses` shape.
- `compressToolCalls()` normalizes to `agentId` list for delegation.
- `pollRun()` exits after 5 attempts or settled state.
- `runMessage()` returns first assistant message in ascending order.
- `deDupeToolOutputs()` merges duplicate outputs by `tool_call_id`.
- Child delegation rejects unknown `agentId` and includes last user message context.
- Child thread metadata includes `delegatedBy` and `originatingToolCallId`.

## 28.26) Sidebar UX Tests (Chatbot-UI-derived)
- Content-type switch renders correct list and folders for each entity.
- Search filter is case-insensitive and matches by `name`.
- Create button opens correct modal or new chat action.
- Drag/drop into folder updates `folder_id`; drop on empty clears folder.
- Date buckets sort chats into Today/Yesterday/Previous Week/Older.
- Overflow state adjusts width to account for scrollbar.

## 28.27) Tool Orchestration Tests (LibreChat-derived)
- `processRequiredActions()` loads tools/toolkits and returns outputs for each action.
- Vision tool calls use `visionPromise` and record usage.
- OpenAPI action tools validated before `openapiToFunction` conversion.
- Tool call ordering uses `mappedOrder` for deterministic UI rendering.
- Image tools emit image content and safe tool output string.
- Capability gating disables tools when `AgentCapabilities` disallows them.
- Action delimiter mapping finds domain and resolves function signature.
- Web search callbacks stream results via `createOnSearchResults`.
- Custom user vars resolved via `getUserMCPAuthMap` when enabled.

## 28.28) Plugin Auth Tests (LibreChat-derived)
- Auth values encrypted at rest and decrypted on read.
- `getUserPluginAuthValue()` respects `pluginKey` scoping.
- `updateUserPluginAuth()` upserts with encryption.
- `deleteUserPluginAuth()` removes single or all auths.

## 28.29) File Browser Tests (Agent-Zero-derived)
- Path resolution rejects traversal outside base directory.
- `ls -la` parsing includes symlink targets and preserves filenames with spaces.
- Entry payload includes `name`, `path`, `modified`, `size`, `type`, `is_dir`.
- Parent path empty at root; set for nested directories.
- Listing caps at 10,000 entries.
- Upload uses `secure_filename` and respects max size.
- Base64 upload writes within base dir only.
- Delete removes files or directories recursively.

## 28.31) Alerts UI Tests (Chatbot-UI-derived)
- Notification indicator displays count badge.
- Popover opens from bell icon and renders content.

## 28.32) Message Rendering Tests (Chatbot-UI-derived)
- Assistant header uses avatar image when available; fallback to model icon.
- Copy action toggles checkmark for 2 seconds.
- Edit mode focuses textarea and submits on Cmd+Enter.
- Regenerate uses previous user message when empty.
- Tool status line shows retrieval vs generic tool states.
- Source panel expands and opens file item preview.
- Image thumbnails open preview modal on click.

## 28.33) Markdown & Code Block Tests (Chatbot-UI-derived)
- `remark-gfm` and `remark-math` render tables and math.
- Streaming cursor `▍` rendered as pulsing span.
- Inline code vs block detection uses newline check.
- Code blocks include copy and download actions.
- Language mapping assigns correct file extension.

## 28.34) Toast & Key Dialog Tests (LibreChat-derived)
- `toastState` tracks `open`, `message`, `severity`, `showIcon`.
- Expiration presets map to timestamps or null.
- Required field validation blocks submit and shows error toast.
- Revoke key flow shows confirmation and success/error toasts.

## 28.35) Replies & Markdown Memo Tests (Chatbot-UI-derived)
- Replies drawer opens via sheet trigger and shows badge count.
- Markdown memoization skips re-render when `children`/`className` unchanged.

## 28.36) Chat History & Scroll Tests (Chatbot-UI-derived)
- Arrow-up/down navigates prior user messages, skipping assistant entries.
- History index resets when messages removed or generation stops.
- Auto-scroll stays on bottom while generating unless user scrolled.
- `isOverflowing` toggles when content exceeds container height.

## 28.37) Prompt & Command Parsing Tests (Chatbot-UI-derived)
- `@` opens assistant picker; selection updates model/settings and files/tools.
- `/` opens prompt picker; selection inserts prompt text.
- `#` opens file picker; selection enables retrieval and adds files.
- `!` opens tool picker; selection appends tool and clears command token.

## 28.38) Preset Management Tests (LibreChat-derived)
- Default preset loads on first visit and seeds new conversation.
- Preset selection triggers conversation switch logic when modular.
- Import/export use `filenamify` and JSON export.
- Delete requires confirm and updates query cache optimistically.

## 28.39) Chat Persistence Tests (Agent-Zero-derived)
- Background contexts are excluded from persistence.
- Chats serialize to `tmp/chats/{id}/chat.json` with log snapshot.
- Import regenerates IDs and restores agent hierarchy.
- Legacy `*.json` chats migrate to folder layout.

## 28.40) Token & Truncation Tests (Agent-Zero-derived)
- `approximate_tokens` applies 10% buffer.
- `trim_to_tokens` preserves start/end with ellipsis.
- `truncate_dict_by_ratio` inserts placeholder and maintains structure.

## 28.41) Runtime & RFC Tests (Agent-Zero-derived)
- `call_development_function` routes via RFC in dev mode.
- Sync wrapper times out after 30 seconds.
- Persistent runtime ID stored in dotenv when missing.

## 28.42) Bookmark UX Tests (LibreChat-derived)
- Edit dialog submits via mutation and closes on success.
- Success focuses new tag element after update.
- Drag/drop reorders rows and persists new position.
- Delete/edit buttons render per row.
- Table removes duplicate `_id` entries and sorts by `position`.
- Pagination updates page index and disables prev/next at bounds.
- Search filter matches tag substring case-insensitively.
- Bookmark form blocks duplicate tags from cache or current list.
- `addToConversation` checkbox toggles tag on active conversation.

## 28.43) Settings & Dotenv Tests (Agent-Zero-derived)
- Settings schema includes model/provider, rate limits, memory, MCP, RFC fields.
- UI conversion yields select/range/password field types with placeholders.
- `save_dotenv_value` updates existing key or appends new key.
- `load_dotenv()` refreshes process env after save.

## 28.44) Attachment Manager Tests (Agent-Zero-derived)
- Allowed extension and MIME validation gates uploads.
- Metadata includes type/extension/preview for images.
- Preview generator resizes and encodes JPEG.
- Invalid filename returns error.

## 28.45) Preset Save-As Tests (LibreChat-derived)
- Enter key submits preset creation.
- `cleanupPreset` applied before mutation.
- Success toast closes dialog.

## 28.46) Bookmark Delete Tests (LibreChat-derived)
- Delete dialog requires confirm click.
- Success and error toasts fire on mutation result.

## 37) Verification & QA Gates (Required)

**Gate A — Document Integrity**
- Every unique signal from legacy files maps to this plan.
- All conflicts resolved and stated (Nova canonical, single-user).

**Gate B — Build & Type Safety**
- Nova build passes.
- No TypeScript or module resolution errors.

**Gate C — Parity**
- CLI metadata endpoint lists all commands.
- GUI renders controls for every command/flag.

**Gate D — WebSocket Contract**
- Telemetry schema validated.
- No runtime schema mismatches.

**Gate E — UX/Accessibility**
- Keyboard navigation audit passes.
- WCAG 2.2 AA checks recorded.

**Gate F — Performance**
- Lighthouse FCP <2.5s (3G).
- Bundle size within budget.

**Gate G — Single-User Contract**
- One operator identity, default admin.
- No multi-user UI routes or role switching exposed.

## 37.1) Implementation Checklist (Required Signals)
- Agent hierarchy with Guard → Do → Verify structure.
- State machine workflow (coordinator, planner, execution nodes, reporter).
- Clarification loop for ambiguous user goals.
- Human checkpoints: plan approval before execution; per-section review before reporter synthesis.
- BYOK security with client-side AES encryption; no server key storage.
- SSE event streaming with reconnection and heartbeat.
- Webhook ingestion with HMAC signature verification.
- Tool registry with rate limiting, retry logic, provider abstraction.
- Session management with HttpOnly cookies and CSRF double-submit.
- Performance timeouts (2s soft, 5s hard) with abort propagation.
- Memory budgets (<50 MB per workflow, <200 MB concurrent).
- Structured logging with sensitive field redaction.
- Backpressure handling for unbounded concurrency.
- Idempotent external operations with state preservation on failure.

## 37.2) Tooling Guardrails (Behavior Update)

**Behavior update constraints**
- No adjustment can remove all tools or disable core capabilities.
- Permanent changes require audit logging and rollback support.
- CLI supports `agents behavior list|revert` for review and rollback.

## 38.3) Security, API Contracts, and Rollback Controls

**Session + auth**
- `session_token` HttpOnly cookie, 7-day expiry.
- `csrf_token` double-submit on mutations.
- `sso_nonce` HttpOnly, single-use for SSO callback validation.
- Bearer tokens scoped to session; rotate on security events.

**Core API contracts (baseline)**
- `GET /api/health` → `{ ok, version, uptime }`.
- `GET /api/config` → `{ providers, models, features }`.
- `POST /api/auth/login` sets session cookie; `POST /api/auth/logout` clears cookies.
- `GET /api/me` → `{ user, permissions }`.
- `GET /api/events` → SSE stream; `POST /api/webhooks/:source` HMAC verified.
- `POST /api/ai/search` → `{ results }`; `POST /api/ai/stream` → SSE output.
- `GET /api/ai/models` → `{ providers, models, pricing }`.
- `POST /api/webhooks/:source` enforces a 2-minute dedupe window.

**Storage security**
- Client-side AES-256 for stored secrets; server never logs raw keys.
- Structured logs redact sensitive fields.

**Rollback controls**
- Feature flags for new paths; canary rollout with error-rate monitoring.
- State snapshots before risky operations; restore on failure.

## 38.3.1) Test Patterns (Integration)

**Mission lifecycle**
- Create mission from workflow → execute → assert completion + telemetry.

**Event sync**
- Publish `mission:started` → assert all subscribers receive.

**Conflict resolution**
- Concurrent updates with timestamps → assert last-write-wins.
