<!--
Why: Capture the agent platform, tool registry, and implementation roadmap for the core platform.
What: System additions, agent loop, tooling details, and phased deliverables.
How: Preserve canonical agent/tool content and phase plan in one platform-focused file.
Status: active
Last Updated: 2026-02-02
-->

# Agent Platform & Tools

## 19) Perfected Architecture: System Additions

### Computer Environment System
- Bootstrap wizard builds `computers.catalog.json` and `computers.seed.sh`.
- Environment catalog includes SeedCore, TinyCore, Debian Slim, Kali, Alpine, Arch, and custom builds.
- `select_computer` tool switches environments with state serialization and resource caps.
- Persistence modes: ephemeral, cached, named; disaster recovery restores from seed artifacts.

### Agent System
- BaseAgent loop: Guard → Reason → Tool → Append → Decide with extension hooks.
- Hierarchical delegation: coordinator → planner → specialists → reporter.
- Multi-model execution for comparison, consensus, and routing.
- Strategies: compare | consensus | best | route, with thresholds for agreement and minimum responding models.
- Configuration lives in `app/config/multi-model.json` with per-profile model lists, weights, and routing maps.
- UI integration includes comparison and consensus panels with token/latency telemetry per model.
- Interventions allow pause/redirect without losing context.
- Profile management surfaces:
	- CLI: `pnpm exec bitcore agents profile list|show|set`.
	- MCP: `agent_profiles.list` exposes the catalog to external controllers.

## 19.1) Agent Loop & Profile Details (Operational)

**Monologue cycle**
1) Guard: validate input, load context, check interventions.
2) Reason: LLM generates plan + tool calls.
3) Execute: invoke tools; capture results.
4) Append: write results to history/memory.
5) Decide: continue, respond, or delegate.

**Interventions**
- User can pause/redirect; agent resumes with intervention injected into history.

**Profiles**
- Coordinator, router, deep_researcher, site_builder, validator, sentinel with tool allowances.
- Profiles are hot-swappable mid-mission; GUI exposes selector + editor.

**Multi-model execution (configuration)**
- Config: `app/config/multi-model.json` with `strategy`, `models`, and `thresholds`.
- Strategies: `compare`, `consensus`, `best`, `route` with minimum responders and agreement thresholds.

**UI surfaces**
- Comparison panel lists per-model reasoning, tool calls, token usage, and latency.
- Consensus panel highlights majority tool calls and dissenting outputs.

**Profile prompt samples**
- `coordinator`: plan first, delegate when subtask exceeds three atomic steps.
- `router`: triage and route; never solve tasks directly.
- `deep_researcher`: cross-validate sources, return citations and structured data.
- `site_builder`: generate static site assets and run build checks.
- `validator`: re-run critical commands, diff outputs, and enforce policies.
- `sentinel`: monitor anomalies, quarantine risky environments, and pause agents.

**Profile prompt samples (full excerpts)**

`coordinator.prompt.md`
```markdown
You orchestrate missions. Translate goals into phases, assign specialists, enforce deadlines, and consolidate results.

Guidelines:
- Build a plan before executing.
- Delegate when a sub-task exceeds three atomic steps.
- Use profiles: planner, deep_researcher, site_builder, validator, sentinel.
- Track dependencies between sub-tasks and reorder when blockers appear.
- Produce structured status updates every iteration.
```

`router.prompt.md`
```markdown
You triage messages and route them to the correct specialist. You never solve tasks directly.

Guidelines:
- Inspect intent, required tools, and risk.
- Choose a target profile and emit a routing directive.
- If uncertain, escalate to coordinator with clarifying questions.
- Maintain a queue of pending actions and surface conflicts early.
```

`deep_researcher.prompt.md`
```markdown
You perform exhaustive research with citations and freshness checks.

Guidelines:
- Use search_engine, memo_capture, and web_reader tools.
- Cross-validate claims across at least two independent sources.
- Flag outdated or conflicting data.
- Summaries include citations formatted as [source-id](url).
- Hand back structured datasets (tables, JSON) when appropriate.
```

`site_builder.prompt.md`
```markdown
You turn research outputs into publishable static sites.

Guidelines:
- Use file_browser and code_execution (jekyll session) tools.
- Generate layouts, SCSS, and Markdown content in `/projects/<mission>/site`.
- Run `bundle exec jekyll build` and attach the build log.
- Ask coordinator for design/theme directives when unspecified.
```

`validator.prompt.md`
```markdown
You verify artefacts for correctness, safety, and policy compliance.

Guidelines:
- Re-run critical commands in isolated sessions.
- Use diff and checksum tools to detect unexpected changes.
- Run policy_lint to enforce guardrails.
- Escalate to sentinel if you detect risk; otherwise approve or reject with reasons.
```

`sentinel.prompt.md`
```markdown
You guard the system. Monitor for anomalies, sandbox breaches, and malicious patterns.

Guidelines:
- Subscribe to audit events from mission_event.bus.
- Inspect environment selections and tool invocations.
- Trigger environment quarantine via select_computer when risk is high.
- You can pause agents by emitting an intervention.
```

### Tools & Capabilities (Core Contract)
- `code_execution` (multi-session shells), `search_engine`, `memory_save/load/forget/delete`, `delegate_to_subordinate`.
- `file_browser`, `select_computer`, `scheduler_list|show|run|wait|create|delete`, `secret_get/set`.
- `mcp_request` + `mcp_tool` (server.tool namespace), `plugin_execute`, `memo_capture`, `policy_lint`, `ollama_chat`, `theme_switch`.
- `behaviour_update` for scoped behavior adjustments with auditability and rollback.
- CLI, GUI, and MCP invoke the same endpoints and emit structured telemetry.

**Tool Schema Conventions (Required)**
- Each tool defines: `name`, `description`, `parameters`, `returns`.
- Parameters must be JSON-serializable and validated at the boundary.
- Returns must be structured objects (no plain-text only outputs).

**Core Tool Schemas (Excerpt)**
- `code_execution`: `{ runtime, code, session, timeout, files? }` → `{ stdout, stderr, exitCode, artifacts[] }` (runtime: `bash|nodejs|deno|bun|python|ruby|lua`, sessions 0–9).
- `search_engine`: `{ query, count, freshness }` → `{ results: [{ title, url, snippet, published }] }` (`freshness`: `pd|pw|pm`).
- `memory_save`: `{ text, area, tags[] }` → `{ memoryId }` (`area`: `main|solutions|instruments|fragments`).
- `memory_load`: `{ query, area, count, threshold?, filter? }` → `{ memories: [{ id, text, similarity, tags }] }`.
- `memory_forget`: `{ query, threshold?, filter? }` → `{ deletedIds[] }`.
- `memory_delete`: `{ ids[] }` → `{ deletedIds[] }`.
- `delegate_to_subordinate`: `{ task, profile, reset }` → `{ result }`.
- `file_browser`: `{ action, path, content?, query? }` → `{ files[] | content }` (`action`: `list|read|write|delete|mkdir|search|preview`).
- `select_computer`: `{ environment, dockerfile?, extras?, persist?, reason }` → `{ containerId, environment, extras[] }`.
- `scheduler_create_task`: `{ type, name, task, schedule, context? }` → `{ taskId, nextRun }`.
- `scheduler_list|show|run|wait|delete`: `{ filters? }` → `{ tasks[] | task }`.
- `secret_get`: `{ key }` → `{ exists }` (value injected at runtime).
- `secret_set`: `{ key, value }` → `{ success }`.
- `mcp_request`: `{ server, tool, args, timeout }` → `{ response, latencyMs }`.
- `plugin_execute`: `{ plugin, action, payload, sandbox }` → `{ result, logs[] }`.
- `memo_capture`: `{ channel, content, tags[] }` → `{ memoId }`.
- `policy_lint`: `{ path, pack }` → `{ passed, issues[] }`.
- `ollama_chat`: `{ model, prompt, format, options? }` → `{ output, tokens }`.
- `theme_switch`: `{ surface, theme }` → `{ applied }`.
- `behaviour_update`: `{ adjustment, scope, type }` → `{ applied, message, previous_state }` (scope: `current_task|session|permanent`, type: `focus|tool_preference|communication_style|error_handling`).

**Custom Tool Creation (Template)**
- Location: `app/tools/custom/*.tool.mjs`.
- Must export `toolDefinition` and `execute(agent, args)`.
- Register in `app/config/tools.json` (or hot-reload registry when enabled).

## 19.2) Tooling Details (Expanded Signals)

**Core tool surface (complete list)**
- `code_execution`, `search_engine`, `memory_save`, `memory_load`, `delegate_to_subordinate`, `file_browser`, `select_computer`, `scheduler_create_task`, `secret_get`, `secret_set`, `mcp_request`, `plugin_execute`, `memo_capture`, `policy_lint`, `ollama_chat`, `theme_switch`, `behaviour_update`.

**Scheduler modes**
- `scheduled`, `adhoc`, `planned` with state machine `idle → running → disabled|error`.
- `planned` tasks track `todo → in_progress → done` launch times to preserve intent history.
- `schedule` accepts cron expressions; planned uses explicit UTC datetimes.
- Tasks can run in dedicated contexts for clean, isolated transcripts.

**Secrets handling**
- Encrypted at rest; injected at runtime; never written to LLM logs.
- Streaming redaction masks partial secret prefixes and full values inline.

**Tool payload examples**
- `code_execution`: `{ runtime, code, session, timeout, files? }` → `{ stdout, stderr, exitCode, artifacts[] }`.
- `search_engine`: `{ query, count, freshness }` → `{ results: [{ title, url, snippet, published }] }`.
- `memory_save`: `{ text, area, tags[] }` → `{ memoryId }`.
- `memory_load`: `{ query, area, count, threshold?, filter? }` → `{ memories: [{ id, text, similarity, tags }] }`.
- `memory_forget`: `{ query, threshold?, filter? }` → `{ deletedIds[] }`.
- `file_browser`: `{ action, path, content?, query? }` → `{ files[] | content }`.

**Execution + delegation patterns (vendor-derived)**
- `code_execution` keeps per-session shells (local or SSH) with reset-by-session, prompt detection, dialog detection, and max runtime caps.
- `delegate_to_subordinate` reuses a subordinate agent unless reset; supports profile override per delegation.
- `behaviour_update` merges adjustments via a utility model and persists a rules file per agent scope.
- MCP tools are called via `server.tool` names, with cached tool lists and per-call sessions.
- LibreChat MCP: `createMCPTool` wraps tool in LangChain `tool` with Zod schema; OAuth reconnect via `FlowStateManager` and `MCPOAuthHandler`.
- `reconnectServer` reinitializes MCP server and emits `ON_RUN_STEP_DELTA` with auth URL on OAuth challenge.

**behaviour_update implementation**
- Handler: `app/tools/introspection/behaviour-update.tool.mjs`.
- State store: `app/agents/behavior-state.mjs`.
- GUI displays current task/session/permanent adjustments with rollback actions.

## 19.3) Extensibility & Capability Routing (Derived)

**Extension points (agent lifecycle)**
- `agent_init`, `before_main_llm_call`, `message_loop_start|end`, `monologue_start|end`, `reasoning_stream`, `response_stream`, `system_prompt`.
- Agent-specific overrides merge on filename; default extensions remain intact.

**Instruments (token-free procedures)**
- Long-lived, callable procedures stored outside prompt tokens.
- Discovery via registry + usage telemetry.

**Capability routing (swarm pattern)**
- Assistant registry with skill tags, cost/latency profiles, and quality scores.
- Task splitter → parallel executors → result aggregator with conflict resolution.
- Retry + fallback to alternate assistants on failure.

**Swarm manager orchestration (OpenAI-Swarm-derived)**
- `SwarmManager` class: `findOrUpsertManager` auto-creates manager assistant with `delegate` tool; `delegateWithPrompt` creates thread, runs manager, settles children.
- `delegateTaskToChildren`: if primary run `requires_action`, compresses tool calls, spawns `SwarmAssistant.runDelegatedTask` per child via `Promise.all`, dedupes outputs, submits all tool outputs back.
- Child threads carry metadata: `delegatedBy`, `viaFunc`, `toAssistant`, `originatingToolCallId` for traceability.
- Event emitter broadcasts `poll_event`, `parent_assistant_complete`, `child_assistants_complete` for real-time UI updates.
- `toolsFromAssistants` generates a single `delegate` function schema enumerating known assistant IDs + `<none>` fallback.
- `messageHistoryForThread` paginates thread messages for context injection into child runs.
- Playground links generated via `playgroundLink(run)` for debugging delegated threads.

**Research team orchestration (Deerflow-derived)**
- `research_team_node` dispatches to `researcher` or `coder` based on step type (`RESEARCH` vs `PROCESSING`).
- `_execute_agent_step` finds first unexecuted step, builds input with completed-steps context, invokes agent with recursion limit, appends observation.
- `researcher_node` uses web search + crawl tools; `coder_node` uses Python REPL.
- MCP servers can inject additional tools per agent type via `mcp_settings`.

**Reporter synthesis (Deerflow-derived)**
- Reporter loads plan title, observations, and optional format hints.
- Context compression via `ContextManager` before invoke.
- Final report includes key points, overview, detailed analysis, and key citations in link-reference format.

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

## 19.4) Connectivity Surface (Derived)

**External APIs**
- Message API with attachments and context IDs.
- Log retrieval and chat reset/terminate endpoints.

**MCP + A2A**
- MCP server endpoints (SSE + streamable HTTP).
- A2A endpoint for agent-to-agent coordination.

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

## 20) Perfected Architecture Roadmap (Agent Platform)

**Phase 0: Foundation** — BaseAgent, AgentContext, tool registry + hot-reload, tests.
**Phase 1: Computer Environments** — environment manager, select-computer tool, catalog images.
**Phase 2: File Browser** — multi-panel TUI, zoxide, preview, file_browser tool.
**Phase 3: Hierarchical Agents** — delegation logic, profiles, coordinator flow.
**Phase 4: Extensions** — token/telemetry/security hooks.
**Phase 5: Memory System** — FAISS, consolidation, ontology sync.
**Phase 6: UI Skins** — Win95, Modern, TUI, theme switcher.
**Phase 7: Scheduler & Secrets** — task scheduler, encrypted secrets.
**Phase 8: Polish & Docs** — README, API docs, user guides, walkthroughs.

## 36) Implementation Roadmap (Phase Deliverables + Tests)

**Phase 0: Foundation**
- Deliverables: `app/agents/base-agent.mjs`, `app/agents/profiles/*.prompt.md`, `app/tools/core/*.tool.mjs`, `app/config/tools.json`.
- Tests: `tests/base-agent.test.mjs`, `tests/tool-registry.test.mjs`.

**Phase 1: Computer Environments**
- Deliverables: `app/infrastructure/docker/environment-manager.service.mjs`, `app/tools/core/select-computer.tool.mjs`, `docker/environments/{kali,tinycore}.dockerfile`.
- Tests: `tests/environment-manager.test.mjs`, `tests/select-computer.test.mjs`.

**Phase 2: File Browser (TUI)**
- Deliverables: `app/features/file-browser/*`, `app/public/components/file-browser/FilePanel.jsx`.
- Tests: `tests/file-browser.test.mjs`, `tests/zoxide.test.mjs`.

**Phase 3: Hierarchical Agents**
- Deliverables: `app/agents/hierarchy.mjs`, profile prompts for researcher/coder/coordinator.
- Tests: `tests/agent-hierarchy.test.mjs`, `tests/delegation.test.mjs`.

**Phase 4: Extensions & Middleware**
- Deliverables: extension hooks, `app/extensions/*`, `app/config/extensions.json`.
- Tests: `tests/extensions.test.mjs`.

**Phase 5: Memory System**
- Deliverables: FAISS service, memory save/load tools, consolidation service.
- Tests: `tests/faiss.test.mjs`, `tests/memory-consolidation.test.mjs`.

**Phase 6: UI Skins**
- Deliverables: `app/public/themes/{win95,modern}.css`, UI skin components, `app/commands/tui.cli.mjs`.
- Tests: `tests/theme-switcher.test.mjs` + visual regression.

**Phase 7: Scheduler & Secrets**
- Deliverables: task scheduler service, secret store, tool bindings.
- Tests: `tests/scheduler.test.mjs`, `tests/secrets.test.mjs`.

**Phase 8: Polish & Docs**
- Deliverables: README, API docs, user/dev guides, walkthrough.
