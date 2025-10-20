<!--
Why: Document AnythingLLM's all-in-one AI architecture so contributors understand how workspaces, document processing, LLM providers, agents, and multi-user management coordinate.
What: Visualizes the document ingestion pipeline, workspace isolation, agent system, embedding engines, vector databases, and multi-provider LLM integration.
How: Uses Mermaid diagrams to show the full-stack architecture, data flows, and component boundaries that enable private ChatGPT-like experiences with RAG.
-->

# AnythingLLM System Architecture

## Overview

AnythingLLM is an all-in-one AI application that enables users to build private ChatGPT experiences with document context. It supports multiple LLM providers, vector databases, embedding engines, and features workspace isolation, multi-user management, AI agents, and a no-code agent flow builder with full MCP compatibility.

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT INTERFACES"]
        Desktop["Desktop App<br/>Electron (Mac/Win/Linux)"]
        WebUI["Web Interface<br/>React + Vite"]
        EmbedWidget["Embed Widget<br/>iframe Integration"]
        API["Developer API<br/>REST Endpoints"]
    end

    subgraph WorkspaceLayer["WORKSPACE LAYER"]
        WorkspaceManager["Workspace Manager<br/>Containerized Contexts"]
        WorkspaceState["Workspace State<br/>Settings + Documents"]
        ThreadManager["Thread Manager<br/>Conversation Branching"]
        PermissionLayer["Permission Layer<br/>Multi-user Access"]
    end

    subgraph DocumentPipeline["DOCUMENT PIPELINE"]
        Collector["Collector Service<br/>Python Flask"]
        DocProcessor["Document Processor<br/>Multiple Formats"]
        Chunker["Text Splitter<br/>Smart Chunking"]
        EmbedQueue["Embedding Queue<br/>Async Processing"]
        DocumentManager["Document Manager<br/>Metadata + Storage"]
    end

    subgraph VectorSystem["VECTOR SYSTEM"]
        VectorDBRouter["Vector DB Router<br/>Multi-provider"]
        PineconeDB["Pinecone"]
        ChromaDB["Chroma"]
        QdrantDB["Qdrant"]
        WeaviateDB["Weaviate"]
        LanceDB["LanceDB"]
        MilvusDB["Milvus"]
        VectorStore["Vector Store<br/>Embeddings + Metadata"]
    end

    subgraph EmbeddingLayer["EMBEDDING LAYER"]
        EmbedRouter["Embedding Router<br/>Provider Selection"]
        OpenAIEmbed["OpenAI Embeddings"]
        AzureEmbed["Azure Embeddings"]
        LocalEmbed["Local Embeddings<br/>llama.cpp"]
        CohereEmbed["Cohere Embeddings"]
        RerankerEngine["Reranker Engine<br/>Result Optimization"]
    end

    subgraph LLMOrchestration["LLM ORCHESTRATION"]
        LLMRouter["LLM Provider Router"]
        OpenAI["OpenAI<br/>GPT-4, GPT-4o, o1"]
        Azure["Azure OpenAI"]
        Anthropic["Anthropic<br/>Claude 3.x"]
        Google["Google<br/>Gemini Pro"]
        Ollama["Ollama<br/>Local Models"]
        LMStudio["LM Studio"]
        Together["Together AI"]
        Groq["Groq"]
        LocalLLM["Local LLM<br/>llama.cpp"]
    end

    subgraph AgentSystem["AGENT SYSTEM"]
        AgentFlowBuilder["Agent Flow Builder<br/>No-Code Visual"]
        CustomAgents["Custom Agents<br/>Specialized Tasks"]
        MCPServers["MCP Servers<br/>Tool Integration"]
        AgentTools["Agent Tools<br/>Web Browse, Search"]
        SkillRegistry["Skill Registry<br/>Reusable Actions"]
    end

    subgraph Storage["STORAGE LAYER"]
        SQLite["SQLite Database<br/>Metadata + Users"]
        Prisma["Prisma ORM<br/>Data Access"]
        FileStorage["File Storage<br/>Documents + Assets"]
        EncryptedConfig["Encrypted Config<br/>Secrets Management"]
    end

    subgraph BackgroundWorkers["BACKGROUND WORKERS"]
        EmbedWorker["Embedding Worker<br/>Batch Processing"]
        TelemetryWorker["Telemetry Worker<br/>Analytics"]
        CacheWorker["Cache Worker<br/>Response Caching"]
    end

    subgraph Security["SECURITY & AUTH"]
        AuthLayer["Auth Layer<br/>JWT + Sessions"]
        RBAC["RBAC<br/>Role-based Access"]
        PasswordRecovery["Password Recovery<br/>Email Flow"]
        ComKeyAuth["Commercial Key<br/>License Validation"]
    end

    Desktop --> WorkspaceLayer
    WebUI --> WorkspaceLayer
    EmbedWidget --> API
    API --> WorkspaceLayer
    
    WorkspaceManager --> WorkspaceState
    WorkspaceState --> ThreadManager
    ThreadManager --> PermissionLayer
    
    WorkspaceManager --> DocumentPipeline
    Collector --> DocProcessor
    DocProcessor --> Chunker
    Chunker --> EmbedQueue
    EmbedQueue --> DocumentManager
    
    DocumentManager --> VectorSystem
    VectorDBRouter --> PineconeDB
    VectorDBRouter --> ChromaDB
    VectorDBRouter --> QdrantDB
    VectorDBRouter --> WeaviateDB
    VectorDBRouter --> LanceDB
    VectorDBRouter --> MilvusDB
    VectorStore --> VectorDBRouter
    
    EmbedQueue --> EmbeddingLayer
    EmbedRouter --> OpenAIEmbed
    EmbedRouter --> AzureEmbed
    EmbedRouter --> LocalEmbed
    EmbedRouter --> CohereEmbed
    EmbedRouter --> RerankerEngine
    
    WorkspaceManager --> LLMOrchestration
    LLMRouter --> OpenAI
    LLMRouter --> Azure
    LLMRouter --> Anthropic
    LLMRouter --> Google
    LLMRouter --> Ollama
    LLMRouter --> LMStudio
    LLMRouter --> Together
    LLMRouter --> Groq
    LLMRouter --> LocalLLM
    
    WorkspaceManager --> AgentSystem
    AgentFlowBuilder --> CustomAgents
    CustomAgents --> MCPServers
    CustomAgents --> AgentTools
    AgentTools --> SkillRegistry
    
    WorkspaceManager --> Storage
    Prisma --> SQLite
    DocumentManager --> FileStorage
    AuthLayer --> EncryptedConfig
    
    EmbedQueue --> BackgroundWorkers
    TelemetryWorker --> BackgroundWorkers
    CacheWorker --> BackgroundWorkers
    
    WorkspaceLayer --> Security
    AuthLayer --> RBAC
    RBAC --> PasswordRecovery
    ComKeyAuth --> AuthLayer

    style Client fill:#1976d2,color:#ffffff
    style WorkspaceLayer fill:#f9a825,color:#000000
    style DocumentPipeline fill:#388e3c,color:#ffffff
    style VectorSystem fill:#512da8,color:#ffffff
    style EmbeddingLayer fill:#e64a19,color:#ffffff
    style LLMOrchestration fill:#00796b,color:#ffffff
    style AgentSystem fill:#7b1fa2,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
    style BackgroundWorkers fill:#d32f2f,color:#ffffff
    style Security fill:#c2185b,color:#ffffff
```

## Document Ingestion & Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI as Web UI
    participant Workspace as Workspace Manager
    participant Collector as Collector Service
    participant Processor as Document Processor
    participant Chunker as Text Splitter
    participant Embedder as Embedding Engine
    participant VectorDB as Vector Database
    participant Storage as File Storage

    User->>WebUI: Upload Document (PDF/DOCX/TXT)
    WebUI->>Workspace: Add Document to Workspace
    Workspace->>Collector: Send Document for Processing
    
    Collector->>Processor: Parse Document<br/>(Extract Text/Images)
    Processor-->>Collector: Raw Text + Metadata
    
    Collector->>Chunker: Split Text into Chunks
    Chunker-->>Collector: Text Chunks + Boundaries
    
    Collector->>Embedder: Generate Embeddings<br/>(Batch)
    Embedder-->>Collector: Vector Embeddings
    
    Collector->>VectorDB: Store Embeddings<br/>with Metadata
    VectorDB-->>Collector: Confirmation + IDs
    
    Collector->>Storage: Save Original Document
    Storage-->>Collector: File Path
    
    Collector->>Workspace: Document Ready
    Workspace->>WebUI: Update Document List
    WebUI->>User: Document Added Successfully
```

## Workspace Chat & RAG Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI as Web UI
    participant Workspace as Workspace
    participant VectorDB as Vector DB
    participant Reranker as Reranker Engine
    participant LLM as LLM Provider
    participant Agent as Agent System
    participant Cache as Cache Layer

    User->>WebUI: Send Chat Message
    WebUI->>Workspace: Process Query in Context
    
    Workspace->>Cache: Check Cache for Response
    alt Cache Hit
        Cache-->>Workspace: Cached Response
        Workspace-->>WebUI: Return Response
    else Cache Miss
        Workspace->>VectorDB: Similarity Search<br/>(Query Embedding)
        VectorDB-->>Workspace: Top-K Documents
        
        Workspace->>Reranker: Rerank Results<br/>(Optional)
        Reranker-->>Workspace: Optimized Results
        
        alt Agent Mode Enabled
            Workspace->>Agent: Execute Agent Flow
            Agent->>Agent: Use Tools (Web Search, etc)
            Agent->>LLM: Generate with Tool Results
            LLM-->>Agent: Response
            Agent-->>Workspace: Final Response
        else Standard Chat
            Workspace->>LLM: Generate with Context<br/>(Prompt + Documents)
            LLM-->>Workspace: Response + Citations
        end
        
        Workspace->>Cache: Store Response
        Workspace->>WebUI: Stream Response
    end
    
    WebUI->>User: Display Response with Citations
```

## Agent Flow System

```mermaid
graph TB
    subgraph FlowBuilder["AGENT FLOW BUILDER"]
        VisualEditor["Visual Flow Editor<br/>Drag & Drop"]
        NodeLibrary["Node Library<br/>Actions & Logic"]
        FlowValidator["Flow Validator<br/>Schema Check"]
        FlowExporter["Flow Exporter<br/>JSON/YAML"]
    end

    subgraph FlowNodes["FLOW NODE TYPES"]
        InputNode["Input Node<br/>User Query"]
        LLMNode["LLM Node<br/>Model Invocation"]
        ToolNode["Tool Node<br/>External Actions"]
        ConditionalNode["Conditional Node<br/>Branching Logic"]
        LoopNode["Loop Node<br/>Iteration"]
        OutputNode["Output Node<br/>Response"]
    end

    subgraph AgentRuntime["AGENT RUNTIME"]
        FlowExecutor["Flow Executor<br/>State Machine"]
        ContextManager["Context Manager<br/>Variable Scope"]
        ToolInvoker["Tool Invoker<br/>MCP Integration"]
        ErrorHandler["Error Handler<br/>Retry & Fallback"]
    end

    subgraph AgentTools["AGENT TOOLS"]
        WebBrowser["Web Browser<br/>Page Scraping"]
        SearchEngine["Search Engine<br/>Web Search"]
        CodeExecutor["Code Executor<br/>Sandbox"]
        APIClient["API Client<br/>HTTP Requests"]
        DatabaseQuery["Database Query<br/>SQL/NoSQL"]
    end

    subgraph MCPIntegration["MCP INTEGRATION"]
        MCPRegistry["MCP Server Registry"]
        MCPClient["MCP Client<br/>Protocol Handler"]
        MCPTools["MCP Tools<br/>Remote Capabilities"]
        MCPAuth["MCP Auth<br/>Token Management"]
    end

    VisualEditor --> NodeLibrary
    NodeLibrary --> FlowValidator
    FlowValidator --> FlowExporter
    
    FlowNodes --> FlowExecutor
    InputNode --> LLMNode
    LLMNode --> ToolNode
    ToolNode --> ConditionalNode
    ConditionalNode --> LoopNode
    LoopNode --> OutputNode
    
    FlowExecutor --> ContextManager
    ContextManager --> ToolInvoker
    ToolInvoker --> ErrorHandler
    
    ToolInvoker --> AgentTools
    WebBrowser --> AgentTools
    SearchEngine --> AgentTools
    CodeExecutor --> AgentTools
    APIClient --> AgentTools
    DatabaseQuery --> AgentTools
    
    ToolInvoker --> MCPIntegration
    MCPRegistry --> MCPClient
    MCPClient --> MCPTools
    MCPTools --> MCPAuth

    style FlowBuilder fill:#f9a825,color:#000000
    style FlowNodes fill:#388e3c,color:#ffffff
    style AgentRuntime fill:#0288d1,color:#ffffff
    style AgentTools fill:#7b1fa2,color:#ffffff
    style MCPIntegration fill:#d32f2f,color:#ffffff
```

## Multi-User & Permission System

```mermaid
graph TB
    subgraph UserManagement["USER MANAGEMENT"]
        UserRegistry["User Registry<br/>Admin/Manager/User"]
        AuthProvider["Auth Provider<br/>JWT + Sessions"]
        InviteSystem["Invite System<br/>Email Invitations"]
        PasswordMgmt["Password Management<br/>Recovery + Reset"]
    end

    subgraph PermissionEngine["PERMISSION ENGINE"]
        RBACEngine["RBAC Engine<br/>Role Policies"]
        WorkspaceACL["Workspace ACL<br/>Access Control"]
        DocumentACL["Document ACL<br/>Sharing Rules"]
        FeatureFlags["Feature Flags<br/>Enterprise Features"]
    end

    subgraph WorkspaceSharing["WORKSPACE SHARING"]
        ShareManager["Share Manager<br/>User/Team Sharing"]
        AccessLevels["Access Levels<br/>Read/Write/Admin"]
        TeamGroups["Team Groups<br/>Organization"]
        ShareLinks["Share Links<br/>Public Access"]
    end

    subgraph AuditLogging["AUDIT & LOGGING"]
        ActionLogger["Action Logger<br/>User Activity"]
        AccessLog["Access Log<br/>Resource Access"]
        ComplianceReport["Compliance Report<br/>Usage Analytics"]
    end

    UserRegistry --> AuthProvider
    AuthProvider --> InviteSystem
    InviteSystem --> PasswordMgmt
    
    AuthProvider --> PermissionEngine
    RBACEngine --> WorkspaceACL
    WorkspaceACL --> DocumentACL
    DocumentACL --> FeatureFlags
    
    PermissionEngine --> WorkspaceSharing
    ShareManager --> AccessLevels
    AccessLevels --> TeamGroups
    TeamGroups --> ShareLinks
    
    PermissionEngine --> AuditLogging
    ActionLogger --> AccessLog
    AccessLog --> ComplianceReport

    style UserManagement fill:#1976d2,color:#ffffff
    style PermissionEngine fill:#f9a825,color:#000000
    style WorkspaceSharing fill:#388e3c,color:#ffffff
    style AuditLogging fill:#7b1fa2,color:#ffffff
```

## Embedding & Vector Database Architecture

```mermaid
graph TB
    subgraph EmbeddingProviders["EMBEDDING PROVIDERS"]
        OpenAIEmbed["OpenAI<br/>text-embedding-ada-002"]
        AzureEmbed["Azure OpenAI<br/>Custom Deployments"]
        CohereEmbed["Cohere<br/>embed-english-v3.0"]
        LocalEmbed["Local Embeddings<br/>llama.cpp, GGUF"]
        VoyageEmbed["Voyage AI"]
    end

    subgraph EmbeddingPipeline["EMBEDDING PIPELINE"]
        EmbedQueue["Embedding Queue<br/>Async Worker"]
        BatchProcessor["Batch Processor<br/>Optimize API Calls"]
        EmbedCache["Embed Cache<br/>Duplicate Detection"]
        CostTracker["Cost Tracker<br/>Token Usage"]
    end

    subgraph VectorDatabases["VECTOR DATABASES"]
        Pinecone["Pinecone<br/>Cloud Managed"]
        Chroma["Chroma<br/>Open Source"]
        Qdrant["Qdrant<br/>High Performance"]
        Weaviate["Weaviate<br/>Semantic Search"]
        LanceDB["LanceDB<br/>Serverless"]
        Milvus["Milvus<br/>Scalable"]
    end

    subgraph QueryOptimization["QUERY OPTIMIZATION"]
        SimilaritySearch["Similarity Search<br/>Cosine/Dot Product"]
        Reranker["Reranker<br/>Cohere, Jina"]
        HybridSearch["Hybrid Search<br/>Vector + Keyword"]
        MetadataFilter["Metadata Filter<br/>Pre-filtering"]
    end

    EmbeddingProviders --> EmbeddingPipeline
    OpenAIEmbed --> EmbedQueue
    AzureEmbed --> EmbedQueue
    CohereEmbed --> EmbedQueue
    LocalEmbed --> EmbedQueue
    VoyageEmbed --> EmbedQueue
    
    EmbedQueue --> BatchProcessor
    BatchProcessor --> EmbedCache
    EmbedCache --> CostTracker
    
    EmbeddingPipeline --> VectorDatabases
    Pinecone --> VectorDatabases
    Chroma --> VectorDatabases
    Qdrant --> VectorDatabases
    Weaviate --> VectorDatabases
    LanceDB --> VectorDatabases
    Milvus --> VectorDatabases
    
    VectorDatabases --> QueryOptimization
    SimilaritySearch --> Reranker
    Reranker --> HybridSearch
    HybridSearch --> MetadataFilter

    style EmbeddingProviders fill:#512da8,color:#ffffff
    style EmbeddingPipeline fill:#f9a825,color:#000000
    style VectorDatabases fill:#388e3c,color:#ffffff
    style QueryOptimization fill:#e64a19,color:#ffffff
```

## Desktop Application Architecture

```mermaid
graph TB
    subgraph ElectronMain["ELECTRON MAIN PROCESS"]
        MainWindow["Main Window<br/>BrowserWindow"]
        AppMenu["App Menu<br/>Native Menu"]
        Updater["Auto Updater<br/>Version Check"]
        IPC["IPC Bridge<br/>Main ↔ Renderer"]
    end

    subgraph RendererProcess["RENDERER PROCESS"]
        ReactApp["React App<br/>Vite Build"]
        LocalServer["Local Server<br/>Embedded Node"]
        StateManager["State Manager<br/>Context API"]
    end

    subgraph LocalStorage["LOCAL STORAGE"]
        SQLiteLocal["SQLite DB<br/>Local Data"]
        FileSystem["File System<br/>Documents"]
        ConfigStore["Config Store<br/>User Settings"]
    end

    subgraph NativeIntegration["NATIVE INTEGRATION"]
        Tray["System Tray<br/>Background Mode"]
        Notifications["Notifications<br/>Native Alerts"]
        Clipboard["Clipboard<br/>Copy/Paste"]
        FileDialogs["File Dialogs<br/>OS Native"]
    end

    MainWindow --> IPC
    AppMenu --> IPC
    Updater --> IPC
    
    IPC --> RendererProcess
    ReactApp --> LocalServer
    LocalServer --> StateManager
    
    LocalServer --> LocalStorage
    SQLiteLocal --> LocalStorage
    FileSystem --> LocalStorage
    ConfigStore --> LocalStorage
    
    MainWindow --> NativeIntegration
    Tray --> NativeIntegration
    Notifications --> NativeIntegration
    Clipboard --> NativeIntegration
    FileDialogs --> NativeIntegration

    style ElectronMain fill:#1976d2,color:#ffffff
    style RendererProcess fill:#f9a825,color:#000000
    style LocalStorage fill:#388e3c,color:#ffffff
    style NativeIntegration fill:#7b1fa2,color:#ffffff
```

## API Architecture

```mermaid
graph TB
    subgraph PublicAPI["PUBLIC API"]
        RESTEndpoints["REST Endpoints<br/>CRUD Operations"]
        WebhookReceiver["Webhook Receiver<br/>External Events"]
        APIKeys["API Key Manager<br/>Auth Tokens"]
        RateLimiter["Rate Limiter<br/>Request Throttling"]
    end

    subgraph APIRoutes["API ROUTES"]
        WorkspaceAPI["Workspace API<br/>/workspaces"]
        DocumentAPI["Document API<br/>/documents"]
        ChatAPI["Chat API<br/>/chat"]
        SystemAPI["System API<br/>/system"]
        EmbedAPI["Embed API<br/>/embed-config"]
    end

    subgraph APIMiddleware["API MIDDLEWARE"]
        AuthMiddleware["Auth Middleware<br/>Token Validation"]
        ValidationMiddleware["Validation Middleware<br/>Schema Check"]
        LoggingMiddleware["Logging Middleware<br/>Request Tracking"]
        CORSMiddleware["CORS Middleware<br/>Cross-Origin"]
    end

    subgraph Integration["INTEGRATIONS"]
        Zapier["Zapier Integration<br/>Automation"]
        N8N["n8n Integration<br/>Workflow"]
        Make["Make Integration<br/>Scenarios"]
        CustomWebhooks["Custom Webhooks<br/>HTTP Callbacks"]
    end

    RESTEndpoints --> APIRoutes
    WebhookReceiver --> APIRoutes
    APIKeys --> RateLimiter
    
    WorkspaceAPI --> APIMiddleware
    DocumentAPI --> APIMiddleware
    ChatAPI --> APIMiddleware
    SystemAPI --> APIMiddleware
    EmbedAPI --> APIMiddleware
    
    AuthMiddleware --> ValidationMiddleware
    ValidationMiddleware --> LoggingMiddleware
    LoggingMiddleware --> CORSMiddleware
    
    APIRoutes --> Integration
    Zapier --> Integration
    N8N --> Integration
    Make --> Integration
    CustomWebhooks --> Integration

    style PublicAPI fill:#d32f2f,color:#ffffff
    style APIRoutes fill:#388e3c,color:#ffffff
    style APIMiddleware fill:#f9a825,color:#000000
    style Integration fill:#7b1fa2,color:#ffffff
```

## Key Design Principles

### 1. Workspace Isolation
- Each workspace is a containerized context with its own documents and settings
- Workspaces can share documents but conversations remain isolated
- Clear separation of concerns for multi-tenant environments

### 2. Multi-Provider Support
- Provider-agnostic architecture allows switching between LLMs and vector databases
- Unified interfaces abstract provider-specific implementations
- Cost optimization through provider selection and local model support

### 3. Document Intelligence
- Smart chunking preserves context boundaries
- Deduplication prevents redundant embeddings
- Citation tracking maintains source traceability

### 4. Agent Extensibility
- No-code flow builder for non-technical users
- MCP compatibility enables external tool integration
- Reusable skill registry promotes agent modularity

### 5. Enterprise-Ready
- Multi-user support with granular permissions
- Audit logging for compliance
- Embeddable widget for white-label deployments

### 6. Performance & Cost
- Aggressive caching at multiple layers
- Batch processing for embeddings
- Local model support eliminates API costs

## Technology Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Desktop**: Electron (Mac, Windows, Linux)
- **Database**: SQLite (local), Prisma ORM
- **Document Processing**: Python Flask, langchain
- **Vector Databases**: Pinecone, Chroma, Qdrant, Weaviate, LanceDB, Milvus
- **LLM Providers**: OpenAI, Anthropic, Google, Azure, Ollama, LM Studio, 20+ others
- **Embedding Providers**: OpenAI, Cohere, Azure, Local (llama.cpp)
- **Agent System**: Custom flow engine, MCP protocol support
- **Background Jobs**: Node.js workers, async queues

## File Organization

```
anything-llm/
├── frontend/              # React web interface
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utilities
│   └── vite.config.js
├── server/                # Node.js backend
│   ├── endpoints/         # API routes
│   ├── models/            # Data models
│   ├── utils/             # Core utilities
│   │   ├── agents/        # Agent system
│   │   ├── agentFlows/    # Flow builder
│   │   ├── AiProviders/   # LLM providers
│   │   ├── EmbeddingEngines/ # Embedding providers
│   │   ├── vectorDbProviders/ # Vector DBs
│   │   ├── MCP/           # MCP integration
│   │   └── chats/         # Chat logic
│   ├── prisma/            # Database schema
│   └── index.js
├── collector/             # Python document processor
│   ├── processSingleDocument/ # File parsers
│   ├── scripts/           # Processing scripts
│   └── app.py             # Flask server
├── embed/                 # Embeddable widget
├── browser-extension/     # Browser extension
└── docker/                # Docker deployment
```

## Deployment Options

- **Docker**: Single-command deployment with docker-compose
- **Desktop**: Native apps for Mac, Windows, Linux (Electron)
- **Cloud**: AWS, Azure, GCP, Railway, Render
- **Bare Metal**: Manual installation on Linux/Mac
- **Kubernetes**: Helm charts for cluster deployment

---

This architecture enables AnythingLLM to function as a complete, self-hosted alternative to commercial AI chat platforms, with full control over data, models, and infrastructure while maintaining enterprise-grade features and performance.
