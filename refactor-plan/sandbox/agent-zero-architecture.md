<!--
Why: Document Agent Zero's multi-agent architecture so contributors understand how agents coordinate, use tools, access memory, and interact with LLMs.
What: Visualizes the agent hierarchy, tool registry, memory system, and compute environment that enable dynamic, organic agent growth.
How: Uses Mermaid diagrams to show component boundaries, data flows, and the orchestration patterns that drive Agent Zero's capabilities.
-->

# Agent Zero System Architecture

## Overview

Agent Zero is a dynamic, organic agentic framework designed to grow and learn as it operates. It uses the computer as a tool and features a hierarchical multi-agent system where agents can create subordinate agents to decompose and solve complex tasks.

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT INTERFACES"]
        WebUI["Web Terminal<br/>Svelte UI"]
        CLI["Python REPL<br/>Direct CLI"]
        API["HTTP API<br/>REST Endpoints"]
    end

    subgraph AgentHierarchy["AGENT HIERARCHY"]
        Agent0["Agent 0<br/>Root Agent"]
        SubAgents["Subordinate Agents<br/>Task Decomposition"]
        AgentContext["Agent Context<br/>Shared State + Event Bus"]
        
        Agent0 -->|"Spawns"| SubAgents
        AgentContext -->|"Manages"| Agent0
        AgentContext -->|"Manages"| SubAgents
    end

    subgraph ToolRegistry["TOOL REGISTRY"]
        SearchTool["Search Engine<br/>Web Search"]
        CodeExec["Code Execution<br/>Python + Shell"]
        MemoryTool["Memory Tool<br/>Save/Load/Delete"]
        CommTool["Communication<br/>A2A Chat + User Input"]
        BrowserTool["Browser Agent<br/>Web Automation"]
        VisionTool["Vision<br/>Image Processing"]
        DocumentTool["Document Query<br/>RAG"]
        SchedulerTool["Scheduler<br/>Task Scheduling"]
        NotifyTool["Notify User<br/>Alerts"]
        CustomTools["Custom Tools<br/>User Extensions"]
    end

    subgraph LLMLayer["LLM ORCHESTRATION"]
        ChatModel["Chat Model<br/>Primary LLM"]
        UtilModel["Utility Model<br/>Fast Tasks"]
        BrowserModel["Browser Model<br/>Web Actions"]
        EmbedModel["Embedding Model<br/>Vector Search"]
        
        ModelProvider["LiteLLM Provider<br/>Multi-Provider Support"]
        RateLimiter["Rate Limiter<br/>Request Throttling"]
        
        ChatModel --> ModelProvider
        UtilModel --> ModelProvider
        BrowserModel --> ModelProvider
        EmbedModel --> ModelProvider
        
        ModelProvider --> RateLimiter
    end

    subgraph MemorySystem["MEMORY SYSTEM"]
        ShortTerm["Short-Term Memory<br/>Context Window"]
        LongTerm["Long-Term Memory<br/>Vector Database"]
        KnowledgeBase["Knowledge Base<br/>RAG Documents"]
        MemoryValidation["Memory Validation<br/>Schema Guards"]
        
        LongTerm --> EmbedModel
        KnowledgeBase --> EmbedModel
    end

    subgraph ComputeEnv["COMPUTE ENVIRONMENT"]
        DockerMgr["Docker Manager<br/>Container Orchestration"]
        SSHExec["SSH Executor<br/>Remote Commands"]
        LocalExec["Local Executor<br/>Direct Process"]
        EnvIsolation["Environment Isolation<br/>Security Sandbox"]
        
        DockerMgr --> EnvIsolation
        SSHExec --> EnvIsolation
        LocalExec --> EnvIsolation
    end

    subgraph PromptSystem["PROMPT SYSTEM"]
        SystemPrompts["System Prompts<br/>Agent Behavior"]
        ToolPrompts["Tool Prompts<br/>Tool Instructions"]
        MessageTemplates["Message Templates<br/>Communication"]
        ProfileLoader["Profile Loader<br/>Agent Personas"]
        
        ProfileLoader --> SystemPrompts
    end

    subgraph Storage["PERSISTENCE"]
        FileSystem["File System<br/>Logs + Archives"]
        MemoryStore["Memory Store<br/>Vector DB Files"]
        ConfigStore["Config Store<br/>Settings + Keys"]
        KnowledgeStore["Knowledge Store<br/>Documents"]
    end

    subgraph Extensions["EXTENSIBILITY"]
        MCPServers["MCP Servers<br/>External Tools"]
        CustomInstruments["Instruments<br/>Custom Functions"]
        Plugins["Extension Points<br/>Hooks"]
    end

    WebUI --> AgentContext
    CLI --> AgentContext
    API --> AgentContext
    
    Agent0 --> ToolRegistry
    SubAgents --> ToolRegistry
    
    ToolRegistry --> LLMLayer
    ToolRegistry --> ComputeEnv
    
    SearchTool --> ChatModel
    CodeExec --> ComputeEnv
    MemoryTool --> MemorySystem
    BrowserTool --> BrowserModel
    DocumentTool --> KnowledgeBase
    
    Agent0 --> PromptSystem
    SubAgents --> PromptSystem
    
    Agent0 --> ChatModel
    SubAgents --> UtilModel
    
    MemorySystem --> Storage
    AgentContext --> Storage
    ComputeEnv --> Storage
    
    ToolRegistry --> Extensions
    Agent0 --> Extensions

    style Client fill:#1976d2,color:#ffffff
    style AgentHierarchy fill:#f9a825,color:#000000
    style ToolRegistry fill:#388e3c,color:#ffffff
    style LLMLayer fill:#512da8,color:#ffffff
    style MemorySystem fill:#e64a19,color:#ffffff
    style ComputeEnv fill:#00796b,color:#ffffff
    style PromptSystem fill:#7b1fa2,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
    style Extensions fill:#d32f2f,color:#ffffff
```

## Agent Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent0
    participant LLM as Chat Model
    participant Tools as Tool Registry
    participant SubAgent as Subordinate Agent
    participant Memory as Memory System
    participant Compute as Code Executor

    User->>Agent0: Task Request
    Agent0->>LLM: Analyze Task<br/>(with system prompt)
    LLM-->>Agent0: Reasoning + Tool Calls
    
    alt Tool: Search
        Agent0->>Tools: search_engine(query)
        Tools-->>Agent0: Search Results
    end
    
    alt Tool: Call Subordinate
        Agent0->>SubAgent: Create + Assign Subtask
        SubAgent->>LLM: Process Subtask
        LLM-->>SubAgent: Response
        SubAgent->>Tools: Execute Tools
        Tools-->>SubAgent: Results
        SubAgent-->>Agent0: Report Back
    end
    
    alt Tool: Code Execution
        Agent0->>Tools: code_execution(code, language)
        Tools->>Compute: Execute in Sandbox
        Compute-->>Tools: Output + Errors
        Tools-->>Agent0: Execution Result
    end
    
    alt Tool: Memory
        Agent0->>Tools: memory_save(data)
        Tools->>Memory: Store with Embeddings
        Memory-->>Tools: Stored
        Tools-->>Agent0: Confirmation
    end
    
    Agent0->>LLM: Synthesize Final Answer
    LLM-->>Agent0: Response
    Agent0->>Memory: Save Learnings
    Agent0->>User: Final Answer + Stream Events
```

## Tool Execution Architecture

```mermaid
graph TB
    subgraph AgentLoop["AGENT LOOP"]
        MessageLoop["Message Loop<br/>LLM Interaction"]
        ToolParser["Tool Call Parser<br/>JSON Extraction"]
        ToolDispatcher["Tool Dispatcher<br/>Route to Handler"]
    end

    subgraph ToolHandlers["TOOL HANDLERS"]
        SearchHandler["search_engine.py"]
        CodeHandler["code_execution_tool.py"]
        MemoryHandler["memory_*.py"]
        BrowserHandler["browser_agent.py"]
        A2AHandler["a2a_chat.py"]
        InputHandler["input.py"]
        ResponseHandler["response.py"]
    end

    subgraph ToolExecution["TOOL EXECUTION"]
        Validate["Validate Args<br/>Schema Check"]
        Execute["Execute Logic<br/>Core Function"]
        Format["Format Output<br/>LLM-Readable"]
    end

    subgraph ExecutionContext["EXECUTION CONTEXT"]
        RuntimeEnv["Runtime<br/>SSH/Docker/Local"]
        APIClients["API Clients<br/>External Services"]
        FileOps["File Operations<br/>I/O"]
    end

    MessageLoop --> ToolParser
    ToolParser --> ToolDispatcher
    
    ToolDispatcher --> ToolHandlers
    
    SearchHandler --> Validate
    CodeHandler --> Validate
    MemoryHandler --> Validate
    BrowserHandler --> Validate
    
    Validate --> Execute
    Execute --> Format
    
    Execute --> ExecutionContext
    
    Format --> MessageLoop

    style AgentLoop fill:#f9a825,color:#000000
    style ToolHandlers fill:#388e3c,color:#ffffff
    style ToolExecution fill:#0288d1,color:#ffffff
    style ExecutionContext fill:#00796b,color:#ffffff
```

## Memory System Architecture

```mermaid
graph TB
    subgraph MemoryInterface["MEMORY INTERFACE"]
        SaveOp["memory_save<br/>Store Learning"]
        LoadOp["memory_load<br/>Semantic Search"]
        DeleteOp["memory_delete<br/>Remove Entry"]
        ForgetOp["memory_forget<br/>Topic Deletion"]
    end

    subgraph MemoryCore["MEMORY CORE"]
        MemoryManager["Memory Manager<br/>Orchestrator"]
        EmbedEngine["Embedding Engine<br/>Vector Generation"]
        Chunker["Text Chunker<br/>Document Split"]
        Validator["Schema Validator<br/>Type Safety"]
    end

    subgraph VectorDB["VECTOR DATABASE"]
        Index["FAISS Index<br/>Similarity Search"]
        Metadata["Metadata Store<br/>JSON Records"]
        IDMap["ID Mapping<br/>UUID to Vector"]
    end

    subgraph Integration["INTEGRATION"]
        RAGEngine["RAG Engine<br/>Document Query"]
        AgentContext["Agent Context<br/>Working Memory"]
        FileBackup["File Backup<br/>JSON Exports"]
    end

    SaveOp --> MemoryManager
    LoadOp --> MemoryManager
    DeleteOp --> MemoryManager
    ForgetOp --> MemoryManager
    
    MemoryManager --> Validator
    MemoryManager --> EmbedEngine
    MemoryManager --> Chunker
    
    EmbedEngine --> Index
    Metadata --> Index
    IDMap --> Index
    
    MemoryManager --> VectorDB
    
    RAGEngine --> VectorDB
    AgentContext --> MemoryManager
    MemoryManager --> FileBackup

    style MemoryInterface fill:#e64a19,color:#ffffff
    style MemoryCore fill:#f9a825,color:#000000
    style VectorDB fill:#512da8,color:#ffffff
    style Integration fill:#0288d1,color:#ffffff
```

## Configuration & Initialization

```mermaid
graph TB
    subgraph Init["INITIALIZATION"]
        Bootstrap["initialize.py<br/>Entry Point"]
        SettingsLoader["Settings Loader<br/>Config Files"]
        EnvLoader[".env Loader<br/>Secrets"]
    end

    subgraph Config["CONFIGURATION"]
        ModelConfig["Model Config<br/>LLM Settings"]
        AgentConfig["Agent Config<br/>Profiles + Memory"]
        RuntimeConfig["Runtime Config<br/>SSH/Docker"]
        BrowserConfig["Browser Config<br/>HTTP Headers"]
    end

    subgraph ModelSetup["MODEL SETUP"]
        ChatLLM["Chat Model<br/>Primary"]
        UtilityLLM["Utility Model<br/>Fast"]
        EmbeddingLLM["Embedding Model<br/>Vectors"]
        BrowserLLM["Browser Model<br/>Automation"]
    end

    subgraph AgentSetup["AGENT SETUP"]
        Agent0Init["Agent 0<br/>Root Instance"]
        ContextInit["Context<br/>Session State"]
        MemoryInit["Memory<br/>Load/Initialize"]
        ToolsInit["Tools<br/>Registry Setup"]
    end

    Bootstrap --> SettingsLoader
    Bootstrap --> EnvLoader
    
    SettingsLoader --> Config
    EnvLoader --> Config
    
    ModelConfig --> ModelSetup
    AgentConfig --> AgentSetup
    RuntimeConfig --> AgentSetup
    BrowserConfig --> BrowserLLM
    
    ModelSetup --> Agent0Init
    ContextInit --> Agent0Init
    MemoryInit --> Agent0Init
    ToolsInit --> Agent0Init

    style Init fill:#1976d2,color:#ffffff
    style Config fill:#f57c00,color:#ffffff
    style ModelSetup fill:#512da8,color:#ffffff
    style AgentSetup fill:#f9a825,color:#000000
```

## Web UI Architecture

```mermaid
graph TB
    subgraph Frontend["FRONTEND (Svelte)"]
        UIComponents["UI Components<br/>Chat, Settings, Files"]
        StateManager["State Manager<br/>Stores"]
        Router["Router<br/>Page Navigation"]
    end

    subgraph Backend["BACKEND API"]
        FastAPI["FastAPI Server<br/>HTTP + WS"]
        SessionMgr["Session Manager<br/>User Sessions"]
        AuthMiddleware["Auth Middleware<br/>CSRF + Auth"]
    end

    subgraph Endpoints["API ENDPOINTS"]
        ChatWS["WebSocket /chat<br/>Real-time Streaming"]
        ContextAPI["/context<br/>List Sessions"]
        MessageAPI["/messages<br/>History"]
        FilesAPI["/files<br/>File Browser"]
        SettingsAPI["/settings<br/>Configuration"]
    end

    subgraph AgentBridge["AGENT BRIDGE"]
        WSHandler["WebSocket Handler<br/>Message Router"]
        StreamManager["Stream Manager<br/>Event Forwarding"]
        ContextBridge["Context Bridge<br/>Session to Agent"]
    end

    UIComponents --> StateManager
    StateManager --> Router
    Router --> Frontend
    
    Frontend --> Backend
    
    Backend --> SessionMgr
    Backend --> AuthMiddleware
    Backend --> Endpoints
    
    ChatWS --> WSHandler
    ContextAPI --> ContextBridge
    MessageAPI --> ContextBridge
    
    WSHandler --> StreamManager
    StreamManager --> AgentBridge
    ContextBridge --> AgentBridge

    style Frontend fill:#1976d2,color:#ffffff
    style Backend fill:#7b1fa2,color:#ffffff
    style Endpoints fill:#388e3c,color:#ffffff
    style AgentBridge fill:#f9a825,color:#000000
```

## Data Flow: Research Task

```mermaid
sequenceDiagram
    participant User
    participant UI as Web UI
    participant Context as Agent Context
    participant Agent0
    participant LLM as Chat Model
    participant Search as Search Tool
    participant Memory as Memory System
    participant SubAgent as Subordinate Agent

    User->>UI: "Research quantum computing"
    UI->>Context: Create/Resume Session
    Context->>Agent0: Initialize with Task
    
    Agent0->>LLM: System Prompt + Task
    LLM-->>Agent0: Plan: [Search, Analyze, Report]
    
    Agent0->>Search: search_engine("quantum computing basics")
    Search-->>Agent0: Web Results
    
    Agent0->>Memory: memory_load("quantum computing")
    Memory-->>Agent0: Previous Learnings
    
    Agent0->>LLM: Synthesize with Results
    LLM-->>Agent0: Intermediate Analysis
    
    Agent0->>SubAgent: Delegate("Deep dive quantum algorithms")
    SubAgent->>LLM: Process Subtask
    LLM-->>SubAgent: Detailed Analysis
    SubAgent->>Search: search_engine("quantum algorithms")
    Search-->>SubAgent: Algorithm Results
    SubAgent-->>Agent0: Report: Algorithms Summary
    
    Agent0->>LLM: Final Synthesis
    LLM-->>Agent0: Complete Report
    
    Agent0->>Memory: memory_save(report + learnings)
    Memory-->>Agent0: Stored
    
    Agent0->>Context: Stream Complete
    Context->>UI: Display Full Report
    UI->>User: Results with Sources
```

## Extensibility Points

```mermaid
graph TB
    subgraph CoreExtensions["CORE EXTENSIONS"]
        ToolExtension["Tool Extension<br/>python/tools/*.py"]
        InstrumentExtension["Instrument Extension<br/>instruments/*.py"]
        PromptExtension["Prompt Extension<br/>prompts/custom/"]
        ProfileExtension["Profile Extension<br/>Agent Profiles"]
    end

    subgraph ExternalIntegrations["EXTERNAL INTEGRATIONS"]
        MCPProtocol["MCP Protocol<br/>Model Context Protocol"]
        CustomAPIs["Custom APIs<br/>HTTP Integrations"]
        Webhooks["Webhooks<br/>Event Notifications"]
        BrowserUse["Browser-Use<br/>Web Automation"]
    end

    subgraph RuntimeExtensions["RUNTIME EXTENSIONS"]
        DockerImages["Docker Images<br/>Custom Environments"]
        SSHTargets["SSH Targets<br/>Remote Hosts"]
        EnvProfiles["Environment Profiles<br/>Execution Contexts"]
    end

    subgraph DataExtensions["DATA EXTENSIONS"]
        CustomEmbeddings["Custom Embeddings<br/>SentenceTransformers"]
        KnowledgeSources["Knowledge Sources<br/>Document Loaders"]
        MemoryAdapters["Memory Adapters<br/>Storage Backends"]
    end

    CoreExtensions --> ToolExtension
    CoreExtensions --> InstrumentExtension
    
    ExternalIntegrations --> MCPProtocol
    ExternalIntegrations --> BrowserUse
    
    RuntimeExtensions --> DockerImages
    RuntimeExtensions --> SSHTargets
    
    DataExtensions --> CustomEmbeddings
    DataExtensions --> KnowledgeSources

    style CoreExtensions fill:#388e3c,color:#ffffff
    style ExternalIntegrations fill:#d32f2f,color:#ffffff
    style RuntimeExtensions fill:#00796b,color:#ffffff
    style DataExtensions fill:#7b1fa2,color:#ffffff
```

## Key Design Principles

### 1. Organic Growth
- Agents create subordinate agents dynamically based on task complexity
- No pre-programmed task-specific tools; agents build tools as needed
- Persistent memory allows learning and reuse of solutions

### 2. Transparent Operation
- All prompts visible in `prompts/` directory
- Tool implementations in `python/tools/` are readable Python
- Streaming output shows agent reasoning in real-time

### 3. Computer as Tool
- Agents execute arbitrary code in sandboxed environments
- Terminal access for running system commands
- File system operations for tool creation and data management

### 4. Flexible LLM Support
- LiteLLM provides multi-provider abstraction
- Four model roles: Chat, Utility, Browser, Embedding
- Rate limiting and request throttling per model

### 5. Multi-Agent Cooperation
- Superior-subordinate hierarchy for task decomposition
- Agent-to-agent chat for collaboration
- Shared context and memory across agent instances

### 6. Security & Isolation
- Docker/SSH for code execution isolation
- Environment-specific configurations
- Rate limiting and resource controls

## File Organization

```
agent-zero/
├── agent.py                 # Agent class and context management
├── models.py                # LLM models and configurations
├── initialize.py            # Initialization and setup
├── run_ui.py               # Web UI server
├── python/
│   ├── api/                # FastAPI backend
│   ├── extensions/         # Extension system
│   ├── helpers/            # Utilities and helpers
│   └── tools/              # Tool implementations
├── prompts/
│   └── default/            # System prompts and templates
├── webui/                  # Svelte frontend
├── instruments/            # Custom functions
├── knowledge/              # RAG document store
├── memory/                 # Vector database storage
├── conf/                   # Configuration files
└── docker/                 # Docker environments
```

## Technology Stack

- **Core**: Python 3.12+
- **LLM Orchestration**: LiteLLM, LangChain
- **Web Framework**: FastAPI (backend), Svelte (frontend)
- **Vector Database**: FAISS with SentenceTransformers
- **Compute**: Docker, SSH, subprocess
- **Browser Automation**: Playwright via browser-use
- **Tool Integration**: MCP (Model Context Protocol)

---

This architecture enables Agent Zero to operate as a general-purpose assistant that learns, adapts, and grows organically while maintaining transparency and user control.
