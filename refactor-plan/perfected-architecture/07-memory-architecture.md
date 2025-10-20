<!--
Why: Coordinate short-term, long-term, and ontology memories so agents retain context without breaching performance budgets.
What: Defines the hybrid memory tiers, sync contracts, consolidation pipeline, and retention policy.
How: Describes event flows, provides sample code hooks, and lists the rules for merging and pruning memories.
-->

# Memory Architecture

## Hybrid System (BITcore ↔ External Ontology Service)

**Three-Tier Memory:**

1. **Working Memory (Graphology):**  
   Ephemeral graph for current mission. Nodes = queries, sources, summaries. Edges = derivation, citation.

2. **Long-Term Memory (FAISS):**  
   Persistent vector store. Documents = summaries, learnings, solutions.  
   Searched via semantic similarity.

3. **Ontology Memory (External Service):**  
   Optional remote knowledge graph (Neo4j, JanusGraph, Neptune, custom). Nodes = concepts, agents, workflows. Edges = relationships.

**Bidirectional Sync:**
- BITcore mission complete → Emit `workflow.created` event to ontology bridge
- BITcore saves memory → Emit `memory.saved`
- Ontology bridge publishes `workflow.planned` → BITcore instantiates mission + schedule
- Ontology bridge publishes `agent-profile.updated` → BITcore hot-reloads agent config

**Event Streams:**
```javascript
// BITcore → Ontology Service
eventBus.emit('mission:started', { missionId, title, goal });
eventBus.emit('mission:step_completed', { missionId, stepId, result });
eventBus.emit('memory:inserted', { memoryId, text, tags });

// Ontology Service → BITcore
eventBus.on('workflow:planned', async ({ workflowId, steps }) => {
  const mission = await createMissionFromWorkflow(workflowId, steps);
  await startMission(mission);
});
```

## Memory Consolidation

**Problem:** Memory grows unbounded. FAISS index becomes too large to search efficiently.

**Solution:** Periodic consolidation (nightly or on-demand).

**Process:**
1. Agent analyzes all memories for duplicates/redundancy
2. LLM merges similar memories:
  - Input: "Legacy orchestrators use a monologue loop for reasoning" (5 memories)
  - Output: "Legacy orchestration patterns run an iterative think → act → observe loop that enables autonomous tool usage." (1 consolidated memory)
3. Original memories flagged as `consolidated_into: mem_xyz`
4. Consolidated memory preserves all metadata (timestamps, sources, tags)

**Retention Policy:**
- Keep all memories from last 30 days
- Keep high-value memories (referenced >5 times) indefinitely
- Prune low-relevance memories (similarity < 0.3 to any query in 90 days)

---

## Vector Database Adapter Pattern

**Purpose:** Support multiple vector databases while maintaining consistent interface

**Supported Backends:**
1. **FAISS** (Default): Fast, local, no external dependencies
2. **ChromaDB**: Embedded or client-server mode with filtering
3. **Qdrant**: Distributed vector search with metadata filtering
4. **Pgvector**: PostgreSQL extension for SQL + vector hybrid queries

**Adapter Interface:**
```javascript
// app/infrastructure/memory/vector-adapter.mjs
export class VectorAdapter {
  async insert(text, embedding, metadata) {}
  async search(query, k = 5, filter = {}) {}
  async delete(id) {}
  async count() {}
  async close() {}
}

// Implementation selection
const adapter = await createAdapter(config.vectorDB);
// config.vectorDB = { type: 'faiss|chroma|qdrant|pgvector', ...options }
```

**Selection Strategy:**
- **FAISS**: Default for single-instance, memory-constrained environments
- **ChromaDB**: When metadata filtering is critical
- **Qdrant**: For distributed deployments requiring horizontal scaling
- **Pgvector**: When SQL queries + vector search needed together

**Configuration:**
```javascript
// app/config/memory.json
{
  "vectorDB": {
    "type": "faiss",  // or "chroma", "qdrant", "pgvector"
    "options": {
      "indexPath": "memory/faiss_index.bin",
      "dimension": 384,
      "metric": "cosine"
    }
  },
  "embedding": {
    "provider": "local",  // or "openai", "venice"
    "model": "all-MiniLM-L6-v2"
  }
}
```

---

## Sync Protocol: Event Schemas

### BITcore → Ontology Service Events

**Event: `mission:started`**
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

**Event: `mission:step_completed`**
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

**Event: `mission:completed`**
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

**Event: `memory:inserted`**
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

**Event: `graph:updated`**
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

### Ontology Service → BITcore Events

**Event: `workflow:planned`**
```json
{
  "type": "workflow:planned",
  "timestamp": "2025-10-17T09:00:00Z",
  "data": {
    "workflowId": "workflow-langchain-research",
    "name": "LangChain Research Pipeline",
    "steps": [
      {
        "stepId": "step-1",
        "action": "research",
        "params": { "query": "LangChain agent patterns", "depth": 3 }
      }
    ],
    "schedule": {
      "type": "immediate|scheduled|recurring",
      "cron": "0 9 * * 1"
    }
  }
}
```

**Event: `agent:profile_updated`**
```json
{
  "type": "agent:profile_updated",
  "timestamp": "2025-10-17T08:00:00Z",
  "data": {
    "profileId": "researcher",
    "changes": {
      "systemPrompt": "You are a deep research agent...",
      "tools": ["search", "memory", "code_exec"],
      "temperature": 0.7
    }
  }
}
```

**Event: `secret:stored`**
```json
{
  "type": "secret:stored",
  "timestamp": "2025-10-17T07:00:00Z",
  "data": {
    "secretKey": "github_token",
    "encrypted": true,
    "scopes": ["agent-0", "agent-1"]
  }
}
```

---

## Conflict Resolution

**Strategy:** Last-Write-Wins with Timestamp Comparison

### Scenario 1: Concurrent Mission Updates
**Problem:** User edits mission title in ontology UI while BITcore executes mission

**Resolution:**
1. Both systems emit update events with timestamps
2. Sync layer compares `mission.updatedAt` timestamps
3. Newer timestamp wins; loser receives sync event
4. UI shows conflict notification if user's change was overwritten

### Scenario 2: Graph Merge Conflicts
**Problem:** BITcore adds nodes to graph while user reorganizes in ontology UI

**Resolution:**
1. BITcore changes are atomic (node + edges added together)
2. Ontology UI changes are staged (not committed until user saves)
3. On save conflict, show diff: "BITcore added 3 nodes while you edited"
4. User chooses: Keep BITcore changes, Keep my changes, Merge both

### Scenario 3: Memory Duplication
**Problem:** User manually saves memory in ontology UI that BITcore auto-saved

**Resolution:**
1. Before insert, check FAISS for semantic similarity
2. If similarity > 0.9, treat as duplicate
3. Merge metadata (combine tags, source URLs)
4. Keep single memory with consolidated metadata

---

## Persistence Coordinator

**Atomic Writes:** Ensure mission + graph + vectors written together

**Write Pattern:**
```javascript
async function saveMissionAtomically(mission) {
  const tx = await db.beginTransaction();
  try {
    // Write mission JSON
    await tx.writeFile(`missions/active/${mission.id}.json`, mission);
    
    // Upsert FAISS vectors
    for (const step of mission.steps) {
      if (step.result?.summary) {
        await tx.faissInsert(step.result.summary, {
          missionId: mission.id,
          stepId: step.stepId
        });
      }
    }
    
    // Emit sync event
    await tx.emitEvent('mission:updated', mission);
    
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
```

**Recovery on Crash:**
- Mission files are write-once (new file per update with timestamp suffix)
- FAISS index has write-ahead log (WAL)
- On restart, replay WAL and reconcile with latest mission files

---

## Monitoring & Observability

**Metrics to Track:**
- `sync.events_published` (counter by event type)
- `sync.events_processed` (counter by event type)
- `sync.latency` (histogram of publish → process time)
- `sync.conflicts_detected` (counter)
- `sync.conflicts_resolved` (counter by strategy)
- `memory.faiss_size` (gauge in MB)
- `memory.missions_active` (gauge)
- `memory.missions_archived` (gauge)

**Log Format:**
```json
{
  "level": "info",
  "module": "sync.publisher",
  "event": "mission:completed",
  "missionId": "mission-abc",
  "timestamp": "2025-10-17T12:00:00Z",
  "latency_ms": 45,
  "subscribers": 2
}
```

**Alert Thresholds:**
- High Conflict Rate: >10 conflicts/min → investigate concurrent editing
- Sync Lag: Latency >500ms → check WebSocket connection
- Memory Growth: FAISS index >1GB → trigger consolidation

**Performance Budgets:**
- Event Throughput: 1000 events/sec sustained
- Sync Latency: <100ms from BITcore update → UI render
- Memory Overhead: <50MB for AgentContext + event queues
- Graph Export: Export 10,000-node graph in <2s
