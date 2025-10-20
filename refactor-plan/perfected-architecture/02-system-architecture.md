<!--
Why: Present the layered architecture that binds interfaces, agents, environments, and persistence so contributors share a mental model before implementation.
What: Visualizes each layer, the flow of control, and the persistent systems that keep BITcore missions cohesive.
How: Uses Mermaid diagrams to show component boundaries and interaction channels that every module must respect.
-->

# System Architecture

## Current System Architecture

```mermaid
graph TB
    subgraph Client["CLIENT LAYER"]
        WebTerminal["Web Terminal<br/>XTerm.js + Command Parser"]
        CLI["Native CLI<br/>Readline REPL"]
    end

    subgraph Transport["TRANSPORT LAYER"]
        WSS["WebSocket Server<br/>/api/research/ws"]
        HTTP["HTTP Routes<br/>Express Router"]
    end

    subgraph Session["SESSION MANAGEMENT"]
        SessionStore["Session Store<br/>ID, User, State, History"]
        CSRF["CSRF Token<br/>Validation"]
        RateLimit["Rate Limiter<br/>5 req/sec default"]
    end

    subgraph MessageRouter["MESSAGE ROUTING"]
        ConnectionHandler["Connection Handler<br/>Lifecycle Management"]
        CommandHandler["Command Handler<br/>Slash Commands"]
        ChatHandler["Chat Handler<br/>Conversational Mode"]
        InputHandler["Input Handler<br/>Prompt Responses"]
    end

    subgraph Commands["COMMAND REGISTRY"]
        ResearchCmd["/research<br/>Deep Research"]
        ChatCmd["/chat<br/>Toggle Chat Mode"]
        MemoryCmd["/memory<br/>Recall/Store"]
        KeysCmd["/keys<br/>API Key Management"]
        StatusCmd["/status<br/>System Health"]
        MissionsCmd["/missions<br/>Task Scheduler"]
    end

    subgraph Features["FEATURE CONTROLLERS"]
        ResearchCtrl["Research Controller"]
        MemoryCtrl["Memory Controller"]
        ChatCtrl["Chat History Controller"]
        StatusCtrl["Status Controller"]
        MissionsCtrl["Missions Controller"]
        PromptsCtrl["Prompts Controller"]
    end

    subgraph Infrastructure["INFRASTRUCTURE LAYER"]
        direction TB
        
        subgraph AI["AI Services"]
            VeniceLLM["Venice LLM Client<br/>Chat Completions"]
            LangChainModel["LangChain Wrapper<br/>VeniceChatModel"]
            LangGraphJS["LangGraph.js<br/>State Machine + Workflows"]
            Chains["LangChain Chains<br/>QueryGeneration"]
        end
        
        subgraph Research["Research Engine"]
            ResearchEngine["Research Engine<br/>Orchestrator"]
            ResearchPath["Research Path<br/>Query Execution"]
            OverrideRunner["Override Runner<br/>Custom Queries"]
        end
        
        subgraph Search["Search Providers"]
            BraveSearch["Brave Search<br/>Web + News"]
            SearchMux["Search Multiplexer<br/>Provider Abstraction"]
        end
        
        subgraph Memory["Memory System"]
            MemoryManager["Memory Manager<br/>Short/Long Term"]
            MemoryStore["Memory Store<br/>Ephemeral + Validated"]
            MemoryValidators["Memory Validators<br/>Schema Guards"]
            GithubMemory["GitHub Integration<br/>Persistence"]
        end
    end

    subgraph Persistence["PERSISTENCE LAYER"]
        FileSystem["File System<br/>JSON Archives"]
        GithubRepo["GitHub Repository<br/>Missions, Memories, Prompts"]
        ConfigStore["Encrypted Config<br/>API Keys AES-256"]
    end

    WebTerminal -->|"WebSocket<br/>Commands, Chat, Input"| WSS
    CLI -->|"Direct Function Calls"| Commands
    
    WSS <--> SessionStore
    HTTP <--> SessionStore
    
    SessionStore --> CSRF
    SessionStore --> RateLimit
    
    WSS --> ConnectionHandler
    ConnectionHandler --> CommandHandler
    ConnectionHandler --> ChatHandler
    ConnectionHandler --> InputHandler
    
    CommandHandler --> Commands
    ChatHandler --> ChatCtrl
    InputHandler <--> SessionStore
    
    ResearchCmd --> ResearchCtrl
    ChatCmd --> ChatCtrl
    MemoryCmd --> MemoryCtrl
    KeysCmd <--> ConfigStore
    StatusCmd --> StatusCtrl
    MissionsCmd --> MissionsCtrl
    
    ResearchCtrl --> ResearchEngine
    ResearchCtrl <--> MemoryManager
    
    MemoryCtrl <--> MemoryManager
    ChatCtrl --> VeniceLLM
    ChatCtrl <--> MemoryManager
    
    ResearchEngine --> VeniceLLM
    ResearchEngine --> LangChainModel
    ResearchEngine --> Chains
    ResearchEngine --> ResearchPath
    ResearchEngine --> OverrideRunner
    
    ResearchPath --> SearchMux
    ResearchPath --> VeniceLLM
    
    SearchMux --> BraveSearch
    
    VeniceLLM -.->|"HTTP API"| ExternalVenice["Venice API<br/>External"]
    BraveSearch -.->|"HTTP API"| ExternalBrave["Brave API<br/>External"]
    
    MemoryManager <--> MemoryStore
    MemoryManager --> MemoryValidators
    MemoryManager <--> GithubMemory
    
    MissionsCtrl <--> FileSystem
    MissionsCtrl <--> GithubRepo
    PromptsCtrl <--> GithubRepo
    ConfigStore <--> FileSystem
    MemoryManager <--> FileSystem
    
    GithubMemory <--> GithubRepo

    style Client fill:#1976d2,color:#ffffff
    style Transport fill:#7b1fa2,color:#ffffff
    style Session fill:#f57c00,color:#ffffff
    style MessageRouter fill:#c2185b,color:#ffffff
    style Commands fill:#388e3c,color:#ffffff
    style Features fill:#f9a825,color:#000000
    style Infrastructure fill:#0288d1,color:#ffffff
    style Persistence fill:#689f38,color:#ffffff
    style AI fill:#512da8,color:#ffffff
    style Research fill:#d32f2f,color:#ffffff
    style Search fill:#00796b,color:#ffffff
    style Memory fill:#e64a19,color:#ffffff
```

## Target Agent-Based Architecture

```mermaid
graph TB
    subgraph Client["CLIENT INTERFACES"]
        WebUI["Web Terminal"]
        NativeCLI["Native CLI"]
        RESTAPI["REST API Clients"]
    end

    subgraph Gateway["API GATEWAY"]
        WSGateway["WebSocket Gateway<br/>Message Router"]
        HTTPGateway["HTTP Gateway<br/>REST Endpoints"]
        AuthLayer["Auth Middleware<br/>Session + CSRF + Rate Limit"]
    end

    subgraph AgentOrch["AGENT ORCHESTRATION CORE"]
        AgentContext["Agent Context<br/>Shared State, Event Bus, Tool Registry"]
        
        subgraph AgentHierarchy["Agent Hierarchy"]
            CoordAgent["Coordinator Agent<br/>Task Decomposition"]
            PlanAgent["Planner Agent<br/>Strategy Generation"]
            ExecAgents["Execution Agents<br/>Researcher, Coder, Analyst"]
            ReportAgent["Reporter Agent<br/>Synthesis"]
        end
        
        subgraph AgentProfile["Agent Profiles"]
            ResearchProfile["Research Specialist"]
            CodeProfile["Code Specialist"]
            AnalystProfile["Data Analyst"]
            ValidatorProfile["Fact Checker"]
        end
    end

    subgraph Tools["TOOL REGISTRY"]
        SearchTool["Search Tool<br/>Brave, DuckDuckGo"]
        MemoryTool["Memory Tool<br/>Recall, Store"]
        CodeTool["Code Execution<br/>REPL, Shell"]
        FileTool["File Operations<br/>Read, Write, Search"]
        WebTool["Web Scraper<br/>HTML, Markdown"]
        CustomTool["Custom Tools<br/>Plugin System"]
    end

    subgraph Infrastructure["INFRASTRUCTURE SERVICES"]
        direction TB
        
        subgraph LLM["LLM Services"]
            VeniceClient["Venice Client"]
            LangChainWrap["LangChain Wrapper"]
            PromptEngine["Prompt Template Engine"]
        end
        
        subgraph MemSys["Memory System"]
            WorkingMem["Working Memory<br/>Graphology In-Memory"]
            LongTermMem["Long-Term Memory<br/>FAISS Vector Store"]
            OntologyMem["Ontology Memory<br/>External Knowledge Graph"]
            MemConsolidate["Memory Consolidator<br/>Periodic Cleanup"]
        end
        
        subgraph Compute["Compute Environment"]
            ContainerMgr["Container Manager<br/>Docker/Podman"]
            EnvProfiles["Environment Profiles<br/>Kali, Debian, Alpine, Custom"]
            IsolationLayer["Process Isolation<br/>Security Sandbox"]
        end
    end

    subgraph Storage["STORAGE LAYER"]
        FileStore["File System<br/>Missions, Archives"]
        VectorDB["Vector Database<br/>FAISS Index"]
        GraphDB["Graph Database<br/>Neo4j/Janus Optional"]
        ConfigVault["Config Vault<br/>Encrypted Secrets"]
        GitSync["GitHub Sync<br/>Backup + Collaboration"]
    end

    subgraph Telemetry["TELEMETRY & MONITORING"]
        EventBus["Event Bus<br/>Agent Lifecycle"]
        Metrics["Metrics Collector<br/>Performance, Usage"]
        Logging["Structured Logging<br/>Correlation IDs"]
        Tracing["Trace Visualization<br/>Agent Execution Graph"]
    end

    WebUI --> WSGateway
    NativeCLI --> AgentContext
    RESTAPI --> HTTPGateway
    
    WSGateway --> AuthLayer
    HTTPGateway --> AuthLayer
    
    AuthLayer --> AgentContext
    
    AgentContext <--> CoordAgent
    AgentContext <--> Tools
    AgentContext <--> EventBus
    
    CoordAgent <--> PlanAgent
    PlanAgent <--> ExecAgents
    ExecAgents <--> ReportAgent
    
    CoordAgent -.->|"Loads"| AgentProfile
    PlanAgent -.->|"Loads"| AgentProfile
    ExecAgents -.->|"Loads"| AgentProfile
    
    ExecAgents <--> SearchTool
    ExecAgents <--> MemoryTool
    ExecAgents <--> CodeTool
    ExecAgents <--> FileTool
    ExecAgents <--> WebTool
    ExecAgents <--> CustomTool
    
    SearchTool --> VeniceClient
    MemoryTool <--> MemSys
    CodeTool <--> Compute
    FileTool <--> FileStore
    WebTool --> VeniceClient
    
    CoordAgent --> VeniceClient
    PlanAgent --> LangChainWrap
    ExecAgents --> LangChainWrap
    ReportAgent --> PromptEngine
    
    LangChainWrap --> VeniceClient
    PromptEngine --> VeniceClient
    
    WorkingMem <--> MemConsolidate
    LongTermMem <--> MemConsolidate
    MemConsolidate <--> OntologyMem
    
    WorkingMem <--> VectorDB
    LongTermMem <--> VectorDB
    OntologyMem -.->|"Optional"| GraphDB
    
    ContainerMgr --> EnvProfiles
    EnvProfiles --> IsolationLayer
    
    Tools <--> ConfigVault
    AgentContext <--> FileStore
    MemSys <--> FileStore
    FileStore <--> GitSync
    
    AgentContext --> EventBus
    Tools --> Metrics
    Infrastructure --> Logging
    EventBus --> Tracing

    style Client fill:#1976d2,color:#ffffff
    style Gateway fill:#7b1fa2,color:#ffffff
    style AgentOrch fill:#f9a825,color:#000000
    style Tools fill:#388e3c,color:#ffffff
    style Infrastructure fill:#0288d1,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
    style Telemetry fill:#5d4037,color:#ffffff
    style LLM fill:#d32f2f,color:#ffffff
    style MemSys fill:#e64a19,color:#ffffff
    style Compute fill:#00796b,color:#ffffff
```

## Data Flow: Research Request

```mermaid
sequenceDiagram
    participant User
    participant WebTerminal
    participant WSGateway
    participant CommandHandler
    participant ResearchCtrl
    participant ResearchEngine
    participant ResearchPath
    participant SearchProvider
    participant VeniceLLM
    participant MemoryManager
    participant FileSystem

    User->>WebTerminal: /research quantum computing --depth=3
    WebTerminal->>WSGateway: WebSocket Message<br/>type: command
    WSGateway->>WSGateway: Validate CSRF + Rate Limit
    WSGateway->>CommandHandler: Route Command
    CommandHandler->>CommandHandler: Parse Args
    CommandHandler->>ResearchCtrl: executeResearch(options)
    
    ResearchCtrl->>VeniceLLM: Generate Queries
    VeniceLLM-->>ResearchCtrl: queries: ["quantum algorithms", "quantum hardware", "quantum applications"]
    
    loop For Each Query
        ResearchCtrl->>ResearchEngine: research(query, depth, breadth)
        ResearchEngine->>ResearchPath: execute(query)
        
        ResearchPath->>SearchProvider: search(query)
        SearchProvider-->>ResearchPath: results[]
        
        ResearchPath->>VeniceLLM: summarize(results)
        VeniceLLM-->>ResearchPath: summary + learnings
        
        ResearchPath->>MemoryManager: store(learnings)
        MemoryManager-->>ResearchPath: stored
        
        ResearchPath-->>ResearchEngine: pathResults
    end
    
    ResearchEngine->>VeniceLLM: generateSummary(allResults)
    VeniceLLM-->>ResearchEngine: finalSummary
    
    ResearchEngine->>FileSystem: saveMarkdown(summary)
    FileSystem-->>ResearchEngine: saved
    
    ResearchEngine-->>ResearchCtrl: outcome
    ResearchCtrl->>WSGateway: Send Progress Events
    WSGateway->>WebTerminal: Stream Output
    WebTerminal->>User: Display Results
```

## Data Flow: Agent-Based Research Request

```mermaid
sequenceDiagram
    participant User
    participant Gateway as API Gateway
    participant Auth as Auth Layer
    participant Context as Agent Context
    participant Coord as Coordinator Agent
    participant Plan as Planner Agent
    participant Exec as Execution Agents
    participant Report as Reporter Agent
    participant SearchT as Search Tool
    participant MemT as Memory Tool
    participant LLM as Venice LLM
    participant Storage as Storage Layer

    User->>Gateway: /research quantum computing --depth=3
    Gateway->>Auth: Validate Session + CSRF
    Auth-->>Gateway: Authorized
    Gateway->>Context: Initialize Task
    
    Context->>Context: Load Agent Profiles
    Context->>Coord: Delegate Task
    
    Coord->>LLM: Analyze User Intent
    LLM-->>Coord: Task Decomposition
    
    Coord->>Plan: Create Research Plan
    Plan->>LLM: Generate Strategy
    LLM-->>Plan: Multi-Step Plan
    Plan->>Plan: Break into Subtasks
    Plan-->>Coord: Research Plan
    
    Coord->>User: Present Plan for Approval
    User-->>Coord: Approved
    
    loop For Each Subtask
        Coord->>Exec: Assign Subtask
        Exec->>SearchT: Search Query
        SearchT-->>Exec: Results
        
        Exec->>LLM: Analyze Results
        LLM-->>Exec: Insights + Learnings
        
        Exec->>MemT: Store Learnings
        MemT->>Storage: Persist to Vector DB
        Storage-->>MemT: Stored
        MemT-->>Exec: Confirmation
        
        Exec-->>Coord: Subtask Complete
    end
    
    Coord->>Report: Generate Final Report
    Report->>MemT: Recall All Learnings
    MemT->>Storage: Vector Search
    Storage-->>MemT: Relevant Memories
    MemT-->>Report: Memories
    
    Report->>LLM: Synthesize Report
    LLM-->>Report: Final Document
    
    Report->>Storage: Save Markdown + Archive
    Storage-->>Report: Saved
    
    Report-->>Coord: Report Complete
    Coord->>Context: Task Finished
    Context->>Gateway: Stream Final Results
    Gateway->>User: Display Complete Research
```

## Migration Path: Current → Target

```mermaid
graph LR
    subgraph Phase1["Phase 1: Foundation"]
        P1A["BaseAgent Class"]
        P1B["Agent Context"]
        P1C["Tool Interface"]
    end
    
    subgraph Phase2["Phase 2: Tool Migration"]
        P2A["Search Tool"]
        P2B["Memory Tool"]
        P2C["Code Tool"]
    end
    
    subgraph Phase3["Phase 3: Agent Profiles"]
        P3A["Research Agent"]
        P3B["Planner Agent"]
        P3C["Coordinator Agent"]
    end
    
    subgraph Phase4["Phase 4: Advanced Features"]
        P4A["Computer Environment"]
        P4B["Vector Memory"]
        P4C["Ontology Sync"]
    end
    
    subgraph Phase5["Phase 5: Full Replacement"]
        P5A["Feature Flags Off"]
        P5B["Legacy Code Removal"]
        P5C["Production Rollout"]
    end
    
    Current["Current System<br/>Direct LLM + ResearchEngine"]
    
    Current --> P1A
    P1A --> P1B
    P1B --> P1C
    
    P1C --> P2A
    P2A --> P2B
    P2B --> P2C
    
    P2C --> P3A
    P3A --> P3B
    P3B --> P3C
    
    P3C --> P4A
    P4A --> P4B
    P4B --> P4C
    
    P4C --> P5A
    P5A --> P5B
    P5B --> P5C
    
    P5C --> Target["Target System<br/>Agent-Based Architecture"]
    
    style Current fill:#d32f2f,color:#ffffff
    style Target fill:#388e3c,color:#ffffff
    style Phase1 fill:#f57c00,color:#000000
    style Phase2 fill:#f9a825,color:#000000
    style Phase3 fill:#7b1fa2,color:#ffffff
    style Phase4 fill:#512da8,color:#ffffff
    style Phase5 fill:#0288d1,color:#ffffff
```
