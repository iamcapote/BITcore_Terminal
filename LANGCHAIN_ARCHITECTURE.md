# LangChain Architecture Diagrams

Visual representation of the LangChain migration architecture.

## Current Architecture (Before Migration)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BITcore Terminal                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
        ┌───────▼──────┐  ┌─────▼─────┐  ┌──────▼──────┐
        │   CLI Mode   │  │ WebSocket │  │   Express   │
        │   (stdin)    │  │  Server   │  │   Server    │
        └───────┬──────┘  └─────┬─────┘  └──────┬──────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Command Router        │
                    │   (commands/index.mjs)  │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼──────────┐  ┌─────────▼─────────┐  ┌──────────▼──────────┐
│  Chat Commands   │  │ Research Commands │  │  Auth Commands      │
│  (chat.cli.mjs)  │  │(research.cli.mjs) │  │ (login/logout)      │
└───────┬──────────┘  └─────────┬─────────┘  └──────────┬──────────┘
        │                        │                        │
        │         ┌──────────────┼──────────────┐        │
        │         │              │              │        │
┌───────▼─────────▼──────┐  ┌───▼──────────┐  │  ┌─────▼─────────┐
│  Infrastructure Layer  │  │ Search Layer │  │  │  Auth Layer   │
│  ─────────────────────│  │ ────────────  │  │  │ ────────────  │
│                        │  │              │  │  │               │
│  ┌──────────────────┐ │  │ ┌──────────┐ │  │  │ ┌───────────┐ │
│  │ LLM Client       │ │  │ │  Brave   │ │  │  │ │   User    │ │
│  │ (venice.llm)     │ │  │ │  Search  │ │  │  │ │  Manager  │ │
│  └──────┬───────────┘ │  │ └──────────┘ │  │  │ └───────────┘ │
│         │              │  │              │  │  │               │
│  ┌──────▼───────────┐ │  │              │  │  │ ┌───────────┐ │
│  │ Research Engine  │ │  │              │  │  │ │Encryption │ │
│  │ (engine.mjs)     │ │  │              │  │  │ │   Module  │ │
│  └──────┬───────────┘ │  │              │  │  │ └───────────┘ │
│         │              │  │              │  │  │               │
│  ┌──────▼───────────┐ │  │              │  │  └───────────────┘
│  │ Research Path    │ │  │              │  │
│  │ (path.mjs)       │ │  │              │  │
│  └──────────────────┘ │  │              │  │
│                        │  │              │  │
│  ┌──────────────────┐ │  │              │  │
│  │ Memory Manager   │ │  │              │  │
│  │ (memory.mgr)     │ │  │              │  │
│  └──────────────────┘ │  │              │  │
└────────────────────────┘  └──────────────┘  └───────────────────┘
```

## Target Architecture (After Migration)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BITcore Terminal                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
        ┌───────▼──────┐  ┌─────▼─────┐  ┌──────▼──────┐
        │   CLI Mode   │  │ WebSocket │  │   Express   │
        │   (stdin)    │  │  Server   │  │   Server    │
        └───────┬──────┘  └─────┬─────┘  └──────┬──────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Command Router        │
                    │   (commands/index.mjs)  │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼──────────┐  ┌─────────▼─────────┐  ┌──────────▼──────────┐
│  Chat Commands   │  │ Research Commands │  │  Auth Commands      │
│  (chat.cli.mjs)  │  │(research.cli.mjs) │  │ (login/logout)      │
└───────┬──────────┘  └─────────┬─────────┘  └──────────┬──────────┘
        │                        │                        │
        │         ┌──────────────┼──────────────┐        │
        │         │              │              │        │
        │    ┌────▼──────────────▼────┐         │        │
        │    │  LangChain Layer       │         │        │
        │    │  ══════════════════     │         │        │
        │    │                         │         │        │
        │    │ ┌─────────────────────┐│         │        │
        │    │ │ VeniceChatModel     ││         │        │
        │    │ │ (Custom LLM Wrapper)││         │        │
        │    │ └──────────┬──────────┘│         │        │
        │    │            │            │         │        │
        │    │ ┌──────────▼──────────┐│         │        │
        │    │ │  Chains Layer       ││         │        │
        │    │ │  ───────────────     ││         │        │
        │    │ │ • QueryGenChain     ││         │        │
        │    │ │ • LearningExtract   ││         │        │
        │    │ │ • SummaryGenChain   ││         │        │
        │    │ │ • TokenClassChain   ││         │        │
        │    │ └──────────┬──────────┘│         │        │
        │    │            │            │         │        │
        │    │ ┌──────────▼──────────┐│         │        │
        │    │ │  Agents Layer       ││         │        │
        │    │ │  ────────────────    ││         │        │
        │    │ │ • ResearchAgent     ││         │        │
        │    │ │ • AgentExecutor     ││         │        │
        │    │ └──────────┬──────────┘│         │        │
        │    │            │            │         │        │
        │    │ ┌──────────▼──────────┐│         │        │
        │    │ │  Tools Layer        ││         │        │
        │    │ │  ───────────────     ││         │        │
        │    │ │ • BraveSearchTool   ││         │        │
        │    │ │ • (Future tools)    ││         │        │
        │    │ └─────────────────────┘│         │        │
        │    └─────────────────────────┘         │        │
        │                 │                      │        │
┌───────▼─────────────────▼──────────┐  ┌───────▼────────┐  ┌─────▼─────────┐
│  Enhanced Infrastructure Layer     │  │  Search Layer  │  │  Auth Layer   │
│  ────────────────────────────────  │  │ ──────────────  │  │ ────────────  │
│                                     │  │                │  │               │
│  ┌───────────────────────────────┐ │  │ ┌────────────┐ │  │ ┌───────────┐ │
│  │ Research Engine (upgraded)    │ │  │ │   Brave    │ │  │ │   User    │ │
│  │ • Uses chains/agents          │ │  │ │   Search   │ │  │ │  Manager  │ │
│  │ • Feature flag support        │ │  │ │  Provider  │ │  │ └───────────┘ │
│  └───────────────────────────────┘ │  │ └────────────┘ │  │               │
│                                     │  │                │  │ ┌───────────┐ │
│  ┌───────────────────────────────┐ │  │                │  │ │Encryption │ │
│  │ Enhanced Memory Manager       │ │  │                │  │ │   Module  │ │
│  │ • Vector storage (Faiss)      │ │  │                │  │ └───────────┘ │
│  │ • Semantic search             │ │  │                │  │               │
│  │ • Conversation summaries      │ │  │                │  └───────────────┘
│  │ • LangChain memory types      │ │  │                │
│  └───────────────────────────────┘ │  │                │
│                                     │  │                │
└─────────────────────────────────────┘  └────────────────┘
```

## Component Flow: Research Query

### Before Migration

```
User Query
    │
    ▼
Research Engine
    │
    ├─→ generateQueries (LLMClient)
    │       └─→ Venice API (fetch)
    │
    ├─→ ResearchPath (recursive)
    │       │
    │       ├─→ BraveSearchProvider
    │       │       └─→ Brave API (axios)
    │       │
    │       └─→ processResults (LLMClient)
    │               └─→ Venice API (fetch)
    │
    └─→ generateSummary (LLMClient)
            └─→ Venice API (fetch)
    │
    ▼
Results (learnings, sources, summary)
```

### After Migration

```
User Query
    │
    ▼
Research Engine
    │
    ├─→ QueryGenerationChain (LangChain)
    │       └─→ VeniceChatModel
    │               └─→ Venice API (with retry/cache)
    │
    ├─→ Option A: Agent-based (if enabled)
    │   │
    │   └─→ ResearchAgent
    │           │
    │           ├─→ BraveSearchTool
    │           │       └─→ Brave API
    │           │
    │           └─→ LearningExtractionChain
    │                   └─→ VeniceChatModel
    │
    ├─→ Option B: Chain-based (default)
    │   │
    │   ├─→ ResearchPath
    │   │       │
    │   │       ├─→ BraveSearchTool
    │   │       │       └─→ Brave API
    │   │       │
    │   │       └─→ LearningExtractionChain
    │   │               └─→ VeniceChatModel
    │   │
    │   └─→ SummaryGenerationChain
    │           └─→ VeniceChatModel
    │
    ▼
Results (learnings, sources, summary)
    │
    └─→ Stored in vector memory (optional)
```

## Component Flow: Chat with Memory

### Before Migration

```
User Message
    │
    ▼
Chat Command
    │
    ├─→ MemoryManager
    │       │
    │       ├─→ Load ephemeral memories
    │       │
    │       └─→ Manual similarity scoring
    │
    ├─→ LLMClient
    │       │
    │       └─→ Venice API (fetch)
    │
    ├─→ MemoryManager
    │       │
    │       └─→ Save to ephemeral store
    │
    ▼
AI Response
```

### After Migration

```
User Message
    │
    ▼
Chat Command
    │
    ├─→ EnhancedMemoryManager (LangChain)
    │       │
    │       ├─→ ConversationSummaryMemory
    │       │       └─→ Load recent history
    │       │
    │       └─→ VectorStoreRetrieverMemory
    │               └─→ Semantic search (Faiss)
    │
    ├─→ LLMChain
    │       │
    │       ├─→ ChatPromptTemplate (with memory)
    │       │
    │       └─→ VeniceChatModel
    │               └─→ Venice API (with retry/cache)
    │
    ├─→ EnhancedMemoryManager
    │       │
    │       ├─→ Save to ConversationMemory
    │       │
    │       └─→ Save to VectorStore
    │
    ▼
AI Response (with context)
```

## Data Flow: Token Classification

### Before Migration

```
User Query
    │
    ▼
Token Classifier
    │
    └─→ callVeniceWithTokenClassifier
            │
            └─→ LLMClient
                    │
                    └─→ Venice API (fetch)
                            │
                            └─→ Raw metadata text
    │
    ▼
Query object { original, tokenClassification }
```

### After Migration

```
User Query
    │
    ▼
Token Classifier
    │
    └─→ callVeniceWithTokenClassifier
            │
            └─→ TokenClassificationChain
                    │
                    ├─→ ChatPromptTemplate
                    │
                    └─→ VeniceChatModel
                            │
                            └─→ Venice API (with retry)
                                    │
                                    └─→ Structured metadata
    │
    ▼
Query object { original, tokenClassification }
```

## Memory Architecture

### Before Migration

```
┌─────────────────────────────────────────┐
│         Memory Manager                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐    │
│  │   Ephemeral Memories           │    │
│  │   (Array of recent exchanges)  │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │   Validated Memories           │    │
│  │   (Array of summaries)         │    │
│  └────────────────────────────────┘    │
│                                         │
│  Manual Retrieval:                     │
│  • Linear search                       │
│  • No semantic understanding           │
│  • Fixed-size limits                   │
│                                         │
└─────────────────────────────────────────┘
```

### After Migration

```
┌─────────────────────────────────────────────────────────┐
│         Enhanced Memory Manager (LangChain)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │   ConversationSummaryMemory                   │    │
│  │   • Automatic summarization                   │    │
│  │   • Token-aware truncation                    │    │
│  │   • Sliding window                            │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │   VectorStoreRetrieverMemory                  │    │
│  │   • Semantic search (embeddings)              │    │
│  │   • Top-K retrieval                           │    │
│  │   • Relevance scoring                         │    │
│  │                                               │    │
│  │   Vector Store (Faiss/HNSWLib):              │    │
│  │   ┌─────────────────────────────────────┐    │    │
│  │   │  Embedding 1: "quantum computing..."│    │    │
│  │   │  Embedding 2: "machine learning..." │    │    │
│  │   │  Embedding N: "research methods..." │    │    │
│  │   └─────────────────────────────────────┘    │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  Smart Retrieval:                                      │
│  • Semantic similarity search                          │
│  • Context-aware retrieval                            │
│  • Dynamic K based on depth                           │
│  • Automatic memory consolidation                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Agent Architecture

### New: Research Agent with Tools

```
┌──────────────────────────────────────────────────────────────┐
│                     Research Agent                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Agent Executor                        │    │
│  │                                                     │    │
│  │  Planning & Reasoning:                             │    │
│  │  • Structured Chat Agent                           │    │
│  │  • ReAct pattern (Reason + Act)                    │    │
│  │  • Self-correction                                 │    │
│  │  • Max iterations: 10                              │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│       ┌────────────┼────────────┐                          │
│       │            │            │                          │
│  ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐                    │
│  │  Tool:  │  │ Tool:  │  │ Future  │                    │
│  │  Brave  │  │ Memory │  │  Tools  │                    │
│  │ Search  │  │ Search │  │  ...    │                    │
│  └─────────┘  └────────┘  └─────────┘                    │
│                                                              │
│  Capabilities:                                              │
│  • Autonomous research planning                            │
│  • Multi-step reasoning                                    │
│  • Tool selection and usage                                │
│  • Self-validation                                         │
│  • Intermediate step tracking                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Migration Phases Visualization

```
Phase 1: Foundation       Phase 2: Core           Phase 3: Advanced
(Weeks 1-2)              (Weeks 3-4)             (Weeks 5-6)
                                                  
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Install    │────────▶│   Migrate    │────────▶│   Create     │
│  LangChain   │         │   Providers  │         │   Agents     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Create     │         │   Update     │         │  Implement   │
│ VeniceChatMdl│         │   Chains     │         │   Vector     │
└──────────────┘         └──────────────┘         │   Memory     │
       │                        │                  └──────────────┘
       ▼                        ▼                        │
┌──────────────┐         ┌──────────────┐               ▼
│   Create     │         │   Create     │         ┌──────────────┐
│   Prompts    │         │   Tests      │         │   Create     │
└──────────────┘         └──────────────┘         │    Tools     │
                                                   └──────────────┘

Phase 4: Integration     Phase 5: Testing
(Weeks 7-8)              (Weeks 9-10)

┌──────────────┐         ┌──────────────┐
│   Update     │────────▶│ Comprehensive│
│   Engine     │         │    Testing   │
└──────────────┘         └──────────────┘
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│   Update     │         │   Feature    │
│    Chat      │         │    Flags     │
└──────────────┘         └──────────────┘
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│  WebSocket   │         │  Production  │
│ Integration  │         │  Deployment  │
└──────────────┘         └──────────────┘
```

## File Structure Comparison

### Before Migration

```
app/
├── infrastructure/
│   ├── ai/
│   │   ├── venice.llm-client.mjs
│   │   ├── venice.characters.mjs
│   │   ├── venice.models.mjs
│   │   └── venice.response-processor.mjs
│   ├── memory/
│   │   ├── memory.manager.mjs
│   │   └── github-memory.integration.mjs
│   └── research/
│       ├── research.engine.mjs
│       └── research.path.mjs
└── features/
    └── ai/
        └── research.providers.mjs
```

### After Migration

```
app/
├── infrastructure/
│   ├── ai/
│   │   ├── venice.llm-client.mjs (kept for backward compat)
│   │   ├── venice.characters.mjs (kept)
│   │   ├── venice.models.mjs (kept)
│   │   ├── venice.response-processor.mjs (kept)
│   │   └── langchain/                     ← NEW
│   │       ├── venice-chat-model.mjs      ← NEW
│   │       ├── prompts/                   ← NEW
│   │       │   └── research-prompts.mjs   ← NEW
│   │       ├── chains/                    ← NEW
│   │       │   └── research-chains.mjs    ← NEW
│   │       ├── agents/                    ← NEW
│   │       │   └── research-agent.mjs     ← NEW
│   │       ├── tools/                     ← NEW
│   │       │   └── brave-search-tool.mjs  ← NEW
│   │       └── memory/                    ← NEW
│   │           └── vector-memory.mjs      ← NEW
│   ├── memory/
│   │   ├── memory.manager.mjs (kept)
│   │   └── github-memory.integration.mjs (kept)
│   └── research/
│       ├── research.engine.mjs (updated)
│       └── research.path.mjs (updated)
└── features/
    └── ai/
        └── research.providers.mjs (updated)
```

## Success Metrics Dashboard

```
┌────────────────────────────────────────────────────────────┐
│                   Migration Success Metrics                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Response Time:  [████████▓▓] 82%  Target: < 2.75s       │
│  Memory Usage:   [█████████▓] 90%  Target: < 240MB       │
│  Error Rate:     [██████████] 100% Target: < 1%          │
│  Test Coverage:  [████████░░] 80%  Target: > 80%         │
│  Feature Parity: [██████████] 100% Target: 100%          │
│                                                            │
│  Status: ✓ Ready for Phase 2                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

**Version**: 1.0  
**Last Updated**: 2025-01-02  
**See also**: 
- [LANGCHAIN_MIGRATION_PLAN.md](./LANGCHAIN_MIGRATION_PLAN.md)
- [LANGCHAIN_QUICK_START.md](./LANGCHAIN_QUICK_START.md)
