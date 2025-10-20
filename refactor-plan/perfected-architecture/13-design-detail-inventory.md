<!--
Why: Technical patterns for multi-agent systems, workflow execution, interfaces, and infrastructure.
What: Core implementation guidance extracted from research and validated designs.
How: Organized by system layer with concrete behaviors, data flows, and API contracts.
-->

# Technical Implementation Patterns

## Agent Orchestration

### Hierarchical Delegation
Root agent delegates to specialized subagents. Each maintains isolated context: history, tool access, data store. Subagents report results upstream. Parent approves, revises, or redirects.

**Execution Loop**
```
1. Guard: validate input, load context, check authorization
2. Reason: LLM generates plan with tool calls
3. Execute: invoke tools, capture results
4. Append: merge results into context
5. Decide: continue loop or return to parent
```

Extension hooks fire before/after reasoning and tool execution for telemetry, logging, intervention.

### Role Profiles
Roles defined as prompt profiles: planner, researcher, coder, reporter, validator, sentinel, router. Each profile specifies system prompt, allowed tools, behavioral constraints. Swap profiles mid-execution without restarting agent.

### Tool Registry
Core tools: code execution (multi-session shells), search providers, memory operations, file system access, scheduler, secrets vault, plugin runner, MCP bridge, RAG retrieval.

Agents register custom tools ("instruments") with JSON schema describing name, description, parameters, return type. Registry indexes by capability tags for discovery.

### Secrets Management
Encrypted storage scoped per agent or profile. Secrets injected into tool execution context, never exposed in LLM messages or logs. CLI: `secrets set <key>`, `secrets list`, `secrets delete <key>`.

### Task Scheduler
**Supported Modes**
- Cron: recurring with schedule expression
- Planned: one-shot at specific datetime  
- Immediate: run now with optional wait

**State Machine**: `pending` → `running` → `completed` | `failed` | `cancelled`

Records persist across restarts. Include context snapshot to restore conversation state when task resumes.

### Context Window Management
**Strategies**
- Sliding window: drop oldest messages beyond token limit
- Summarization: LLM condenses old history into brief context
- Pinning: mark critical tool outputs as non-evictable

Applied automatically when approaching model token ceiling.

### Memory Operations
**Capture**: optional auto-save after each interaction  
**Consolidation**: AI merges similar entries, preserves metadata  
**Tagging**: type, mission, timestamp, source URL  
**Pruning**: relevance scoring with configurable retention policy  

Dashboard exposes merge/split/delete controls.

### Inter-Agent Protocol
HTTP/JSON message passing. Agents expose REST endpoints accepting task description, returning streamed results. Authentication via bearer token. Discovery via registry service advertising agent capabilities and base URLs.

MCP server mode exposes internal tools as Model Context Protocol endpoints for external consumption.

### Observability
Structured logs: `{ level, module, correlationId, timestamp, ...context }`  
Live terminal: stream agent reasoning with pause/intervention controls  
Session transcripts: HTML snapshots saved per run  
Token telemetry: usage per stage with model/provider metadata

# Design Detail Inventory

## 1. Multi-Agent Research Engines
- **Hierarchical orchestration loop**: Root agent (Agent 0) delegates to specialised subagents, each keeping isolated history, tool registry, and data store. Subagents report upstream; upstream agents decide to approve, revise, or redelegate.
- **Monologue execution cycle**: Each agent iterations follow Guard → Reason → Tool Invocation → Result Append → Decide Next Step, with extension hooks around reasoning and tool execution for logging, telemetry, and interventions.
- **Prompt-driven role swaps**: Roles such as planner, researcher, coder, reporter, validator, sentinel, router are implemented as prompt profiles that supply different system prompts, allowed tools, and behavioural guardrails. Profiles are hot-swappable mid-mission.
- **Dynamic toolset**: Baseline tools cover code execution (multi-session shells), search, memory, file browse, scheduler, behaviour adjustment, plugin execution, MCP bridge, RAG retrieval, and browser automation. Agents can register custom tools (“instruments”) with metadata and JSON args for discovery.
- **Secrets & credentials**: Secrets stored in encrypted registries scoped per agent or profile; injected into tools at runtime without exposing raw values to the LLM transcript. CLI commands exist to set/list/delete secrets.
- **Scheduler**: Supports cron-style recurring tasks, one-shot planned tasks, and immediate execution with wait semantics. Task records persist across restarts with state (`pending`, `running`, `completed`, `failed`, `cancelled`).
- **Context management**: Conversation histories trimmed via sliding windows plus summarisation when token pressure rises. Important tool outputs can be pinned to avoid truncation.
- **Memory lifecycle**: Automatic memory capture options, AI-assisted consolidation for duplicate or overlapping entries, metadata tagging (type, mission, timestamp, source), and dashboards to prune or merge entries.
- **Remote collaboration hooks**: A2A (agent-to-agent) protocol over HTTP/JSON; agents can expose themselves as remote services and call peers. MCP server/client implementations turn internal tools into Model Context Protocol endpoints.
- **Runtime observability**: Structured logs with module + correlation IDs, live streaming terminal with intervention controls, HTML session transcripts saved per run, token usage emitted per stage.


## Research Workflow Pipeline

### State Machine Architecture (LangGraph.js)
**Implementation**: LangGraph.js state graph with conditional edges and checkpoints  
**Nodes**: Coordinator → Planner → Execution Team → Reporter  
**Flow**: User goal → plan generation → clarification loop → parallel execution → synthesis

**Coordinator**: Entry point, manages lifecycle, delegates to planner  
**Planner**: Expands goal into structured plan with section breakdown, decides research depth/breadth  
**Execution Team**: Parallel agents (researcher, coder, analyst, validator) each owning subtasks  
**Reporter**: Aggregates outputs, generates final document

**LangGraph.js Integration:**
```javascript
import { StateGraph, END } from "@langchain/langgraph";

const workflow = new StateGraph({
  channels: {
    goal: { value: null },
    plan: { value: null },
    results: { value: [] },
    report: { value: null }
  }
});

workflow.addNode("coordinator", coordinatorNode);
workflow.addNode("planner", plannerNode);
workflow.addNode("clarification", clarificationNode);
workflow.addNode("execution", executionTeamNode);
workflow.addNode("reporter", reporterNode);

workflow.addEdge("coordinator", "planner");
workflow.addConditionalEdges("planner", shouldClarify, {
  clarify: "clarification",
  execute: "execution"
});
workflow.addEdge("clarification", "planner");
workflow.addEdge("execution", "reporter");
workflow.addEdge("reporter", END);

workflow.setEntryPoint("coordinator");

const app = workflow.compile({
  checkpointer: new MemorySaver() // Persist state across interruptions
});
```

### Clarification Loop
Triggered when planner confidence below threshold or plan ambiguous. Multi-turn dialogue extracts specifics before execution starts. User can approve/modify plan or provide additional context. LangGraph.js handles interruption and resumption seamlessly.

---

## Testing Strategy & Performance Budgets

### Integration Test Patterns

**Mission Lifecycle Test:**
```javascript
describe('Mission Execution', () => {
  it('should create mission from workflow and track completion', async () => {
    // Arrange
    const workflow = {
      workflowId: 'wf-test-123',
      name: 'Research Pipeline',
      steps: [{ action: 'research', params: { query: 'LangChain' } }]
    };
    
    // Act
    const mission = await createMissionFromWorkflow(workflow);
    await executeMission(mission.id);
    
    // Assert
    const completed = await getMission(mission.id);
    expect(completed.status).toBe('completed');
    expect(completed.telemetry.totalQueries).toBeGreaterThan(0);
  });
});
```

**Sync Event Test:**
```javascript
describe('Event Sync', () => {
  it('should broadcast mission events to all subscribers', async () => {
    // Arrange
    const context = new AgentContext({ userId: 'test' });
    const subscriber1 = new EventSubscriber();
    const subscriber2 = new EventSubscriber();
    context.subscribe(subscriber1);
    context.subscribe(subscriber2);
    
    // Act
    context.emit('mission:started', { missionId: 'mission-abc' });
    await waitForEvent();
    
    // Assert
    expect(subscriber1.lastEvent.type).toBe('mission:started');
    expect(subscriber2.lastEvent.type).toBe('mission:started');
  });
});
```

**Conflict Resolution Test:**
```javascript
describe('Conflict Resolution', () => {
  it('should resolve with last-write-wins strategy', async () => {
    // Arrange
    const mission = await createMission({ title: 'Original' });
    
    // Act: Concurrent updates with different timestamps
    await Promise.all([
      updateMission(mission.id, { title: 'Update A' }, Date.now() + 100),
      updateMission(mission.id, { title: 'Update B' }, Date.now())
    ]);
    
    // Assert: Later timestamp wins
    const final = await getMission(mission.id);
    expect(final.title).toBe('Update A');
  });
});
```

### Performance Budgets

**LLM Operations:**
- Soft timeout: 2s for planning/simple queries
- Hard timeout: 5s for complex research/code generation
- Exponential backoff on retries (max 3 attempts)

**Memory Constraints:**
- <50 MB per workflow execution
- <200 MB total for concurrent workflows
- FAISS index consolidation at 1 GB threshold

**Event System:**
- Event throughput: 1000 events/sec sustained
- Sync latency: <100ms from emit → subscriber render
- Memory overhead: <50MB for AgentContext + queues

**Graph Operations:**
- Export 10,000-node graph in <2s
- Incremental graph updates in <50ms
- Memory footprint: <10 MB per active graph

**Execution:**
- O(n) complexity in workflow nodes
- Abort signal propagation in <10ms
- Prefer streaming over buffering for large payloads

---

## WebSocket Protocol Specification

**CRITICAL REQUIREMENT:** All WebSocket messages MUST be **machine-readable structured data** (JSON), never human-readable text only. This ensures programmatic clients (CLIs, automation scripts, external integrators) can parse and process messages reliably.

### Message Format

**All messages follow this schema:**
```typescript
interface WebSocketMessage {
  type: string;              // Message type (command, event, response, error)
  id?: string;               // Correlation ID for request-response pairing
  timestamp: number;         // Unix timestamp in milliseconds
  data: object;              // Structured payload (never plain string)
  metadata?: {               // Optional context
    agentId?: string;
    sessionId?: string;
    correlationId?: string;
  };
}
```

### Message Types

#### 1. Command Messages (Client → Server)
```json
{
  "type": "command",
  "id": "cmd_123",
  "timestamp": 1729267200000,
  "data": {
    "command": "research",
    "args": {
      "query": "quantum computing",
      "depth": 3,
      "breadth": 5
    }
  },
  "metadata": {
    "sessionId": "sess_abc"
  }
}
```

#### 2. Event Messages (Server → Client - Progress Updates)
```json
{
  "type": "event",
  "id": "evt_456",
  "timestamp": 1729267205000,
  "data": {
    "event": "agent:reasoning",
    "agentId": "agent_0",
    "phase": "planning",
    "content": {
      "reasoning": "I need to break down the query into subtopics...",
      "toolCalls": [
        {
          "tool": "search_engine",
          "args": { "query": "quantum algorithms" }
        }
      ]
    }
  },
  "metadata": {
    "correlationId": "cmd_123",
    "agentNumber": 0
  }
}
```

#### 3. Response Messages (Server → Client - Command Results)
```json
{
  "type": "response",
  "id": "resp_789",
  "timestamp": 1729267300000,
  "data": {
    "status": "completed",
    "result": {
      "summary": "Quantum computing research complete",
      "outputPath": "/data/research/quantum_computing_2025-10-18.md",
      "memoryIds": ["mem_001", "mem_002"],
      "tokenUsage": {
        "prompt": 2500,
        "completion": 1500,
        "total": 4000
      }
    }
  },
  "metadata": {
    "correlationId": "cmd_123",
    "duration": 95000
  }
}
```

#### 4. Error Messages
```json
{
  "type": "error",
  "id": "err_012",
  "timestamp": 1729267210000,
  "data": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 10,
      "window": "1m",
      "retryAfter": 45
    }
  },
  "metadata": {
    "correlationId": "cmd_123"
  }
}
```

#### 5. Stream Messages (Incremental Output)
```json
{
  "type": "stream",
  "id": "stream_345",
  "timestamp": 1729267208000,
  "data": {
    "streamType": "stdout",
    "chunk": "Searching for quantum algorithms...\n",
    "sequence": 12,
    "isComplete": false
  },
  "metadata": {
    "correlationId": "cmd_123",
    "source": "code_execution"
  }
}
```

### Anti-Pattern: Human-Readable Text Only ❌

**NEVER send unstructured text:**
```json
// ❌ BAD - Cannot be parsed programmatically
{
  "message": "Agent 0 is thinking about quantum computing and will search next..."
}

// ✅ GOOD - Machine-readable with optional human display
{
  "type": "event",
  "timestamp": 1729267200000,
  "data": {
    "event": "agent:status",
    "agentId": "agent_0",
    "status": "reasoning",
    "topic": "quantum computing",
    "nextAction": "search",
    "displayText": "Agent 0 is thinking about quantum computing and will search next..."
  }
}
```

### Event Schema Registry

**Standard Events:**
```typescript
// Agent lifecycle
"agent:started"       → { agentId, profile, parentId }
"agent:reasoning"     → { agentId, reasoning, toolCalls }
"agent:tool_called"   → { agentId, tool, args }
"agent:tool_result"   → { agentId, tool, result, duration }
"agent:completed"     → { agentId, result, tokenUsage }
"agent:error"         → { agentId, error, stack }

// Mission lifecycle
"mission:created"     → { missionId, title, agentProfile }
"mission:started"     → { missionId, timestamp }
"mission:progress"    → { missionId, phase, percentComplete }
"mission:completed"   → { missionId, result, duration }

// Memory operations
"memory:saved"        → { memoryId, text, area, tags }
"memory:loaded"       → { query, results[], count }
"memory:consolidated" → { beforeCount, afterCount, mergedIds }

// Workflow state
"workflow:state_change" → { workflowId, fromState, toState, stateData }
"workflow:checkpoint"   → { workflowId, checkpointId, stateSnapshot }
```

### Implementation Pattern

**Server-side:**
```javascript
// app/infrastructure/websocket/gateway.mjs
export class WebSocketGateway {
  send(ws, type, data, correlationId = null) {
    const message = {
      type,
      id: generateId(),
      timestamp: Date.now(),
      data,
      metadata: correlationId ? { correlationId } : undefined
    };
    
    // Validate: data must be object, not string
    if (typeof data !== 'object' || data === null) {
      throw new Error('WebSocket data must be structured object, not primitive');
    }
    
    ws.send(JSON.stringify(message));
  }
  
  broadcast(type, data) {
    const message = this.createMessage(type, data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
}
```

**Client-side (TypeScript):**
```typescript
// Web UI consumer
interface WebSocketClient {
  on(type: string, handler: (data: any, metadata: any) => void): void;
  send(type: string, data: object): Promise<any>;
}

const ws = new WebSocketClient('ws://localhost:3000/api/events');

ws.on('agent:reasoning', (data, metadata) => {
  console.log(`Agent ${data.agentId}: ${data.reasoning}`);
  updateUI({
    agentId: data.agentId,
    phase: data.phase,
    toolCalls: data.content.toolCalls
  });
});

// Send command
await ws.send('command', {
  command: 'research',
  args: { query: 'AI agents', depth: 2 }
});
```

### Validation Rules

1. ✅ **All messages have `type` field** (string enum)
2. ✅ **All messages have `timestamp`** (number, Unix ms)
3. ✅ **All messages have `data` field** (object, never string/number/boolean)
4. ✅ **Optional `id` for request-response correlation**
5. ✅ **Optional `metadata` for context** (sessionId, agentId, correlationId)
6. ❌ **Never send bare strings** - wrap in structured envelope
7. ❌ **Never omit timestamps** - required for ordering/debugging
8. ❌ **Never use human-readable text as top-level field** - use data.displayText

### Benefits

- **Machine-readable**: CLIs and automation can parse without regex
- **Type-safe**: Schema validation catches malformed messages
- **Traceable**: Correlation IDs link requests → events → responses
- **Testable**: Mock messages with structured data
- **Evolvable**: Add fields without breaking parsers (use optional fields)

---

## Monitoring & Alert Patterns

### Metrics Collection

**Event System Metrics:**
```javascript
// Counter: events published by type
metrics.increment('sync.events.published', { type: 'mission:started' });

// Histogram: sync latency
metrics.histogram('sync.latency', latencyMs, { event: 'mission:completed' });

// Gauge: active missions
metrics.gauge('missions.active', activeMissionCount);

// Counter: conflicts detected and resolved
metrics.increment('sync.conflicts.detected');
metrics.increment('sync.conflicts.resolved', { strategy: 'last-write-wins' });
```

**Memory System Metrics:**
```javascript
// Gauge: FAISS index size
metrics.gauge('memory.faiss.size_mb', indexSizeMB);

// Gauge: mission counts
metrics.gauge('memory.missions.active', activeCount);
metrics.gauge('memory.missions.archived', archivedCount);

// Counter: memory operations
metrics.increment('memory.operations', { op: 'insert' });
metrics.increment('memory.operations', { op: 'search' });
```

**Agent Performance Metrics:**
```javascript
// Histogram: agent execution time
metrics.histogram('agent.execution.duration_ms', durationMs, { 
  profile: 'researcher' 
});

// Counter: tool invocations
metrics.increment('agent.tool.invocations', { tool: 'search' });

// Gauge: token usage
metrics.gauge('agent.tokens.used', tokensUsed, { model: 'llama-70b' });
```

### Alert Definitions

**High-Priority Alerts:**
- Conflict rate >10/min → investigate concurrent editing patterns
- Sync lag >500ms → check WebSocket health
- Memory growth >1 GB → trigger consolidation
- Mission failure rate >20% → review plan quality
- API rate limit hits → adjust throttling

**Medium-Priority Alerts:**
- FAISS search latency >100ms → consider index optimization
- Event queue depth >1000 → check subscriber processing
- Token budget exceeded 3x in 1 hour → review prompt efficiency

**Monitoring Dashboard:**
- Real-time event stream viewer
- Mission timeline with step durations
- Memory growth trend chart
- Agent performance heatmap (tool usage × success rate)
- API quota consumption gauge

### Tool Orchestration
**Search Abstraction**: Unified interface for multiple providers (web search, academic papers, code repos). Rate limiting, retry logic, result normalization per provider.

**Crawler Integration**: Structured extraction from HTML/markdown, content cleaning, metadata capture.

**RAG Retrieval**: Vector store queries against external knowledge bases, similarity thresholds, result ranking.

### Human Checkpoints
Plan approval before execution starts. Per-section review before reporter synthesis. Rerun requests with modified parameters. Context injection mid-execution.

### Content Post-Processing
**Rich Text Editor**: Block-based with AI actions (improve, shorten, expand, rephrase). Markdown source editable.

**Export Formats**: 
- Markdown with frontmatter
- HTML with embedded styles  
- Presentation slides (markdown → template → PDF/HTML)
- Audio scripts with TTS timestamps

### Multimodal Generation
**Text-to-Speech**: API endpoint accepts section text, voice config, returns audio stream. Supports SSML for pacing/emphasis.

**Slide Assembly**: Template defines layout per section type (title, bullets, code, image). Markdown sections mapped to slide types, rendered via headless browser or native PDF library.

### Execution Monitoring
**Tracing**: Graph visualization showing node states (pending, active, complete, failed). Edge labels indicate data passed between nodes.

**Debugging**: State snapshots at each node transition. Environment variables, message history, tool outputs captured per node.

**Error Tolerance**: Node failures marked but don't halt pipeline. Errors aggregated in final report with remediation hints.

## Interface Design Patterns

### Conversational UI
**Layout**: Three-column (sidebar, messages, metadata)  
**Sidebar**: Chat history tree, folders, quick-access prompts  
**Messages**: Streaming token display, syntax-highlighted code blocks, scrollable tables, collapsible tool outputs  
**Metadata Panel**: Run settings, provider config, token usage, timing breakdown

**Message Actions**: Copy content, edit and regenerate, fork conversation branch, collapse/expand groups  
**Attachments**: File upload with preview, drag-drop support, inline image rendering

**Provider Controls**: Dropdown for model selection, sliders for temperature/top-p/max-tokens, system prompt override field  
**Persistence**: Local storage for drafts, database for saved chats, export as JSON/markdown

### Research Console
**Tabbed Navigation**: Canvas (graph editor), API tester, knowledge browser, settings, logs  
**Graph Canvas**: Node palette by type, drag-to-connect edges, zoom/pan controls, mini-map, progress overlays (pending/running/done)

**BYOK Security**: Client-side key entry, AES encryption before storage, keys scoped per provider, never transmitted to server  
**Provider Registry**: Base URL, auth headers, supported models list, rate limits

**Event Streaming**: SSE connection to `/api/events`, reconnect with `Last-Event-ID`, heartbeat every 15s, dedupe by event hash  
**Webhook Integration**: HMAC signature verification, dedupe window (2min), event broadcasting to subscribed clients

**Module Separation**:
```
graph-schema.js: node/edge factories, validators
ontology.js: taxonomy registry, cluster colors
prompting-engine.js: provider calls, response parsing
execution-engine.js: workflow runner, progress tracking
export-utils.js: format converters (JSON/MD/YAML/XML)
security.js: key encryption, session lifecycle
```

### Terminal File Manager
**Panes**: Source directory, destination directory, preview/inspector  
**Preview Modes**: Syntax-highlighted code, rendered markdown, ASCII art for images, hex dump for binaries

**Navigation**: Vim keybindings (hjkl, gg/G), fuzzy search (`/`), directory jump (z), tab focus switch  
**Operations**: Copy/yank (y), paste (p), delete (d + confirm), rename (r), new file/dir (n)

**Extensibility**: Plugin manifest (`plugin-name/manifest.json`), hook registration (on-open, on-save, on-delete), theme packs (colors, fonts, layout)

## Infrastructure & Security

### Session Management
**Cookies**:
- `session_token`: HttpOnly, signed with secret, 7-day expiry
- `csrf_token`: readable by client, paired with header on mutations  
- `sso_nonce`: HttpOnly, single-use for SSO callback validation

**API Authentication**: Bearer token in `Authorization` header, scoped to user + session, rotated on security events

### API Contracts
```
GET  /api/health          → { ok, version, uptime }
GET  /api/config          → { providers, models, features }
POST /api/auth/login      → sets session cookie
POST /api/auth/logout     → clears cookies (requires CSRF)
GET  /api/me              → { user, permissions } (requires session)

GET  /api/events          → SSE stream (open, ping, webhook events)
POST /api/webhooks/:source → HMAC-verified event ingestion

POST /api/ai/search       → { query, provider } → { results }
POST /api/ai/stream       → { messages, model } → SSE output
GET  /api/ai/models       → { providers, models, pricing }
```

### Storage Security
**Client-Side**: AES-256 encryption before `sessionStorage`, keys derived from user password or session token  
**Server-Side**: Never log provider keys, redact in error messages, secrets in env vars only  
**Logs**: Structured JSON with sensitive fields removed (`api_key`, `password`, `token` → `[REDACTED]`)

### Performance Budgets
**LLM Calls**: soft timeout 2s, hard timeout 5s, exponential backoff on retries  
**Memory Usage**: <50 MB per workflow, <200 MB total for concurrent workflows  
**Execution**: O(n) in workflow nodes, abort signal propagation, streaming preferred over buffering

### Rollback Controls
**Feature Flags**: Toggle in config or env var, check before code path execution  
**Canary Deployment**: Route subset of traffic to new version, monitor error rates  
**State Preservation**: Serialize task state before risky operations, restore on failure  
**Telemetry**: Emit success/failure events, dashboard tracks adoption and errors


## Implementation Checklist

- Agent hierarchy with guard/do/verify structure  
- State machine workflow (coordinator, planner, execution nodes, reporter)  
- Clarification loop for ambiguous user goals  
- BYOK security with client-side AES encryption, no server key storage  
- SSE event streaming with reconnection and heartbeat  
- Webhook ingestion with HMAC signature verification  
- Tool registry with rate limiting, retry logic, provider abstraction  
- Session management with HttpOnly cookies, CSRF double-submit  
- Performance timeouts (2s soft, 5s hard), abort signal propagation  
- Memory budgets (<50 MB per workflow, <200 MB concurrent)  
- Structured logging with sensitive field redaction  
- Feature flags for rollback control  
- Contract validation at module boundaries (Guard → Do → Verify)  
- Multi-column conversational UI with streaming tokens  
- Graph canvas for workflow visualization with node state overlays  
- Tabbed research console (canvas, API tester, knowledge browser, logs)  
- Terminal file manager with three-pane layout, Vim keybindings  
- Export formats: Markdown, HTML, slides, audio scripts  
- Plugin architecture with manifest registration and theme packs  
- API contracts documented with HTTP method, path, request/response schemas  
- Test coverage for happy path, boundary cases, one failure mode per module  
- Telemetry with correlation IDs, error aggregation, success metrics  
- Backpressure handling for unbounded concurrency  
- Idempotent external operations with state preservation on failure  
- RAG integration with vector store similarity queries  
- Multimodal generation (TTS, slide assembly, rich text blocks)

These details should remain available even after the sandbox artefacts are removed, informing implementation and ensuring the perfected architecture reflects proven patterns.
