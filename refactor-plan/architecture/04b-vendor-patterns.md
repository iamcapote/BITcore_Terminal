<!--
Why: Detailed vendor pattern catalog extracted from deep codebase analysis.
What: Implementation patterns derived from Agent Zero, Deerflow, LibreChat, AnythingLLM, Chatbot-UI, Semantic Flow, VectorAdmin, Superfile.
How: Organized by pattern category with adopt/defer/discard classifications.
Last Updated: 2026-02-02
-->

# Vendor Patterns Catalog

This document contains detailed implementation patterns extracted from vendor codebases. See [04-architecture-foundations.md](04-architecture-foundations.md) for the core architecture that these patterns support.

## 32) Vendor Pattern Mapping (Implementation Targets)

**Multi-Agent Orchestration**
- Deerflow LangGraph coordinator + checkpointing → `app/agents/coordinator.agent.mjs`, `app/infrastructure/workflow-orchestrator.mjs`.
- OpenAI Assistant Swarm delegation model → `app/infrastructure/agent-swarm.service.mjs`.
- Anything-LLM AIbitat channel routing → `app/infrastructure/agent-graph.service.mjs`.

**Tooling & Capabilities**
- Agent Zero MCP server + client type detection → `app/infrastructure/tool-registry.service.mjs`.
- LibreChat MCP OAuth reconnect + token storage → `app/infrastructure/mcp-auth.service.mjs`.
- Anything-LLM MCP server list/toggle → `app/features/tools/mcp.controller.mjs`.

**Frontend Shell**
- Chatbot-UI dashboard shell + sidebar switcher → `ShellLayout.tsx` + sidebar refactor.
- ChatGPT-UI settings ergonomics + multi-language scaffolding → `app/nova/src/modules/settings/*`.

**Vendor reference operational notes**
- Shell layout adapts Chatbot-UI structure (tabs + sidebar switcher) without 1:1 cloning.
- Sidebar refactor replaces static command buttons with content navigation and stateful tabs.

**Memory & RAG**
- Agent Zero memory prompts + consolidation loop → `app/infrastructure/memory.service.mjs`.
- Anything-LLM document ingestion + vector DB adapters → `document-processor.service.mjs`, `vector-db.adapter.mjs`.

**CLI ↔ GUI Parity**
- Superfile parity pattern → `commandMetadata` + `GET /api/commands` + auto-forms.

**Vendor Inventory Reference**
- Consolidated catalog lives in this document; refresh the list before new major phases.

**Vendor inventory snapshot**
- Agent Zero
- Deerflow
- LibreChat
- Chatbot-UI
- Anything-LLM
- Semantic Flow
- VectorAdmin
- Superfile
- OpenAI Assistant Swarm
- Ollama Open WebUI
- ChatGPT-UI

**Deletion Readiness Checklist (No Source Dependencies)**
- Orchestration graph nodes/edges and conditional routing captured.
- Checkpoint persistence behavior captured with storage fallback notes.
- MCP transport detection, tool normalization, and caching captured.
- OAuth reconnect flow captured with token persistence steps.
- Scheduler state model + timezone-safe cron captured.
- Stream reader abort semantics captured.
- Provider catalog + BYOK model captured.
- Vector adapter schema validation + sanitization captured.
- Swarm delegation flow captured (manager upsert, child runs, events).
- Vector admin operations captured (document upload + MIME allowlist).
- Deployment ergonomics captured (single-command deploy, scale-to-zero cues).
- Chat shell ergonomics captured (settings + localization signals).

## 32.1) Vendor Reference Patterns (Operational Notes)

**Multi-agent orchestration**
- Coordinator/dispatcher model with checkpoint recovery (Deerflow).
- LangGraph state machine + checkpoint saver for interruption/resume.
- State machine nodes: `coordinator → background_investigator → planner → human_feedback → research_team → reporter`.
- Conditional routing via state field `goto` for coordinator decisions.

**Clarification loop (Deerflow)**
- Enabled via `enable_clarification` flag; configurable `max_clarification_rounds`.
- Coordinator asks clarifying questions until confidence high or rounds exhausted.
- History tracked in `clarification_history` array; final question passed to planner.
- Human feedback node uses LangGraph `interrupt` primitive for approval/edit.

**Tooling & capabilities**
- MCP server exposes tool annotations for remote usage (Agent Zero).
- MCP client supports stdio, SSE, streamable HTTP with per-call sessions and cached tool lists.
- Server type detection via explicit `type` or URL presence; tool names normalized to lowercase/underscored identifiers.
- LibreChat wires MCP tools with OAuth reconnect + flow state manager persistence.
- AnythingLLM exposes `mcpServers` endpoints for list, toggle, delete, force-reload.

**MCP OAuth flow (LibreChat-derived)**
- `/api/mcp/:serverName/oauth/initiate` reads flow state and redirects to provider authorization URL.
- `/api/mcp/:serverName/oauth/callback` validates code/state, completes OAuth, stores tokens, clears cached flow, and reconnects.
- OAuth reconnect manager loads flow state + token methods on server boot.
- Token persistence uses explicit create/update/find/delete hooks for recovery.

**Scheduler patterns (Agent Zero-derived)**
- Task states: `idle`, `running`, `disabled`, `error`; task types: `adhoc`, `scheduled`, `planned`.
- Cron schedule uses timezone normalization; next-run computation is UTC-safe.
- Plan object tracks `todo`, `in_progress`, `done` timestamps with state guards.

**Checkpoint persistence (Deerflow-derived)**
- Chat stream manager buffers chunks in an in-memory store and persists on finish.
- Persistent storage supports MongoDB or Postgres with table/collection checks.
- Chunk consolidation skips cursor metadata and stores ordered message list.

**Frontend shell & navigation**
- Sidebar content tree (sessions, chats, collections) modeled after Chatbot-UI.
- Sidebar state persisted in localStorage with hotkey toggle (`s`).
- Stream reader uses `ReadableStream` + `AbortSignal` cancellation and releases reader locks.

**Memory & RAG**
- Memory prompts include relevance filtering and consolidation stages (Agent Zero).
- AnythingLLM chat flow: validate message → quota checks → inject docs → vector search → source window → compress messages → stream/batch completion.
- Query-mode early exit when no embeddings found; refusal response configurable per workspace.

**Provider catalog & BYOK (Semantic Flow-derived)**
- Provider catalog exposes managed/default models and base URL overrides.
- Active provider stored client-side; model resolution falls back to provider defaults.

**Agent graph orchestration (Anything-LLM AIbitat-derived)**
- Agents, channels, and functions stored in maps with `maxRounds` guard.
- `skipHandleExecution` flag short-circuits tool chaining for direct tool output.
- EventEmitter hooks: `onMessage`, `onError`, `onTerminate`, `onInterrupt`, `onAbort`, `onStart`.

**Vector DB adapter contracts (Anything-LLM PGVector-derived)**
- Schema validation enforces `id`, `namespace`, `embedding`, `metadata`, `created_at` columns.
- JSONB sanitizer strips control characters before inserts.
- Connection validation checks table schema and warns on missing extension.

**Swarm delegation (OpenAI Assistant Swarm-derived)**
- Manager assistant is upserted with tool list from known assistants.
- Delegation splits tool calls, spawns child runs, and emits events for parent/child completion.
- Child run builds delegation message from parent prompt + last user message.

**Vector admin operations (VectorAdmin-derived)**
- Multi-provider vector admin UI with document upload and chunk-level CRUD.
- Document processor returns `{ success, reason, metadata }` and enforces MIME allowlist.

**Deployment ergonomics (Ollama Open WebUI-derived)**
- Single-command deploy pattern with scale-to-zero and GPU default cues.

**Chat shell ergonomics (ChatGPT-UI-derived)**
- Multi-language + multi-database settings imply configuration separation per workspace.

**CLI ↔ GUI parity**
- Superfile parity model: CLI flags map 1:1 to GUI controls via metadata.

## 32.2) Derived Patterns & Decisions (Adopt / Defer / Discard)

**Adopt (now)**
- Capability-driven routing for agents/tools (assistant registry + skill tags).
- Prompt assembly with strict token budgeting and retrieval injection at the last user message.
- Provider-agnostic routing for LLM and vector DBs with per-provider adapters.
- Human-in-the-loop plan approval in the research coordinator.
- Conversation branching as first-class UX and data model.
- Streaming-by-default with abortable readers and retry hooks.

**Defer (post single-user contract)**
- Multi-user RBAC, workspace sharing, and organization billing.
- Hosted embed widgets and white-label features.

**Discard (do not import)**
- Server-side storage of provider keys; keep BYOK session-only.
- Monolithic prompts without modular override layers.
- Supabase-style multi-tenant RLS without single-user contract validation.

## 32.3) Additional Vendor Patterns (Third Pass)

**SSE and SSO patterns (Semantic-Flow-derived)**
- In-memory SSE client set with fan-out broadcast; heartbeat pings every 15–30s; cleanup on `req.on('close')`.
- Webhook deduplication via `seenEvents` map with TTL (2min) and periodic sweep.
- JWT session: `signSession(user)` with HS256, 7-day expiry; `verifySession(token)` validates signature and exp.
- CSRF double-submit cookie: httpOnly session + readable `sf_csrf` cookie; validate `x-csrf-token` header.
- Discourse SSO flow: generate nonce, store in cookie, redirect to provider, validate on callback, create session.
- `fetchWithRetry` with exponential backoff on 429/5xx; `discourseGet`/`discoursePost` impersonate session user via `Api-Username`.
- AI streaming proxy: upstream NDJSON → SSE events (`meta`, `token`, `done`, `error`); metrics counter tracks requests/tokens/failures per persona.
- Persona list caching (60s TTL) with fallback path cascade; neutral `0-NULL` baseline when list unavailable.
- Version/build metadata endpoint with SSE stream for hot-reload notifications.

**AI provider routing (Semantic-Flow-derived)**
- `aiRouter.chatCompletion(args)` routes to configured provider with automatic path adaptation.
- Providers: `internal` (local), `openai`, `openrouter`, `venice`, `nous`, `morpheus`, `nebius`.
- Base URL overrides: `OPENAI_CUSTOMIZATION_BASE_URL`, `OPENROUTER_BASE_URL`, etc.
- Path adaptation: `adaptBodyAndPath` transforms body for `/chat/completions` vs `/responses` endpoints.
- History recording: `recordHistory` logs requests with masked API keys (`...${last4}`).
- Response metadata: `collectResponseMeta` extracts rate limits, request ID, token usage.
- Raw streaming: `fetchChatCompletionRaw` returns Response for direct SSE consumption.

**Provider validation (AnythingLLM-derived)**
- `AgentHandler.checkSetup()` validates 25+ provider env vars before agent invocation.
- Fallback chain: workspace provider → system provider → default (LMStudio/Ollama).
- Provider-specific checks: `ollamaSetup`, `openAiSetup`, `anthropicSetup`, etc.
- MCP integration: `loadMCPServers()` connects configured MCP servers on agent boot.
- Plugin attachment: `#attachPluginsFromConfig(aibitat, config)` wires tools by ID.

**VectorAdmin provider abstraction (VectorAdmin-derived)**
- Provider classes (Pinecone, Chroma, Qdrant, Weaviate) share normalized interface: `connect`, `collections`, `namespace(s)`, `totalIndicies`, `processDocument`, `rawGet`, `rawQuery`.
- Pinecone: `describeIndexRaw` checks readiness; `rawQuery` implements 3-try topK backoff (1000→500→250) for 500 errors on large metadata.
- Chroma: `distanceToScore` converts L2 distance; heartbeat check; `#appendClientAuthHeaders` / `#appendRawAuthHeaders` for token injection.
- Document processor (`/process` endpoint): receives filename, calls `extract_text`, returns `{ success, reason, metadata }`.
- `/accepts` endpoint returns `ACCEPTED_MIMES` whitelist for frontend validation.
- `processDocument` chains: split → embed → build submission → batch upsert (500 per chunk).
- Metadata always includes `text` key for LangChain compatibility (`langchainjs` pinecone store expects it).

**Superfile TUI architecture (Superfile-derived)**
- Bubble Tea model with `Init`, `Update`, `View` lifecycle.
- Multi-panel file browser: `fileModel` × 3 in `model.fileModel.filePanels[]`.
- `filePanelFocusType` enum tracks cursor across panels and sidebar.
- Keybindings via hotkey map; configurable in `~/.config/superfile/hotkeys.toml`.
- Process bar shows operation progress (copy, move, delete) with goroutine background work.
- Metadata panel: toggle via config; shows file stats, permissions, preview.
- Theme system: `ThemeConfig` struct with color fields; load from `themes/` directory.

**Patterns to discard (updated)**
- Per-user `.env` files; use central encrypted config.
- Database-first routing; keep file-system as source of truth for single-user.
- Heavy ORM abstractions; prefer explicit queries and repositories.
- Electron-only desktop wrappers; prefer Tauri/web-native for lighter footprint.
- Deerflow's raw NDJSON parsing for SSE; wrap in proper event decoding from the start.
- Semantic Flow's persona fallback cascade complexity; use explicit persona IDs where available.

## 32.4) Fourth Pass Patterns

**Workflow execution engine (Semantic-Flow-derived)**
- `WorkflowExecutionEngine` executes nodes sequentially with progress callbacks (`onProgress`).
- Node states: `pending → running → completed|error` with timing metrics.
- Upstream context injection: `prepareNodeInput` appends outputs from incoming edges.
- Execution order: topological sort (placeholder); production requires full dependency resolution.
- `PromptingEngine` three modes: text-to-workflow, workflow-execution, node-enhancement.
- Ontology modes: `force_framework` (prefer ontology), `novel_category` (prefer new), `exclude` (ignore).
- Enhancement variants: `improve`, `optimize`, `refactor`, `enhance`, `simplify`, `elaborate`.
- Prompt defaults stored in localStorage (`ai_prompt_defaults_v1`) with user-editable templates.

**AIbitat multi-agent graph (AnythingLLM-derived)**
- `AIbitat` class orchestrates agent conversations via `agents` Map, `channels` Map (groups), and `functions` Map (tools).
- Chat flow: `start(message)` → `chat(route)` → `reply(route)` → recursively continue until `TERMINATE` or `maxRounds`.
- Channel selection: `selectNext(channel)` uses LLM to pick next speaker from group members based on role descriptions.
- Interrupt/continue: `interrupt(route)` pauses flow; `continue(feedback)` resumes with optional user feedback.
- Tool execution: `handleExecution` (sync) or `handleAsyncExecution` (streaming) calls `fn.handler(args)` and appends result.
- Hallucination recovery: if function name not found, re-invoke with error message asking to retry.
- `skipHandleExecution` flag enables direct tool output without further LLM processing.
- Provider abstraction: 30+ providers (OpenAI, Anthropic, Ollama, Groq, Bedrock, etc.) with `getProviderForConfig`.
- EventEmitter hooks: `onMessage`, `onError`, `onTerminate`, `onInterrupt`, `onAbort`, `onStart`.

**AgentFlows visual orchestration (AnythingLLM-derived)**
- Flows stored as JSON in `storage/plugins/agent-flows/{uuid}.json`.
- Flow config: `name`, `description`, `active`, `steps[]` with `type` and `config`.
- `FLOW_TYPES`: `start`, `api-call`, `llm-instruction`, `web-scraping`, etc.
- `FlowExecutor` resolves variables via dot/bracket path notation (`data.items[0].name`).
- Executors: `executeApiCall`, `executeLLMInstruction`, `executeWebScraping` with introspection hooks.
- Flows load as `@@flow_{uuid}` plugins into agent function registry.
- Start block declares input variables; executor binds them before step execution.

**Deerflow clarification flow (Deerflow-derived)**
- `coordinator_node` handles two branches: clarification-enabled vs legacy mode.
- Clarification state: `clarification_rounds`, `clarification_history[]`, `max_clarification_rounds`, `is_clarification_complete`.
- `needs_clarification(state)` centralized logic: enabled + rounds > 0 + not complete + not exceeded max.
- Tool-based handoff: `handoff_to_planner`, `handoff_after_clarification` signal completion.
- Context injection: append clarification summary to planner prompt when enabled.
- MCP tool loading: `MultiServerMCPClient` dynamically loads tools; filter by `add_to_agents` list.
- Agent step execution: `_execute_agent_step` formats completed steps, invokes agent, updates observation list.
- Recursion limit: `AGENT_RECURSION_LIMIT` env var caps LangGraph recursion depth.

**Agent Zero monologue loop (Agent-Zero-derived)**
- `AgentContext` manages agent lifecycle: `id`, `agent0`, `log`, `paused`, `streaming_agent`, `task`.
- Context registry: `_contexts` dict with `get(id)`, `first()`, `all()`, `remove(id)` static methods.
- `communicate(msg, broadcast_level)` handles intervention injection or starts new task.
- `monologue()` outer loop: catches `InterventionException` to restart, `HandledException` to terminate.
- `LoopData` per-iteration state: `iteration`, `system[]`, `history_output[]`, `extras_temporary/persistent`, `params_temporary/persistent`.
- Extension hooks: `agent_init`, `monologue_start/end`, `message_loop_start/end`, `before_main_llm_call`, `system_prompt`.
- Stream callbacks: `reasoning_callback(chunk, full)`, `response_callback(chunk, full)` with intervention checks.
- Prompt building: `prepare_prompt` compiles system + history + extras into `list[BaseMessage]`.
- Tool dispatch: `process_tools(msg)` parses `tool_name:method` syntax, checks MCP first, falls back to local.
- Intervention handling: `handle_intervention()` pauses, appends intervention message, raises `InterventionException`.
- Error recovery: `RepairableException` forwarded to LLM; other exceptions trigger `handle_critical_exception`.
- Data sharing: `set_data(field, value)` / `get_data(field)` for cross-tool state.

**Agent Zero memory system (Agent-Zero-derived)**
- `Memory.Area` enum: `MAIN`, `FRAGMENTS`, `SOLUTIONS`, `INSTRUMENTS` for partitioned storage.
- Index registry: `Memory.index[memory_subdir]` caches loaded FAISS instances.
- Knowledge preload: `preload_knowledge(kn_dirs)` imports documents from configured folders on startup.
- Re-indexing: if embedding model changes, detect mismatch via `embedding.json` meta file and re-embed all docs.
- Document management: `insert_documents(docs)` returns IDs; `delete_documents_by_ids(ids)` removes by ID list.
- `MyFaiss.get_all_docs()` returns full docstore for migrations and re-indexing.

**MCP config + client lifecycle (Agent-Zero-derived)**
- Server type detection: `type` field overrides URL heuristic; supports stdio, SSE, and streamable HTTP.
- Name normalization: lowercase + non-alphanumeric replaced with underscores.
- Config normalization: accepts list or `mcpServers` map and normalizes to list.
- Disabled servers tracked in `disconnected_servers` with error details.
- Tool cache: `update_tools()` populates cached tool definitions; `call_tool()` refreshes on cache miss.
- Session-per-operation: `AsyncExitStack` creates a temporary `ClientSession` per call to avoid shared lifecycle issues.
- Tool prompt builder: `get_tools_prompt()` renders tool list with input schemas and usage format.
- `get_servers_status()` aggregates tool count, error, and log availability per server.

**MCP remote server tool (Agent-Zero-derived)**
- Integrated MCP server exposes `send_message` and `finish_chat` tools for remote chat control.
- `send_message` handles attachments by path or URL and optionally persistent chat IDs.
- `finish_chat` always resets and removes persistent context for cleanup.
- Tool annotations include `openWorldHint`, `readOnlyHint`, `destructiveHint`, `idempotentHint` for safety.

**Secrets management (Agent-Zero-derived)**
- Placeholder format: `§§secret(KEY)` with uppercase key normalization.
- Streaming secrets filter masks full values on the fly and holds secret prefixes to avoid partial leaks.
- `save_secrets_with_merge` preserves comments/order, keeps masked values (`***`), and supports deletion-by-omission.
- `create_streaming_filter()` snapshots current secrets for streaming redaction.
- `replace_placeholders()` throws `RepairableException` if key missing to force retry.

**Task scheduler (Agent-Zero-derived)**
- Task model types: `AD_HOC`, `SCHEDULED`, `PLANNED` with `TaskState` lifecycle.
- `TaskSchedule` stores cron fields and timezone; `to_crontab()` builds CronTab.
- `TaskPlan` tracks `todo → in_progress → done` timestamps; enforces timezone localization.
- `BaseTask` records `last_run`, `last_result`, `updated_at` on success/error.
- `on_error()` moves task to `ERROR`, persists after reload to avoid stale state.
- `TaskScheduler` persists tasks under `tmp/scheduler` and uses `DeferredTask` for execution.

**VectorDB utilities (Agent-Zero-derived)**
- Cached embeddings per model namespace stored in memory to reduce repeated embed cost.
- Similarity threshold search uses `similarity_score_threshold` with score normalization.
- Metadata filtering uses comparator generated from expression string.

**History compression & summarization (Agent-Zero-derived)**
- Token budget split: `CURRENT_TOPIC_RATIO`, `HISTORY_TOPIC_RATIO`, `HISTORY_BULK_RATIO`.
- Large message compression: replace oversized raw messages with summary placeholder; truncate structured messages by ratio.
- Topic-level compression: summarize middle messages into a single summary record.
- Bulk compression merges multiple records after `BULK_MERGE_COUNT` threshold.
- Summaries generated via utility model with system/message prompt templates.

**Rate limiting (Agent-Zero-derived)**
- Sliding window counter per key with cleanup based on timeframe.
- `wait(callback)` yields progress via callback and sleeps until limits clear.
- Supports multiple tracked counters (`tokens`, `requests`, etc.).

**Structured logging (Agent-Zero-derived)**
- Log items track `type`, `heading`, `content`, `kvps`, `temp`, `update_progress` with truncation limits.
- Secret masking applied recursively to heading/content/kvps before truncation.
- Dynamic truncation inserts `<< N Characters hidden >>` banner.
- Log updates tracked via `updates[]` for incremental UI polling.

**Notification system (Agent-Zero-derived)**
- Notification types: `info`, `success`, `warning`, `error`, `progress` with priority levels.
- `NotificationManager` enforces max size and compacts updates list.
- Notifications carry `group` for batch grouping and `display_time` for UI TTL.
- `mark_all_read()` and `clear_all()` reset counters and GUID.

**Memory consolidation (Agent-Zero-derived)**
- LLM-driven consolidation with actions: `MERGE`, `REPLACE`, `KEEP_SEPARATE`, `UPDATE`, `SKIP`.
- Uses similarity search to discover candidates; filters deleted docs by ID to avoid race conditions.
- Timeout guard for consolidation pipeline; falls back to direct insert on timeout/failure.
- Safety threshold for replace actions (`replace_similarity_threshold`).
- Metadata enriches new memory with timestamp if missing.

**Backup & restore patterns (Agent-Zero-derived)**
- Pathspec-based include/exclude patterns with explicit exclusions (defaults, embeddings cache).
- Metadata includes system info, environment info, author, version, and integrity checks.
- Pattern translation replaces stored root path with current root on restore.
- Explicit include patterns ensure hidden directories are traversed.

**Prompt truncation (LibreChat-derived)**
- `truncateText` appends `... [text truncated for brevity]` at max length.
- `smartTruncateText` keeps head/tail halves with ellipsis and notification.
- `truncateToolCallOutputs` culls tool outputs once token budget exceeds 50% threshold.

**OpenAI Assistant Swarm (OpenAI Assistant Swarm-derived)**
- `EnableSwarmAbilities()` attaches `swarm` manager under `client.beta.assistants`.
- Manager assistant is upserted by name; tools assembled from available assistants.
- `delegateWithPrompt()` creates thread, runs manager assistant, then delegates tool calls to child assistants.
- Tool calls parsed from parallel or single `delegate` function instructions.
- Parallel tool calls accept `multi_tool_use.parallel` with `tool_uses` payload shape.
- `compressToolCalls()` normalizes tool calls into `{ id, agentId, args }` list.
- `pollRun()` backs off with increasing interval and caps at 5 polls.
- `runMessage()` selects first assistant message in ascending order to avoid self-chat loops.
- `deDupeToolOutputs()` merges tool outputs by `tool_call_id` before submit.
- Swarm emits events: `parent_run_created`, `parent_assistant_complete`, `child_assistants_complete`.
- Child delegation uses last user message context and embeds metadata (`delegatedBy`, `originatingToolCallId`).
- Known assistant IDs are enforced to block hallucinated `agentId` delegation.

**Chatbot-UI sidebar UX (Chatbot-UI-derived)**
- Sidebar content type switches render per-entity lists (chats, presets, prompts, files, collections, assistants, tools, models).
- Search filter applies case-insensitive `name` substring matching.
- Create buttons open per-entity modal; chat uses `handleNewChat()`.
- Folder creation uses `createFolder` and updates state locally.
- Drag/drop items into folders; drop on empty area clears folder association.
- Date-bucket sorting for chats: Today, Yesterday, Previous Week, Older.
- Overflow detection adjusts width to reserve scrollbar space.

**Tool orchestration (LibreChat-derived)**
- `processRequiredActions()` loads tools for required actions, including toolkits and action sets.
- Tool loading via `loadTools()` with `processFileURL`, `uploadImageBuffer`, and `webSearch` options.
- Vision tool calls handled separately using `visionPromise` and usage accounting.
- Action tool OpenAPI specs validated via `validateAndParseOpenAPISpec` before `openapiToFunction`.
- OAuth action metadata decrypted before use; encrypted values preserved for reconnect.
- Tool outputs streamed to UI via `addContentData` and stored in `seenToolCalls`.
- Image generation tools return image content and replace tool output with UI-safe message.
- Tool calls mapped to content index using `mappedOrder` for deterministic UI ordering.
- Capability gating: `AgentCapabilities` controls `tools`, `file_search`, `execute_code`, `web_search`, `actions`.
- Web search hooks: `createOnSearchResults(res)` passed as tool callback for streaming results.
- Custom user vars: `getUserMCPAuthMap` resolved when config has per-user vars.
- Action tool mapping: `actionDelimiter + domain` identifies tool; domain allowlist enforced once per action set.
- Action tool build: `openapiToFunction(..., true)` yields `requestBuilders`, `functionSignatures`, `zodSchemas`.
- Dynamic tools: `DynamicStructuredTool` and MCP tools pass through; others wrapped with `toolFn`.

**Plugin auth storage (LibreChat-derived)**
- Plugin auth values encrypted at rest via `encrypt()`/`decrypt()`.
- `getUserPluginAuthValue()` supports optional `pluginKey` scoping.
- `updateUserPluginAuth()` upserts encrypted values.
- `deleteUserPluginAuth()` supports delete single or all for plugin/user.

**File browser service (Agent-Zero-derived)**
- Base directory pinned to `/` with path resolution guard to prevent traversal.
- Listing uses `ls -la` parsing for better error handling than `os.scandir`.
- Symlink detection: permission string starts with `l`, captures `symlink_target`.
- Entry payload includes `name`, `path`, `modified`, `size`, `type`, `is_dir`.
- Parent path computed if not at root; empty string when at root.
- Hard cap of 10,000 entries per listing to avoid runaway output.
- File upload supports base64 and multipart; `secure_filename` used for disk writes.
- Upload size capped at 100 MB; invalid paths rejected via base dir guard.
- Delete supports files or directories with recursive removal.

**Alerts popover (Chatbot-UI-derived)**
- Bell icon with red count indicator for pending alerts.
- Popover content anchored to sidebar icon size.

**Message rendering (Chatbot-UI-derived)**
- Message header shows assistant avatar (image or model icon) and user avatar fallback.
- Inline message actions appear on hover or last message (copy, edit, regenerate).
- Copy action swaps icon to checkmark for 2 seconds.
- Edit mode uses textarea with cursor at end; Cmd+Enter submits.
- Regenerate uses prior user message when content empty.
- Tool-in-use status line shows `Searching files…` for retrieval, generic for other tools.
- Source toggle summarizes file count and expands to show file item previews.
- Image previews open modal via `FilePreview` on click.

**Markdown rendering (Chatbot-UI-derived)**
- Uses `remark-gfm` and `remark-math` plugins for tables and math.
- Streaming cursor `▍` rendered as pulsing span.
- Inline code vs code block detection by newline presence.
- Code blocks delegated to `MessageCodeBlock` with language extraction.

**Code block UX (Chatbot-UI-derived)**
- Syntax highlighting via Prism `oneDark` theme.
- Copy button with checkmark timeout; download button prompts filename.
- Suggested filenames derived from language → extension map.
- Random suffix excludes ambiguous characters (no I/O/1/0/Z/2).

**Toast state (LibreChat-derived)**
- Recoil atom `toastState` with `{ open, message, severity, showIcon }`.

**API key dialog (LibreChat-derived)**
- Endpoint-specific config forms with provider-specific fields.
- Expiration presets (30m → never) stored as timestamp or null.
- Client-side validation ensures required fields; reports via toast severity.
- Revoke key flow uses confirmation dialog and mutation hooks.

**Message replies drawer (Chatbot-UI-derived)**
- Replies panel uses `Sheet` with tooltip trigger and notification badge.
- Badge count displayed as small red indicator on message icon.

**Markdown memoization (Chatbot-UI-derived)**
- `ReactMarkdown` memoized on `children` + `className` to avoid re-render churn.

**Chat history navigation (Chatbot-UI-derived)**
- Arrow-up/down cycling through prior user messages.
- Skips assistant messages; updates input and internal index.
- Index resets if messages are deleted or generation completes.

**Auto-scroll behavior (Chatbot-UI-derived)**
- Tracks `isAtTop`, `isAtBottom`, `userScrolled`, and `isOverflowing`.
- Auto-scrolls while generating unless user manually scrolled.
- Uses `scrollIntoView({ behavior: 'instant' })` on top/bottom refs.

**Prompt + command parsing (Chatbot-UI-derived)**
- Inline command parsing: `@` assistant, `/` prompt, `#` files/collections, `!` tool.
- Picker modals open based on regex match of trailing token.
- Selecting assistant updates model/settings and loads assistant files + tools.
- Collection selection appends collection files to retrieval list.
- Tool selection appends to selected tools and clears command token.

**Preset management (LibreChat-derived)**
- Default preset auto-loaded on first visit; refetch if user mismatch.
- Preset selection triggers toast and conversation switch logic.
- Export uses `filenamify` + `export-from-json`.
- Import cleans preset and creates via mutation; errors toast.
- Delete confirms user and updates query cache optimistically.

**Chat persistence (Agent-Zero-derived)**
- Chats stored under `tmp/chats/{contextId}/chat.json` with log snapshot and agent history.
- Background contexts are not persisted.
- Chat export/import uses JSON serialization; IDs regenerated on import.
- Backward compatibility migrates legacy `*.json` into folder layout.
- Message attachments stored under `tmp/chats/{contextId}/messages`.

**Token counting + trimming (Agent-Zero-derived)**
- Uses `tiktoken` to count tokens; `approximate_tokens` adds 10% buffer.
- `trim_to_tokens` cuts by ratio with ellipsis on start/end.
- `truncate_dict_by_ratio` shrinks structured payloads with placeholder injected.

**Runtime + RFC bridge (Agent-Zero-derived)**
- Development calls can be routed via RFC to remote module based on file path.
- `call_development_function_sync` wraps async call with 30s timeout.
- Runtime IDs: per-session `runtime_id` and persistent `A0_PERSISTENT_RUNTIME_ID`.
- CLI args parsed from unknown `--key=value` pairs for dynamic config.

**Bookmarks UX (LibreChat-derived)**
- Bookmark edit dialog uses mutation hooks and optimistic tag list update.
- On success, focuses new tag element after short timeout.
- Drag-and-drop reordering uses `react-dnd`; drop persists new `position`.
- Bookmark table rows show count and edit/delete actions.
- Bookmark table removes duplicates by `_id` and sorts by `position`.
- Pagination with page size 10 and accessible labels.
- Search filter matches lowercase tag substring.
- Empty state row shows localized “no bookmarks” message.
- Bookmark form validates unique tags against cache and current list.
- Form supports `addToConversation` checkbox for tagging current convo.

**Settings schema + UI (Agent-Zero-derived)**
- Settings typed schema includes model providers, rate limits, memory flags, MCP, RFC, and TTS/STT.
- `convert_out()` builds UI sections/fields with labels, descriptions, ranges, and options.
- Provider lists sourced from `get_providers()` and rendered as select options.
- Password and API key placeholders mask stored values in UI.

**Dotenv persistence (Agent-Zero-derived)**
- `save_dotenv_value(key, value)` updates or appends in `.env`.
- `load_dotenv()` called after write to refresh process env.

**Attachment manager (Agent-Zero-derived)**
- Validates allowed extensions and MIME types (image/text/application).
- Saves using `secure_filename` and returns metadata (`type`, `extension`, `preview`).
- Generates JPEG previews for images with size cap and quality optimization.

**Ollama + Open WebUI deploy (OpenWebUI/Fly-derived)**
- One-command deploy via `fly launch --from` template.
- GPU-first deployment defaults to Nvidia L40s; CPU fallback allowed with reduced performance.
- Scale-to-zero default; cold start ~3s boot and ~15s UI readiness.
- `ENABLE_SIGNUP=false` to disable new registrations for private deployments.

**Preset save-as dialog (LibreChat-derived)**
- Inline rename prompt with enter-to-submit.
- Uses `cleanupPreset` before create mutation.
- Toast on success/error; auto-close on success.

**Bookmark delete dialog (LibreChat-derived)**
- Tooltip anchor wraps delete button.
- Confirm dialog with red destructive action.
- Success/error toasts on mutation result.

**ChatGPT-UI streaming patterns (ChatGPT-UI-derived)**
- `fetchEventSource` from `@microsoft/fetch-event-source` for SSE consumption.
- Message queue with typewriter effect: `processMessageQueue` pops chunks and appends with configurable delay.
- Abort controller: `ctrl.abort()` cancels in-flight fetch; `fetchingResponse` ref tracks state.
- Event types: `error` (show snackbar), `userMessageId` (set ID), `done` (finalize + gen title).
- Title generation: `genTitle(conversationId)` calls `/api/gen_title/` after first exchange.
- Web search toggle: `enableWebSearch` ref; tool args injected into message payload.
- Message actions: `deleteMessage(index)`, `toggleMessage(index)` for disable/enable.
- Scroll behavior: `scrollChatWindow()` via `scrollIntoView({ behavior: 'smooth' })` on grab ref.

**Chatbot-UI prompt and retrieval patterns (Chatbot-UI-derived)**
- `buildFinalMessages` constructs system prompt with profile context, workspace instructions, assistant persona.
- Token budget: `CHUNK_SIZE - PROMPT_TOKENS` leaves remaining tokens for message history.
- Message truncation: iterate from newest; include messages until token budget exhausted.
- Retrieval injection: `buildRetrievalText(fileItems)` appends RAG context to preceding user message.
- Image handling: `image_paths` converted to base64 `image_url` content blocks.
- Abort controller: `abortController.abort()` cancels in-flight fetch; ref tracks `isGenerating` state.
- Tool mode: if `selectedTools.length > 0`, post to `/api/chat/tools` endpoint.
- Local vs hosted: `handleLocalChat` (Ollama) vs `handleHostedChat` (OpenAI-compatible).
- Edit handling: `deleteMessagesIncludingAndAfter` truncates history; re-send from edit point.

**Stream consumption patterns (Chatbot-UI-derived)**
- `consumeReadableStream(stream, callback, signal)` reads chunks via `reader.read()`.
- Decoder: `new TextDecoder()` with `{ stream: true }` for incremental decoding.
- Abort listener: `signal.addEventListener('abort', () => reader.cancel())`.
- Lock release: `reader.releaseLock()` in finally block.
