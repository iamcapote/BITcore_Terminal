<!--
Why: Document LibreChat's comprehensive multi-provider chat architecture so contributors understand how it enables unified access to multiple AI services with advanced features like agents, RAG, code interpreter, and generative UI.
What: Visualizes the provider routing system, conversation management, file handling, plugin architecture, preset system, and multi-user access control.
How: Uses Mermaid diagrams to show the full-stack architecture that enables ChatGPT-like experiences with provider flexibility and enterprise features.
-->

# LibreChat System Architecture

## Overview

LibreChat is an enhanced ChatGPT clone that provides a unified interface for multiple AI providers (OpenAI, Anthropic, Google, Azure, AWS Bedrock, custom endpoints). It features multi-modal support, agents, RAG (file chat), code interpreter, generative UI with code artifacts, web search, image generation, conversation branching, and multi-user management.

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT LAYER"]
        ReactUI["React Frontend<br/>Next.js App"]
        StateManager["State Management<br/>Recoil + React Query"]
        WebSocket["WebSocket Client<br/>Real-time Streaming"]
        FileUploader["File Uploader<br/>Multi-modal Support"]
    end

    subgraph APIGateway["API GATEWAY"]
        ExpressServer["Express Server<br/>REST + WS"]
        RouteController["Route Controller<br/>Endpoint Routing"]
        Middleware["Middleware Stack<br/>Auth + Validation"]
        RateLimiter["Rate Limiter<br/>Request Throttling"]
    end

    subgraph ProviderSystem["PROVIDER SYSTEM"]
        ProviderRouter["Provider Router<br/>Unified Interface"]
        OpenAI["OpenAI<br/>GPT-4o, o1, DALL-E"]
        Anthropic["Anthropic<br/>Claude 3.x"]
        Google["Google<br/>Gemini Pro/Flash"]
        Azure["Azure OpenAI<br/>Custom Deployments"]
        AWSBedrock["AWS Bedrock<br/>Claude, Titan"]
        VertexAI["Vertex AI<br/>Gemini"]
        CustomEndpoint["Custom Endpoints<br/>OpenAI-compatible"]
    end

    subgraph ConversationEngine["CONVERSATION ENGINE"]
        ConvManager["Conversation Manager<br/>Thread Orchestration"]
        MessageProcessor["Message Processor<br/>Format + Parse"]
        BranchManager["Branch Manager<br/>Fork & Continue"]
        ContextBuilder["Context Builder<br/>History Assembly"]
    end

    subgraph AgentSystem["AGENT SYSTEM (LibreChat Agents)"]
        AgentBuilder["Agent Builder<br/>No-Code Creation"]
        AgentMarketplace["Agent Marketplace<br/>Community Agents"]
        AgentSharing["Agent Sharing<br/>User/Group Permissions"]
        MCPIntegration["MCP Integration<br/>Tool Protocols"]
        AgentExecution["Agent Execution<br/>Multi-step Workflows"]
    end

    subgraph FileSystem["FILE & RAG SYSTEM"]
        FileHandler["File Handler<br/>Upload + Processing"]
        VectorStore["Vector Store<br/>Embeddings"]
        RAGEngine["RAG Engine<br/>Document Chat"]
        FileSearch["File Search<br/>Semantic Query"]
        ImageProcessor["Image Processor<br/>Vision Models"]
    end

    subgraph CodeInterpreter["CODE INTERPRETER"]
        SandboxManager["Sandbox Manager<br/>Isolated Execution"]
        RuntimeEnvironment["Runtime Environment<br/>Python, Node, Go, etc"]
        FileIO["File I/O<br/>Upload/Download"]
        SecurityLayer["Security Layer<br/>Resource Limits"]
    end

    subgraph WebSearch["WEB SEARCH SYSTEM"]
        SearchProvider["Search Provider<br/>Configurable Engine"]
        ContentScraper["Content Scraper<br/>Page Fetching"]
        Reranker["Reranker<br/>Jina/Custom"]
        ResultAggregator["Result Aggregator<br/>Multi-source"]
    end

    subgraph ImageGen["IMAGE GENERATION"]
        ImageRouter["Image Router<br/>Provider Selection"]
        DALLE["DALL-E 2/3<br/>OpenAI"]
        GPTImage["GPT-Image-1<br/>Text-to-Image"]
        StableDiffusion["Stable Diffusion<br/>Local/Remote"]
        Flux["Flux<br/>Advanced Models"]
    end

    subgraph GenerativeUI["GENERATIVE UI (Code Artifacts)"]
        ArtifactEngine["Artifact Engine<br/>Code Generation"]
        ReactRenderer["React Renderer<br/>Live Preview"]
        HTMLRenderer["HTML Renderer<br/>Static Pages"]
        MermaidRenderer["Mermaid Renderer<br/>Diagrams"]
    end

    subgraph PresetSystem["PRESET & PROMPT SYSTEM"]
        PresetManager["Preset Manager<br/>Create + Save"]
        PromptLibrary["Prompt Library<br/>Reusable Templates"]
        SharingEngine["Sharing Engine<br/>User/Group Access"]
    end

    subgraph Database["DATABASE LAYER"]
        MongoDB["MongoDB<br/>Conversations + Users"]
        PostgreSQL["PostgreSQL<br/>Alternative DB"]
        ModelCache["Model Cache<br/>Response Caching"]
        SessionStore["Session Store<br/>Active Sessions"]
    end

    subgraph Authentication["AUTH & SECURITY"]
        AuthProvider["Auth Provider<br/>Local + OAuth"]
        JWTManager["JWT Manager<br/>Token Handling"]
        PermissionEngine["Permission Engine<br/>RBAC"]
        OAuth["OAuth Providers<br/>Google, GitHub"]
    end

    ReactUI --> StateManager
    StateManager --> WebSocket
    WebSocket --> FileUploader
    
    Client --> APIGateway
    ExpressServer --> RouteController
    RouteController --> Middleware
    Middleware --> RateLimiter
    
    APIGateway --> ProviderSystem
    ProviderRouter --> OpenAI
    ProviderRouter --> Anthropic
    ProviderRouter --> Google
    ProviderRouter --> Azure
    ProviderRouter --> AWSBedrock
    ProviderRouter --> VertexAI
    ProviderRouter --> CustomEndpoint
    
    APIGateway --> ConversationEngine
    ConvManager --> MessageProcessor
    MessageProcessor --> BranchManager
    BranchManager --> ContextBuilder
    
    ConversationEngine --> AgentSystem
    AgentBuilder --> AgentMarketplace
    AgentMarketplace --> AgentSharing
    AgentSharing --> MCPIntegration
    MCPIntegration --> AgentExecution
    
    ConversationEngine --> FileSystem
    FileHandler --> VectorStore
    VectorStore --> RAGEngine
    RAGEngine --> FileSearch
    FileSearch --> ImageProcessor
    
    AgentExecution --> CodeInterpreter
    SandboxManager --> RuntimeEnvironment
    RuntimeEnvironment --> FileIO
    FileIO --> SecurityLayer
    
    AgentExecution --> WebSearch
    SearchProvider --> ContentScraper
    ContentScraper --> Reranker
    Reranker --> ResultAggregator
    
    ConversationEngine --> ImageGen
    ImageRouter --> DALLE
    ImageRouter --> GPTImage
    ImageRouter --> StableDiffusion
    ImageRouter --> Flux
    
    ConversationEngine --> GenerativeUI
    ArtifactEngine --> ReactRenderer
    ArtifactEngine --> HTMLRenderer
    ArtifactEngine --> MermaidRenderer
    
    ConversationEngine --> PresetSystem
    PresetManager --> PromptLibrary
    PromptLibrary --> SharingEngine
    
    APIGateway --> Database
    MongoDB --> ModelCache
    PostgreSQL --> ModelCache
    ModelCache --> SessionStore
    
    APIGateway --> Authentication
    AuthProvider --> JWTManager
    JWTManager --> PermissionEngine
    PermissionEngine --> OAuth

    style Client fill:#1976d2,color:#ffffff
    style APIGateway fill:#f9a825,color:#000000
    style ProviderSystem fill:#388e3c,color:#ffffff
    style ConversationEngine fill:#512da8,color:#ffffff
    style AgentSystem fill:#e64a19,color:#ffffff
    style FileSystem fill:#00796b,color:#ffffff
    style CodeInterpreter fill:#7b1fa2,color:#ffffff
    style WebSearch fill:#689f38,color:#ffffff
    style ImageGen fill:#d32f2f,color:#ffffff
    style GenerativeUI fill:#0288d1,color:#ffffff
    style PresetSystem fill:#f57c00,color:#ffffff
    style Database fill:#455a64,color:#ffffff
    style Authentication fill:#c2185b,color:#ffffff
```

## Conversation Flow with Provider Routing

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant API as API Gateway
    participant ConvMgr as Conversation Manager
    participant Provider as Provider Router
    participant LLM as LLM Provider
    participant RAG as RAG Engine
    participant Agent as Agent System
    participant Cache as Response Cache

    User->>UI: Send Message
    UI->>API: POST /api/messages
    API->>ConvMgr: Process Message
    
    ConvMgr->>Cache: Check Cache
    alt Cache Hit
        Cache-->>ConvMgr: Cached Response
        ConvMgr-->>UI: Stream Response
    else Cache Miss
        ConvMgr->>ConvMgr: Select Provider + Preset
        
        alt File Chat (RAG)
            ConvMgr->>RAG: Search Documents
            RAG-->>ConvMgr: Relevant Chunks
        end
        
        alt Agent Mode
            ConvMgr->>Agent: Execute Agent
            Agent->>Agent: Use Tools (Search, Code, etc)
            Agent->>LLM: Generate with Tool Results
            LLM-->>Agent: Response
            Agent-->>ConvMgr: Final Response
        else Standard Chat
            ConvMgr->>Provider: Route to Provider
            Provider->>LLM: Generate Response
            LLM-->>Provider: Stream Response
            Provider-->>ConvMgr: Forward Stream
        end
        
        ConvMgr->>Cache: Store Response
        ConvMgr->>UI: Stream Response
    end
    
    UI->>User: Display Response with Artifacts
```

## LibreChat Agent Architecture

```mermaid
graph TB
    subgraph AgentCreation["AGENT CREATION"]
        NoCodeBuilder["No-Code Builder<br/>Visual Interface"]
        AgentConfig["Agent Config<br/>Name, Description, Icon"]
        ToolSelection["Tool Selection<br/>MCP + Built-in"]
        ModelSelection["Model Selection<br/>Provider + Model"]
        InstructionEditor["Instruction Editor<br/>System Prompt"]
    end

    subgraph AgentCapabilities["AGENT CAPABILITIES"]
        FileSearch["File Search<br/>RAG Integration"]
        CodeExecution["Code Execution<br/>Interpreter"]
        WebSearch["Web Search<br/>Internet Access"]
        MCPTools["MCP Tools<br/>External Services"]
        ImageGen["Image Generation<br/>DALL-E/SD"]
    end

    subgraph AgentMarket["AGENT MARKETPLACE"]
        CommunityAgents["Community Agents<br/>Public Gallery"]
        PrivateAgents["Private Agents<br/>User-specific"]
        TeamAgents["Team Agents<br/>Group Sharing"]
        AgentVersioning["Agent Versioning<br/>Change Tracking"]
    end

    subgraph AgentExecution["AGENT EXECUTION ENGINE"]
        Orchestrator["Orchestrator<br/>Multi-step Workflow"]
        ToolInvoker["Tool Invoker<br/>Function Calling"]
        StateManager["State Manager<br/>Context Tracking"]
        ResponseBuilder["Response Builder<br/>Output Formatting"]
    end

    subgraph AgentPermissions["AGENT PERMISSIONS"]
        AccessControl["Access Control<br/>User/Group Rules"]
        ResourceLimits["Resource Limits<br/>Usage Quotas"]
        AuditLog["Audit Log<br/>Action Tracking"]
    end

    NoCodeBuilder --> AgentConfig
    AgentConfig --> ToolSelection
    ToolSelection --> ModelSelection
    ModelSelection --> InstructionEditor
    
    ToolSelection --> AgentCapabilities
    FileSearch --> AgentCapabilities
    CodeExecution --> AgentCapabilities
    WebSearch --> AgentCapabilities
    MCPTools --> AgentCapabilities
    ImageGen --> AgentCapabilities
    
    AgentConfig --> AgentMarket
    CommunityAgents --> AgentMarket
    PrivateAgents --> AgentMarket
    TeamAgents --> AgentMarket
    AgentVersioning --> AgentMarket
    
    AgentCapabilities --> AgentExecution
    Orchestrator --> ToolInvoker
    ToolInvoker --> StateManager
    StateManager --> ResponseBuilder
    
    AgentMarket --> AgentPermissions
    AccessControl --> ResourceLimits
    ResourceLimits --> AuditLog

    style AgentCreation fill:#1976d2,color:#ffffff
    style AgentCapabilities fill:#388e3c,color:#ffffff
    style AgentMarket fill:#f9a825,color:#000000
    style AgentExecution fill:#512da8,color:#ffffff
    style AgentPermissions fill:#c2185b,color:#ffffff
```

## Code Interpreter System

```mermaid
graph TB
    subgraph InterpreterFrontend["INTERPRETER FRONTEND"]
        CodeInput["Code Input<br/>Editor Interface"]
        LanguageSelector["Language Selector<br/>Python, Node, Go, etc"]
        FileUpload["File Upload<br/>Input Data"]
        ResultDisplay["Result Display<br/>Output + Errors"]
    end

    subgraph SandboxLayer["SANDBOX LAYER"]
        ContainerManager["Container Manager<br/>Isolation"]
        ResourceLimiter["Resource Limiter<br/>CPU/Memory/Time"]
        NetworkPolicy["Network Policy<br/>Restricted Access"]
        FileSystemIsolation["File System Isolation<br/>Temporary Storage"]
    end

    subgraph RuntimeSupport["RUNTIME SUPPORT"]
        PythonRuntime["Python Runtime<br/>3.x + Libraries"]
        NodeRuntime["Node.js Runtime<br/>JS/TS"]
        GoRuntime["Go Runtime<br/>Compiled"]
        CRuntime["C/C++ Runtime<br/>GCC"]
        JavaRuntime["Java Runtime<br/>JVM"]
        OtherRuntimes["Other Runtimes<br/>PHP, Rust, Fortran"]
    end

    subgraph ExecutionPipeline["EXECUTION PIPELINE"]
        CodeValidator["Code Validator<br/>Syntax Check"]
        DependencyInstaller["Dependency Installer<br/>Package Management"]
        Executor["Executor<br/>Run Code"]
        OutputCapture["Output Capture<br/>STDOUT/STDERR"]
        FileGenerator["File Generator<br/>Downloads"]
    end

    CodeInput --> LanguageSelector
    LanguageSelector --> FileUpload
    FileUpload --> ResultDisplay
    
    InterpreterFrontend --> SandboxLayer
    ContainerManager --> ResourceLimiter
    ResourceLimiter --> NetworkPolicy
    NetworkPolicy --> FileSystemIsolation
    
    SandboxLayer --> RuntimeSupport
    PythonRuntime --> RuntimeSupport
    NodeRuntime --> RuntimeSupport
    GoRuntime --> RuntimeSupport
    CRuntime --> RuntimeSupport
    JavaRuntime --> RuntimeSupport
    OtherRuntimes --> RuntimeSupport
    
    RuntimeSupport --> ExecutionPipeline
    CodeValidator --> DependencyInstaller
    DependencyInstaller --> Executor
    Executor --> OutputCapture
    OutputCapture --> FileGenerator

    style InterpreterFrontend fill:#1976d2,color:#ffffff
    style SandboxLayer fill:#e64a19,color:#ffffff
    style RuntimeSupport fill:#388e3c,color:#ffffff
    style ExecutionPipeline fill:#f9a825,color:#000000
```

## Web Search Architecture

```mermaid
graph TB
    subgraph SearchInterface["SEARCH INTERFACE"]
        SearchTrigger["Search Trigger<br/>Automatic/Manual"]
        QueryExtractor["Query Extractor<br/>Intent Detection"]
        ResultPresenter["Result Presenter<br/>Inline Citations"]
    end

    subgraph SearchProviders["SEARCH PROVIDERS"]
        GoogleSearch["Google Search<br/>API"]
        BingSearch["Bing Search<br/>API"]
        DuckDuckGo["DuckDuckGo<br/>Privacy-focused"]
        CustomSearch["Custom Search<br/>Configurable"]
    end

    subgraph ContentProcessing["CONTENT PROCESSING"]
        WebScraper["Web Scraper<br/>Page Fetching"]
        ContentExtractor["Content Extractor<br/>Main Content"]
        ChunkProcessor["Chunk Processor<br/>Segmentation"]
    end

    subgraph Reranking["RERANKING SYSTEM"]
        JinaReranker["Jina Reranker<br/>Custom API"]
        CohereReranker["Cohere Reranker<br/>API"]
        LocalReranker["Local Reranker<br/>BM25"]
        ScoreAggregator["Score Aggregator<br/>Final Ranking"]
    end

    SearchTrigger --> QueryExtractor
    QueryExtractor --> ResultPresenter
    
    QueryExtractor --> SearchProviders
    GoogleSearch --> SearchProviders
    BingSearch --> SearchProviders
    DuckDuckGo --> SearchProviders
    CustomSearch --> SearchProviders
    
    SearchProviders --> ContentProcessing
    WebScraper --> ContentExtractor
    ContentExtractor --> ChunkProcessor
    
    ContentProcessing --> Reranking
    JinaReranker --> ScoreAggregator
    CohereReranker --> ScoreAggregator
    LocalReranker --> ScoreAggregator
    ScoreAggregator --> ResultPresenter

    style SearchInterface fill:#1976d2,color:#ffffff
    style SearchProviders fill:#388e3c,color:#ffffff
    style ContentProcessing fill:#f9a825,color:#000000
    style Reranking fill:#512da8,color:#ffffff
```

## Generative UI (Code Artifacts)

```mermaid
graph TB
    subgraph ArtifactGeneration["ARTIFACT GENERATION"]
        PromptDetector["Prompt Detector<br/>Intent Recognition"]
        CodeGenerator["Code Generator<br/>LLM-based"]
        SyntaxValidator["Syntax Validator<br/>Parse Check"]
        SecurityScanner["Security Scanner<br/>XSS Prevention"]
    end

    subgraph ArtifactTypes["ARTIFACT TYPES"]
        ReactComponent["React Component<br/>Interactive UI"]
        HTMLPage["HTML Page<br/>Static Content"]
        MermaidDiagram["Mermaid Diagram<br/>Flowcharts"]
        SVGGraphic["SVG Graphic<br/>Vector Art"]
    end

    subgraph RenderingEngine["RENDERING ENGINE"]
        IFrameRenderer["iFrame Renderer<br/>Isolation"]
        ShadowDOMRenderer["Shadow DOM Renderer<br/>Style Isolation"]
        LivePreview["Live Preview<br/>Real-time Update"]
        ExportHandler["Export Handler<br/>Download"]
    end

    subgraph InteractionLayer["INTERACTION LAYER"]
        EditMode["Edit Mode<br/>Code Editor"]
        PreviewMode["Preview Mode<br/>Rendered View"]
        VersionHistory["Version History<br/>Change Tracking"]
        ShareLink["Share Link<br/>Public URL"]
    end

    PromptDetector --> CodeGenerator
    CodeGenerator --> SyntaxValidator
    SyntaxValidator --> SecurityScanner
    
    SecurityScanner --> ArtifactTypes
    ReactComponent --> ArtifactTypes
    HTMLPage --> ArtifactTypes
    MermaidDiagram --> ArtifactTypes
    SVGGraphic --> ArtifactTypes
    
    ArtifactTypes --> RenderingEngine
    IFrameRenderer --> ShadowDOMRenderer
    ShadowDOMRenderer --> LivePreview
    LivePreview --> ExportHandler
    
    RenderingEngine --> InteractionLayer
    EditMode --> PreviewMode
    PreviewMode --> VersionHistory
    VersionHistory --> ShareLink

    style ArtifactGeneration fill:#1976d2,color:#ffffff
    style ArtifactTypes fill:#f9a825,color:#000000
    style RenderingEngine fill:#388e3c,color:#ffffff
    style InteractionLayer fill:#512da8,color:#ffffff
```

## Preset & Context Management

```mermaid
graph TB
    subgraph PresetCreation["PRESET CREATION"]
        PresetBuilder["Preset Builder<br/>UI Editor"]
        ProviderConfig["Provider Config<br/>Model + Endpoint"]
        ParameterEditor["Parameter Editor<br/>Temperature, Top-p"]
        PromptTemplate["Prompt Template<br/>System Message"]
    end

    subgraph ContextControls["CONTEXT CONTROLS"]
        MessageEditor["Message Editor<br/>Edit + Resubmit"]
        BranchManager["Branch Manager<br/>Fork Conversation"]
        ContinueFrom["Continue From<br/>Any Message"]
        ContextWindow["Context Window<br/>Token Management"]
    end

    subgraph PresetLibrary["PRESET LIBRARY"]
        SavedPresets["Saved Presets<br/>User Collection"]
        SharedPresets["Shared Presets<br/>Team Access"]
        PublicPresets["Public Presets<br/>Community"]
        PresetCategories["Preset Categories<br/>Organization"]
    end

    subgraph SwitchingLogic["PRESET SWITCHING"]
        MidChatSwitch["Mid-Chat Switch<br/>Change Provider"]
        PresetInheritance["Preset Inheritance<br/>Override Settings"]
        DefaultPreset["Default Preset<br/>User Preference"]
    end

    PresetBuilder --> ProviderConfig
    ProviderConfig --> ParameterEditor
    ParameterEditor --> PromptTemplate
    
    PresetCreation --> ContextControls
    MessageEditor --> BranchManager
    BranchManager --> ContinueFrom
    ContinueFrom --> ContextWindow
    
    PresetCreation --> PresetLibrary
    SavedPresets --> SharedPresets
    SharedPresets --> PublicPresets
    PublicPresets --> PresetCategories
    
    PresetLibrary --> SwitchingLogic
    MidChatSwitch --> PresetInheritance
    PresetInheritance --> DefaultPreset

    style PresetCreation fill:#1976d2,color:#ffffff
    style ContextControls fill:#f9a825,color:#000000
    style PresetLibrary fill:#388e3c,color:#ffffff
    style SwitchingLogic fill:#512da8,color:#ffffff
```

## Key Design Principles

### 1. Provider Agnostic
- Unified interface for all AI providers
- Easy switching between providers mid-conversation
- Custom endpoint support for any OpenAI-compatible API

### 2. Advanced Context Control
- Conversation branching at any message
- Edit and resubmit with context preservation
- Token management and optimization

### 3. Agent Marketplace
- No-code agent creation for non-technical users
- Community sharing with permission controls
- MCP protocol for extensible tool integration

### 4. Secure Execution
- Sandboxed code interpreter with resource limits
- Multiple language runtime support
- File I/O with security scanning

### 5. Multi-modal Intelligence
- Vision support for image understanding
- File chat with RAG for document Q&A
- Image generation with multiple providers

### 6. Generative UI
- React, HTML, and Mermaid artifact generation
- Live preview with isolation
- Export and share capabilities

## Technology Stack

- **Frontend**: React 18, Next.js, TypeScript, TailwindCSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (primary), PostgreSQL (alternative)
- **State Management**: Recoil, React Query
- **Authentication**: Passport.js, JWT, OAuth2
- **AI Providers**: OpenAI, Anthropic, Google, Azure, AWS Bedrock, Vertex AI
- **Vector Database**: MongoDB Atlas Search, Pinecone
- **Code Execution**: Docker containers, isolated runtimes
- **Web Search**: Google, Bing, DuckDuckGo with Jina reranking
- **Image Generation**: DALL-E, Stable Diffusion, Flux, GPT-Image
- **MCP**: Model Context Protocol client integration

## File Organization

```
LibreChat/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom hooks
│   │   ├── store/         # Recoil state
│   │   └── utils/         # Client utilities
├── api/                   # Backend services
│   ├── server/            # Express server
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # Business logic
│   │   ├── services/      # Core services
│   │   └── middleware/    # Middleware stack
│   ├── app/               # Application core
│   │   └── clients/       # Provider clients
│   ├── models/            # Database models
│   └── lib/               # Shared libraries
├── packages/              # Monorepo packages
│   ├── data-provider/     # Data access layer
│   └── ui/                # Shared UI components
├── config/                # Configuration files
├── utils/                 # Build utilities
└── librechat.yaml         # Main config file
```

## Deployment Options

- **Docker**: docker-compose for full stack deployment
- **Railway**: One-click deployment template
- **Zeabur**: Automated deployment platform
- **Sealos**: Cloud-native deployment
- **Kubernetes**: Helm charts for cluster deployment
- **Bare Metal**: Manual installation on Linux/Mac

---

This architecture enables LibreChat to function as a comprehensive, ChatGPT-enhanced alternative with multi-provider support, advanced agent capabilities, secure code execution, and enterprise-grade features while maintaining full user control over data and infrastructure.
