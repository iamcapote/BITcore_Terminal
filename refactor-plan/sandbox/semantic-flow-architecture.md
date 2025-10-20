<!--
Why: Document Semantic Flow's context engineering canvas so contributors understand how it enables composable structured context design with explicit semantic nodes and multi-format support.
What: Visualizes the node ontology, canvas architecture, AI provider routing, and export system that make Semantic Flow a visual workspace for precision AI context composition.
How: Uses Mermaid diagrams to show the Win95-style UI, node types, provider integrations, and the patterns that enable deliberate context design with portable exports.
-->

# Semantic Flow System Architecture

## Overview

Semantic Flow is an open-source Context Engineering Canvas—a visual workspace for composing precise, interlinked semantic nodes with explicit fields and formats. You design the context; the model consumes a clean, inspectable structure you can export or execute. Nothing sensitive is persisted server-side (BYOK).

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT (Win95 Suite)"]
        Builder["Builder<br/>Visual Canvas (React Flow)"]
        IDE["IDE<br/>Text Editor"]
        Router["Router/API Console<br/>Provider Requests"]
        Console["Console<br/>Quick Actions"]
        Admin["Admin<br/>Settings"]
        Chat["Chat<br/>Mock Prototype"]
        Learn["Learn<br/>Documentation"]
    end

    subgraph CanvasEngine["CANVAS ENGINE"]
        ReactFlow["React Flow<br/>Node Graph"]
        NodeRegistry["Node Registry<br/>100+ Node Types"]
        EdgeSystem["Edge System<br/>References"]
        LayoutEngine["Layout Engine<br/>Auto-arrange"]
    end

    subgraph Ontology["SEMANTIC ONTOLOGY"]
        Clusters["17+ Clusters<br/>Specialized Types"]
        Proposition["Proposition (PROP)<br/>Assertions"]
        Inquiry["Inquiry (INQ)<br/>Questions"]
        Reasoning["Reasoning (RSN)<br/>Logic"]
        Cognitive["Cognitive (COG)<br/>Planning"]
        Creative["Creative (CRT)<br/>Synthesis"]
        Control["Control (CTL)<br/>Flow"]
        AgentCluster["Agent (AGT)<br/>Personas"]
        RAGCluster["RAG (RAG)<br/>Retrieval"]
    end

    subgraph NodeModel["NODE MODEL"]
        NodeCore["Node Core<br/>ID, Type, Position"]
        NodeFields["Node Fields<br/>Title, Description, Params"]
        LanguageMode["Language Mode<br/>JSON/YAML/XML/Markdown"]
        FieldSerialization["Field Serialization<br/>Format Conversion"]
    end

    subgraph ProviderSystem["PROVIDER SYSTEM"]
        ProviderRegistry["Provider Registry<br/>5 Providers"]
        OpenAI["OpenAI<br/>GPT Models"]
        OpenRouter["OpenRouter<br/>Multi-Provider"]
        Venice["Venice AI<br/>Custom Models"]
        Nous["Nous<br/>Hermes Models"]
        Morpheus["Morpheus<br/>Specialized"]
        KeyManager["Key Manager<br/>SessionStorage"]
    end

    subgraph ExecutionEngine["EXECUTION ENGINE"]
        WorkflowExecutor["Workflow Executor<br/>Sequential Nodes"]
        PromptBuilder["Prompt Builder<br/>Context Assembly"]
        StreamHandler["Stream Handler<br/>SSE"]
        ResponseCapture["Response Capture<br/>Results"]
    end

    subgraph ExportSystem["EXPORT SYSTEM"]
        JSONExport["JSON Export<br/>Structured"]
        YAMLExport["YAML Export<br/>Human Readable"]
        MarkdownExport["Markdown Export<br/>Narrative"]
        XMLExport["XML Export<br/>Standard"]
        Sanitizer["Sanitizer<br/>Clean Data"]
    end

    subgraph Integration["INTEGRATION"]
        DiscourseSSO["Discourse SSO<br/>Authentication"]
        DiscourseSeed["Discourse Seed<br/>Topic Import"]
        DiscoursePersona["Discourse Persona<br/>AI Proxy"]
        DiscourseAPI["Discourse API<br/>Read Topics/PMs"]
    end

    subgraph Security["SECURITY"]
        BYOK["BYOK<br/>Bring Your Own Key"]
        SessionStorage["Session Storage<br/>Encrypted Keys"]
        CSRFProtection["CSRF Protection<br/>Double Submit"]
        HTTPOnly["HttpOnly Cookies<br/>Session"]
        HMACVerify["HMAC Verify<br/>Webhooks"]
    end

    Builder --> CanvasEngine
    IDE --> CanvasEngine
    Router --> ExecutionEngine
    Console --> ExportSystem
    Admin --> ProviderSystem
    
    ReactFlow --> NodeRegistry
    NodeRegistry --> Ontology
    EdgeSystem --> NodeModel
    
    Clusters --> Proposition
    Clusters --> Inquiry
    Clusters --> Reasoning
    Clusters --> Cognitive
    Clusters --> Creative
    Clusters --> Control
    Clusters --> AgentCluster
    Clusters --> RAGCluster
    
    NodeCore --> NodeFields
    NodeFields --> LanguageMode
    LanguageMode --> FieldSerialization
    
    ProviderRegistry --> KeyManager
    OpenAI --> KeyManager
    OpenRouter --> KeyManager
    Venice --> KeyManager
    Nous --> KeyManager
    Morpheus --> KeyManager
    
    WorkflowExecutor --> PromptBuilder
    PromptBuilder --> ProviderRegistry
    ProviderRegistry --> StreamHandler
    StreamHandler --> ResponseCapture
    
    CanvasEngine --> ExportSystem
    Sanitizer --> JSONExport
    Sanitizer --> YAMLExport
    Sanitizer --> MarkdownExport
    Sanitizer --> XMLExport
    
    DiscourseSSO --> Integration
    DiscourseSeed --> Integration
    DiscoursePersona --> Integration
    DiscourseAPI --> Integration
    
    KeyManager --> Security
    SessionStorage --> Security
    CSRFProtection --> Security

    style Client fill:#1976d2,color:#ffffff
    style CanvasEngine fill:#f9a825,color:#000000
    style Ontology fill:#512da8,color:#ffffff
    style NodeModel fill:#388e3c,color:#ffffff
    style ProviderSystem fill:#d32f2f,color:#ffffff
    style ExecutionEngine fill:#e64a19,color:#ffffff
    style ExportSystem fill:#00796b,color:#ffffff
    style Integration fill:#7b1fa2,color:#ffffff
    style Security fill:#c2185b,color:#ffffff
```

## Node Ontology (Semantic Clusters)

```mermaid
graph TB
    subgraph Core["CORE REASONING"]
        PROP["PROP<br/>Proposition<br/>Assertions"]
        INQ["INQ<br/>Inquiry<br/>Questions"]
        RSN["RSN<br/>Reasoning<br/>Deduction/Induction"]
        EVL["EVL<br/>Evaluation<br/>Quality Gates"]
    end

    subgraph Scientific["SCIENTIFIC METHOD"]
        HEM["HEM<br/>Hypothesis/Evidence/Method<br/>Scientific Process"]
        MTH["MTH<br/>Mathematical<br/>Proofs"]
    end

    subgraph Communication["COMMUNICATION"]
        SPA["SPA<br/>Speech-Act<br/>Intents"]
        DSC["DSC<br/>Discourse<br/>Threading"]
        ARG["ARG<br/>Argumentation<br/>Rhetoric"]
    end

    subgraph Cognition["COGNITION"]
        COG["COG<br/>Cognitive<br/>Planning/Goals"]
        MND["MND<br/>Mind<br/>Mental States"]
        MOD["MOD<br/>Modal<br/>Belief/Intent"]
    end

    subgraph Creative["CREATIVE"]
        CRT["CRT<br/>Creative<br/>Synthesis"]
        DYN["DYN<br/>Dynamic<br/>Adaptation"]
        NCL["NCL<br/>Non-Classical<br/>Alt Logic"]
    end

    subgraph Control["CONTROL"]
        CTL["CTL<br/>Control<br/>Flow/Branching"]
        ERR["ERR<br/>Error<br/>Exception Handling"]
    end

    subgraph AIAgent["AI/AGENT"]
        AGT["AGT<br/>Agents<br/>Personas/Roles"]
        RAG["RAG<br/>Retrieval<br/>Indexing/Search"]
        LLM["LLM<br/>Language Models<br/>Prompting"]
        AIM["AIM<br/>AI Core<br/>Models/Tasks"]
        SAF["SAF<br/>Safety<br/>Alignment"]
    end

    subgraph Tech["TECHNOLOGY"]
        CODE["CODE<br/>Coding<br/>Languages"]
        CRY["CRY<br/>Crypto/Web3<br/>Blockchain"]
        NET["NET<br/>Networks<br/>Graphs"]
        EMB["EMB<br/>Embedded<br/>Real-time"]
    end

    subgraph Science["SCIENCE"]
        BIO["BIO<br/>Bioinformatics<br/>Sequencing"]
        SYN["SYN<br/>Synthetic Bio<br/>Circuits"]
        CHE["CHE<br/>Chemistry<br/>Reactions"]
        MAT["MAT<br/>Materials<br/>Properties"]
    end

    subgraph Engineering["ENGINEERING"]
        ELE["ELE<br/>Electronics<br/>Circuits"]
        PCBX["PCBX<br/>PCB Design<br/>Manufacturing"]
        ROB["ROB<br/>Robotics<br/>Mechatronics"]
        PWR["PWR<br/>Power<br/>Conversion"]
    end

    subgraph Utility["UTILITY"]
        UTIL["UTIL<br/>Utility<br/>Blank/Metadata"]
    end

    Core --> Scientific
    Core --> Communication
    Core --> Cognition
    Core --> Creative
    Core --> Control
    
    AIAgent --> Tech
    Tech --> Science
    Science --> Engineering
    Engineering --> Utility

    style Core fill:#1976d2,color:#ffffff
    style Scientific fill:#388e3c,color:#ffffff
    style Communication fill:#f9a825,color:#000000
    style Cognition fill:#512da8,color:#ffffff
    style Creative fill:#e64a19,color:#ffffff
    style Control fill:#d32f2f,color:#ffffff
    style AIAgent fill:#7b1fa2,color:#ffffff
    style Tech fill:#00796b,color:#ffffff
    style Science fill:#689f38,color:#ffffff
    style Engineering fill:#c2185b,color:#ffffff
    style Utility fill:#757575,color:#ffffff
```

## Builder Canvas Workflow

```mermaid
sequenceDiagram
    participant User
    participant Builder as Builder Canvas
    participant NodePalette as Node Palette
    participant Inspector as Node Inspector
    participant Canvas as React Flow
    participant Store as Local Storage

    User->>Builder: Open Builder
    Builder->>Canvas: Initialize Empty
    Builder->>NodePalette: Display Clusters
    
    User->>NodePalette: Select Node Type<br/>(e.g., Proposition)
    NodePalette->>Canvas: Add Node
    Canvas->>Inspector: Open Properties
    
    User->>Inspector: Edit Fields<br/>Title, Description, Params
    Inspector->>Inspector: Choose Language Mode<br/>(JSON/YAML/XML/MD)
    Inspector->>Canvas: Update Node
    
    User->>Canvas: Drag to Connect<br/>Create Edge
    Canvas->>Canvas: Validate Connection
    Canvas->>Inspector: Show Edge Properties
    
    User->>Builder: Save Schema
    Builder->>Store: Persist Workflow
    
    User->>Builder: Export
    Builder->>Builder: Sanitize Data
    Builder->>User: Download JSON/YAML/MD/XML
```

## Router/API Console Flow

```mermaid
sequenceDiagram
    participant User
    participant Router as Router Console
    participant Workflow as Workflow Engine
    participant PromptEngine as Prompt Engine
    participant Provider as AI Provider
    participant KeyManager as Key Manager

    User->>Router: Select Workflow Nodes
    Router->>Router: Choose Provider<br/>(OpenAI, Venice, etc.)
    
    User->>KeyManager: Enter API Key<br/>(Session Only)
    KeyManager->>KeyManager: Encrypt + Store<br/>SessionStorage
    
    User->>Router: Execute Workflow
    Router->>Workflow: Start Execution
    
    loop For Each Node
        Workflow->>PromptEngine: Build Context<br/>(Serialize Node)
        PromptEngine->>PromptEngine: Format by Language Mode
        PromptEngine->>Provider: Send Request<br/>(Stream: true)
        
        Provider-->>Workflow: Stream Token
        Workflow->>Router: Display Token
    end
    
    Workflow->>Router: Execution Complete
    Router->>User: Show Full Response<br/>+ Copy/Export
```

## Provider Integration Architecture

```mermaid
graph TB
    subgraph ProviderLayer["PROVIDER LAYER"]
        ProviderRouter["Provider Router<br/>Selection Logic"]
        APIClient["API Client<br/>HTTP Fetch"]
        StreamParser["Stream Parser<br/>SSE Decoder"]
        ErrorHandler["Error Handler<br/>Retry Logic"]
    end

    subgraph Providers["PROVIDERS"]
        OpenAI["OpenAI<br/>gpt-4o, o1"]
        OpenRouter["OpenRouter<br/>Multi-Model"]
        Venice["Venice AI<br/>llama, mistral"]
        Nous["Nous<br/>hermes"]
        Morpheus["Morpheus<br/>Specialized"]
    end

    subgraph Configuration["CONFIGURATION"]
        ProviderDefaults["Provider Defaults<br/>Model, Temp"]
        UserSettings["User Settings<br/>Per-Provider"]
        KeyStorage["Key Storage<br/>Encrypted Session"]
    end

    subgraph RequestBuilder["REQUEST BUILDER"]
        ModelSelector["Model Selector<br/>Provider-specific"]
        ParameterBuilder["Parameter Builder<br/>Temp, Top-P, Max Tokens"]
        MessageFormatter["Message Formatter<br/>Chat API Format"]
    end

    ProviderRouter --> ProviderDefaults
    UserSettings --> ProviderRouter
    KeyStorage --> ProviderRouter
    
    ProviderRouter --> APIClient
    APIClient --> Providers
    
    OpenAI --> StreamParser
    OpenRouter --> StreamParser
    Venice --> StreamParser
    Nous --> StreamParser
    Morpheus --> StreamParser
    
    StreamParser --> ErrorHandler
    
    RequestBuilder --> ModelSelector
    ModelSelector --> ParameterBuilder
    ParameterBuilder --> MessageFormatter
    MessageFormatter --> APIClient

    style ProviderLayer fill:#d32f2f,color:#ffffff
    style Providers fill:#512da8,color:#ffffff
    style Configuration fill:#f9a825,color:#000000
    style RequestBuilder fill:#388e3c,color:#ffffff
```

## Node Field System

```mermaid
graph TB
    subgraph NodeStructure["NODE STRUCTURE"]
        NodeID["Node ID<br/>UUID"]
        NodeType["Node Type<br/>Cluster + Code"]
        Position["Position<br/>X, Y, Z-Index"]
        Color["Color<br/>Custom/Cluster"]
    end

    subgraph CoreFields["CORE FIELDS"]
        Title["Title<br/>Node Label"]
        Description["Description<br/>Context"]
        Parameters["Parameters<br/>Key-Value Pairs"]
        Tags["Tags<br/>Classification"]
        Examples["Examples<br/>Samples"]
        Constraints["Constraints<br/>Rules"]
    end

    subgraph LanguageModes["LANGUAGE MODES"]
        JSON["JSON Mode<br/>Structured Data"]
        YAML["YAML Mode<br/>Human Readable"]
        XML["XML Mode<br/>Standard"]
        Markdown["Markdown Mode<br/>Narrative"]
    end

    subgraph Serialization["SERIALIZATION"]
        FieldParser["Field Parser<br/>Extract Fields"]
        FormatDetector["Format Detector<br/>Auto-detect"]
        Converter["Converter<br/>Cross-format"]
        Validator["Validator<br/>Schema Check"]
    end

    subgraph AIContext["AI CONTEXT BUILDING"]
        NodeContext["Node Context<br/>Full Fields"]
        EdgeContext["Edge Context<br/>References"]
        ParentContext["Parent Context<br/>Upstream Nodes"]
        SystemPrompt["System Prompt<br/>Behavior"]
    end

    NodeStructure --> CoreFields
    CoreFields --> LanguageModes
    
    JSON --> Serialization
    YAML --> Serialization
    XML --> Serialization
    Markdown --> Serialization
    
    FieldParser --> Converter
    FormatDetector --> Converter
    Converter --> Validator
    
    CoreFields --> AIContext
    NodeContext --> EdgeContext
    EdgeContext --> ParentContext
    ParentContext --> SystemPrompt

    style NodeStructure fill:#1976d2,color:#ffffff
    style CoreFields fill:#388e3c,color:#ffffff
    style LanguageModes fill:#f9a825,color:#000000
    style Serialization fill:#512da8,color:#ffffff
    style AIContext fill:#e64a19,color:#ffffff
```

## Export System

```mermaid
graph TB
    subgraph ExportTrigger["EXPORT TRIGGER"]
        MenuAction["Menu Action<br/>File → Export"]
        FormatSelection["Format Selection<br/>JSON/YAML/MD/XML"]
        ScopeSelection["Scope Selection<br/>All/Selected"]
    end

    subgraph DataPreparation["DATA PREPARATION"]
        WorkflowCapture["Workflow Capture<br/>Nodes + Edges"]
        Sanitizer["Sanitizer<br/>Remove UI State"]
        Validator["Validator<br/>Schema Check"]
    end

    subgraph FormatConversion["FORMAT CONVERSION"]
        JSONExporter["JSON Exporter<br/>Full Structure"]
        YAMLExporter["YAML Exporter<br/>Comments"]
        MarkdownExporter["Markdown Exporter<br/>Headings + Lists"]
        XMLExporter["XML Exporter<br/>Standard"]
    end

    subgraph OutputGeneration["OUTPUT GENERATION"]
        StringSerializer["String Serializer<br/>Format-specific"]
        BlobCreator["Blob Creator<br/>File Object"]
        Downloader["Downloader<br/>Browser Download"]
    end

    subgraph Clipboard["CLIPBOARD"]
        CopyText["Copy to Clipboard<br/>Text API"]
        CopyNotification["Copy Notification<br/>Toast"]
    end

    MenuAction --> FormatSelection
    FormatSelection --> ScopeSelection
    
    ScopeSelection --> WorkflowCapture
    WorkflowCapture --> Sanitizer
    Sanitizer --> Validator
    
    Validator --> FormatConversion
    JSONExporter --> StringSerializer
    YAMLExporter --> StringSerializer
    MarkdownExporter --> StringSerializer
    XMLExporter --> StringSerializer
    
    StringSerializer --> OutputGeneration
    BlobCreator --> Downloader
    
    StringSerializer --> Clipboard
    CopyText --> CopyNotification

    style ExportTrigger fill:#1976d2,color:#ffffff
    style DataPreparation fill:#f9a825,color:#000000
    style FormatConversion fill:#388e3c,color:#ffffff
    style OutputGeneration fill:#512da8,color:#ffffff
    style Clipboard fill:#e64a19,color:#ffffff
```

## Discourse Integration

```mermaid
graph TB
    subgraph DiscourseAuth["DISCOURSE AUTH"]
        SSOLogin["SSO Login<br/>OAuth Flow"]
        SessionCreate["Session Create<br/>JWT Token"]
        UserProfile["User Profile<br/>Avatar + Name"]
    end

    subgraph DiscourseData["DISCOURSE DATA"]
        TopicBrowser["Topic Browser<br/>List Topics"]
        PMReader["PM Reader<br/>Messages"]
        CategoryFilter["Category Filter<br/>Organization"]
    end

    subgraph SeedSystem["SEED SYSTEM"]
        SeedCreate["Seed Create<br/>Topic → Node"]
        SeedImport["Seed Import<br/>Content Extract"]
        SeedLink["Seed Link<br/>Bidirectional"]
    end

    subgraph PersonaSystem["PERSONA SYSTEM"]
        PersonaLoad["Persona Load<br/>AI Persona Config"]
        PersonaProxy["Persona Proxy<br/>Server-side"]
        PersonaExecution["Persona Execution<br/>Context Injection"]
    end

    subgraph ServerProxy["SERVER PROXY"]
        ProxyAuth["Proxy Auth<br/>Verify Session"]
        ProxyRequest["Proxy Request<br/>Discourse API"]
        ProxyCache["Proxy Cache<br/>Topic Data"]
    end

    SSOLogin --> SessionCreate
    SessionCreate --> UserProfile
    
    UserProfile --> DiscourseData
    TopicBrowser --> CategoryFilter
    PMReader --> CategoryFilter
    
    TopicBrowser --> SeedSystem
    SeedCreate --> SeedImport
    SeedImport --> SeedLink
    
    PersonaLoad --> PersonaProxy
    PersonaProxy --> ProxyAuth
    ProxyAuth --> ProxyRequest
    ProxyRequest --> ProxyCache
    ProxyCache --> PersonaExecution

    style DiscourseAuth fill:#1976d2,color:#ffffff
    style DiscourseData fill:#388e3c,color:#ffffff
    style SeedSystem fill:#f9a825,color:#000000
    style PersonaSystem fill:#512da8,color:#ffffff
    style ServerProxy fill:#7b1fa2,color:#ffffff
```

## Security Model

```mermaid
graph TB
    subgraph BYOK["BRING YOUR OWN KEY"]
        KeyInput["Key Input<br/>User Prompt"]
        KeyEncrypt["Key Encrypt<br/>CryptoJS AES"]
        SessionStore["Session Store<br/>sessionStorage"]
    end

    subgraph SessionSecurity["SESSION SECURITY"]
        HttpOnlyCookie["HttpOnly Cookie<br/>CSRF Token"]
        DoubleSubmit["Double Submit<br/>CSRF Validation"]
        SessionExpiry["Session Expiry<br/>Timeout"]
    end

    subgraph WebhookSecurity["WEBHOOK SECURITY"]
        HMACSignature["HMAC Signature<br/>SHA256"]
        SignatureVerify["Signature Verify<br/>Request Auth"]
        PayloadValidate["Payload Validate<br/>Schema Check"]
    end

    subgraph DataMinimization["DATA MINIMIZATION"]
        LocalWorkflow["Local Workflow<br/>Browser Storage"]
        NoServerPersist["No Server Persist<br/>Keys/Secrets"]
        ExportOnly["Export Only<br/>User Control"]
    end

    subgraph DiscourseIntegration["DISCOURSE INTEGRATION"]
        SSLRequired["SSL Required<br/>HTTPS Only"]
        OAuthSecure["OAuth Secure<br/>Token Exchange"]
        ProxyIsolation["Proxy Isolation<br/>Server-side"]
    end

    KeyInput --> KeyEncrypt
    KeyEncrypt --> SessionStore
    
    HttpOnlyCookie --> DoubleSubmit
    DoubleSubmit --> SessionExpiry
    
    HMACSignature --> SignatureVerify
    SignatureVerify --> PayloadValidate
    
    LocalWorkflow --> NoServerPersist
    NoServerPersist --> ExportOnly
    
    SSLRequired --> OAuthSecure
    OAuthSecure --> ProxyIsolation

    style BYOK fill:#d32f2f,color:#ffffff
    style SessionSecurity fill:#f9a825,color:#000000
    style WebhookSecurity fill:#388e3c,color:#ffffff
    style DataMinimization fill:#512da8,color:#ffffff
    style DiscourseIntegration fill:#7b1fa2,color:#ffffff
```

## Agentic Construct Pattern

```mermaid
graph TB
    subgraph AgentSchema["AGENT SCHEMA"]
        Persona["Persona Node<br/>Role + Identity"]
        Policies["Policy Nodes<br/>Constraints"]
        Tools["Tool Nodes<br/>Functions"]
        Memory["Memory Nodes<br/>Seeds/Context"]
    end

    subgraph Composition["COMPOSITION"]
        PersonaEdges["Persona → Policies<br/>Behavior Rules"]
        PolicyEdges["Policies → Tools<br/>Allowed Actions"]
        ToolEdges["Tools → Memory<br/>Context Access"]
    end

    subgraph Execution["EXECUTION"]
        ContextAssembly["Context Assembly<br/>Aggregate Nodes"]
        PromptInjection["Prompt Injection<br/>System + User"]
        StreamResponse["Stream Response<br/>LLM Output"]
    end

    subgraph Examples["EXAMPLES"]
        ResearchAgent["Research Agent<br/>Persona + Search Tools"]
        CodeReviewer["Code Reviewer<br/>Policies + Linters"]
        CreativeWriter["Creative Writer<br/>Memory + Style"]
    end

    Persona --> PersonaEdges
    Policies --> PersonaEdges
    PersonaEdges --> PolicyEdges
    Tools --> PolicyEdges
    PolicyEdges --> ToolEdges
    Memory --> ToolEdges
    
    ToolEdges --> ContextAssembly
    ContextAssembly --> PromptInjection
    PromptInjection --> StreamResponse
    
    StreamResponse --> Examples

    style AgentSchema fill:#f9a825,color:#000000
    style Composition fill:#388e3c,color:#ffffff
    style Execution fill:#512da8,color:#ffffff
    style Examples fill:#e64a19,color:#ffffff
```

## Key Design Principles

### 1. Context Engineering First
- Design context deliberately before execution
- Visual canvas for inspecting structure
- Edges express reference, not execution order

### 2. Multi-Format Nodes
- JSON for structured data
- YAML for human-readable config
- XML for standard interchange
- Markdown for narrative

### 3. Semantic Ontology
- 17+ clusters with 100+ node types
- Covers reasoning, cognition, communication, science, engineering, AI
- Extensible and composable

### 4. BYOK Philosophy
- Keys only in sessionStorage (encrypted)
- No server-side persistence of secrets
- User controls all sensitive data

### 5. Portable by Design
- Export to JSON, YAML, Markdown, XML
- Import/export round-trips
- Interoperable with other tools

### 6. Win95 Suite
- Builder, IDE, Router, Console, Chat, Admin, Learn
- Unified retro-modern aesthetic
- Context design as visual reasoning

## Technology Stack

- **Frontend**: React 18, Vite, TypeScript
- **Canvas**: React Flow (node graph)
- **UI**: Win95 CSS theme, custom components
- **State**: React Context + Local Storage
- **Security**: CryptoJS (AES), HttpOnly cookies, CSRF
- **Providers**: OpenAI, OpenRouter, Venice, Nous, Morpheus
- **Server**: Node.js (optional proxy for Discourse)
- **Discourse**: SSO (OAuth), API (topics/PMs)
- **Export**: js-yaml, fast-xml-parser

## File Organization

```
semantic_flow/
├── src/
│   ├── App.jsx                 # Main app shell
│   ├── main.jsx                # Entry point
│   ├── nav-items.jsx           # Navigation
│   ├── components/
│   │   └── ui/                 # UI components
│   ├── pages/
│   │   ├── Builder.jsx         # Canvas page
│   │   ├── IDE.jsx             # Text editor
│   │   ├── Router.jsx          # API console
│   │   ├── Console.jsx         # Quick actions
│   │   ├── Admin.jsx           # Settings
│   │   ├── Chat.jsx            # Mock chat
│   │   └── Learn.jsx           # Docs
│   ├── lib/
│   │   ├── ontology.js         # Node types
│   │   ├── graphSchema.js      # Schema logic
│   │   ├── nodeModel.js        # Node model
│   │   ├── exportUtils.js      # Export logic
│   │   ├── formatUtils.js      # Format conversion
│   │   ├── promptingEngine.js  # Execution engine
│   │   ├── aiRouter.js         # Provider router
│   │   ├── security.js         # Key management
│   │   └── auth.js             # Discourse SSO
│   └── utils/
│       └── debugNav.js         # Navigation helpers
├── server/
│   ├── app.js                  # Express server
│   └── index.js                # Server entry
├── public/
└── deployment.md               # Deployment guide
```

---

This architecture enables Semantic Flow to function as a visual reasoning engine for context design, where users compose explicit, typed semantic nodes that can be exported, shared, or executed against AI providers with full transparency and control.
