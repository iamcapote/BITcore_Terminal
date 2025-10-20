<!--
Why: Document DeerFlow's LangGraph-based deep research architecture so contributors understand how agents coordinate, conduct research, and produce comprehensive reports.
What: Visualizes the state graph, agent hierarchy, tool ecosystem, and workflow orchestration that enable systematic deep research with web search, crawling, and code execution.
How: Uses Mermaid diagrams to show the LangGraph state machine, agent collaboration patterns, and the data flows that produce research reports and podcasts.
-->

# DeerFlow System Architecture

## Overview

DeerFlow (Deep Exploration and Efficient Research Flow) is a LangGraph-based deep research framework that orchestrates multiple specialized agents to conduct systematic research, generate comprehensive reports, and create multimedia content like podcasts and presentations.

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT INTERFACES"]
        ConsoleUI["Console UI<br/>Interactive CLI"]
        WebUI["Web UI<br/>Node.js + React"]
        API["HTTP API<br/>FastAPI Server"]
    end

    subgraph StateMachine["LANGGRAPH STATE MACHINE"]
        StateGraph["State Graph<br/>Workflow Orchestration"]
        StateObject["State Object<br/>Shared Context"]
        CheckpointSaver["Checkpoint Saver<br/>Memory Persistence"]
    end

    subgraph AgentNodes["AGENT NODES"]
        Coordinator["Coordinator<br/>Task Analysis + Clarification"]
        BackgroundInvestigator["Background Investigator<br/>Pre-research Context"]
        Planner["Planner<br/>Step Generation"]
        Researcher["Researcher<br/>Web Search + Analysis"]
        Coder["Coder<br/>Data Processing"]
        Reporter["Reporter<br/>Report Synthesis"]
        HumanFeedback["Human Feedback<br/>Plan Approval"]
    end

    subgraph ResearchTeam["RESEARCH TEAM SUB-GRAPH"]
        TeamCoordinator["Team Coordinator<br/>Step Assignment"]
        StepExecutor["Step Executor<br/>Researcher/Coder"]
        ResultAggregator["Result Aggregator<br/>Synthesis"]
    end

    subgraph ToolRegistry["TOOL REGISTRY"]
        SearchTools["Search Tools<br/>Tavily, Brave, DuckDuckGo"]
        CrawlerTools["Crawler Tools<br/>Firecrawl, Jina"]
        CodeTools["Code Tools<br/>Python REPL"]
        MCPTools["MCP Tools<br/>External Services"]
        FileTools["File Tools<br/>Read/Write"]
    end

    subgraph LLMLayer["LLM ORCHESTRATION"]
        PrimaryLLM["Primary LLM<br/>Complex Tasks"]
        FastLLM["Fast LLM<br/>Quick Tasks"]
        VisionLLM["Vision LLM<br/>Image Analysis"]
        LLMRouter["LLM Router<br/>Agent-Type Mapping"]
        
        LLMRouter --> PrimaryLLM
        LLMRouter --> FastLLM
        LLMRouter --> VisionLLM
    end

    subgraph OutputGenerators["OUTPUT GENERATORS"]
        MarkdownReport["Markdown Report<br/>Formatted Document"]
        PodcastGen["Podcast Generator<br/>TTS Synthesis"]
        PPTGen["PPT Generator<br/>Marp Slides"]
        ImageGen["Image Generator<br/>Visual Content"]
    end

    subgraph Config["CONFIGURATION"]
        YAMLConfig["conf.yaml<br/>LLM + Agent Config"]
        EnvVars[".env<br/>API Keys"]
        AgentMapping["Agent Mapping<br/>LLM Assignment"]
    end

    ConsoleUI --> StateMachine
    WebUI --> API
    API --> StateMachine
    
    StateMachine --> StateGraph
    StateGraph --> StateObject
    StateObject --> CheckpointSaver
    
    StateGraph --> AgentNodes
    
    Coordinator --> BackgroundInvestigator
    BackgroundInvestigator --> Planner
    Planner --> HumanFeedback
    HumanFeedback --> ResearchTeam
    ResearchTeam --> Reporter
    
    ResearchTeam --> TeamCoordinator
    TeamCoordinator --> StepExecutor
    StepExecutor --> ResultAggregator
    
    Researcher --> ToolRegistry
    Coder --> ToolRegistry
    BackgroundInvestigator --> SearchTools
    
    AgentNodes --> LLMLayer
    LLMRouter --> Config
    
    Reporter --> OutputGenerators
    MarkdownReport --> PodcastGen
    MarkdownReport --> PPTGen

    style Client fill:#1976d2,color:#ffffff
    style StateMachine fill:#f9a825,color:#000000
    style AgentNodes fill:#512da8,color:#ffffff
    style ResearchTeam fill:#7b1fa2,color:#ffffff
    style ToolRegistry fill:#388e3c,color:#ffffff
    style LLMLayer fill:#d32f2f,color:#ffffff
    style OutputGenerators fill:#e64a19,color:#ffffff
    style Config fill:#00796b,color:#ffffff
```

## LangGraph Workflow State Machine

```mermaid
stateDiagram-v2
    [*] --> Coordinator
    
    Coordinator --> Coordinator : Clarification Loop
    Coordinator --> BackgroundInvestigator : Context Search
    Coordinator --> Planner : Direct Planning
    Coordinator --> [*] : Insufficient Info
    
    BackgroundInvestigator --> Planner
    
    Planner --> HumanFeedback : Generate Plan
    HumanFeedback --> ResearchTeam : Approved
    HumanFeedback --> Planner : Rejected
    
    state ResearchTeam {
        [*] --> CheckSteps
        CheckSteps --> Researcher : Research Step
        CheckSteps --> Coder : Processing Step
        CheckSteps --> [*] : All Complete
        
        Researcher --> CheckSteps
        Coder --> CheckSteps
    }
    
    ResearchTeam --> Planner : Refine Plan
    ResearchTeam --> Reporter : Steps Complete
    
    Reporter --> [*]

    note right of Coordinator
        Multi-turn clarification
        Intent analysis
        Context building
    end note
    
    note right of Planner
        Max iterations configurable
        Step decomposition
        RESEARCH vs PROCESSING
    end note
    
    note right of ResearchTeam
        Parallel step execution
        Result aggregation
        Error handling
    end note
```

## Research Workflow Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Coordinator
    participant BgInvestigator as Background Investigator
    participant Planner
    participant HumanFeedback
    participant ResearchTeam
    participant Researcher
    participant Coder
    participant Reporter
    participant LLM
    participant Search as Search Tools

    User->>Coordinator: "Research quantum computing"
    
    alt Needs Clarification
        Coordinator->>LLM: Analyze Query
        LLM-->>Coordinator: Clarification Questions
        Coordinator->>User: "What aspects?"
        User->>Coordinator: "Applications + Hardware"
    end
    
    Coordinator->>BgInvestigator: Enhanced Context
    BgInvestigator->>Search: Web Search
    Search-->>BgInvestigator: Background Info
    BgInvestigator->>Planner: Context
    
    Planner->>LLM: Generate Plan
    LLM-->>Planner: Multi-Step Plan
    Planner->>HumanFeedback: Present Plan
    HumanFeedback->>User: Display Plan
    User->>HumanFeedback: Approve
    
    HumanFeedback->>ResearchTeam: Execute
    
    loop For Each Step
        alt Research Step
            ResearchTeam->>Researcher: Assign Query
            Researcher->>Search: Search + Crawl
            Search-->>Researcher: Results
            Researcher->>LLM: Analyze
            LLM-->>Researcher: Insights
            Researcher-->>ResearchTeam: Results
        else Processing Step
            ResearchTeam->>Coder: Assign Task
            Coder->>Coder: Execute Code
            Coder-->>ResearchTeam: Processed Data
        end
    end
    
    ResearchTeam->>Reporter: All Results
    Reporter->>LLM: Synthesize Report
    LLM-->>Reporter: Full Report
    Reporter->>Reporter: Generate Markdown
    Reporter->>Reporter: Create Podcast
    Reporter->>Reporter: Generate PPT
    Reporter->>User: Deliver All Assets
```

## Agent Node Architecture

```mermaid
graph TB
    subgraph CoordinatorAgent["COORDINATOR AGENT"]
        IntentAnalysis["Intent Analysis<br/>Understand User Goal"]
        ClarificationLogic["Clarification Logic<br/>Identify Gaps"]
        ContextBuilder["Context Builder<br/>Aggregate Info"]
        RoutingDecision["Routing Decision<br/>Next Node"]
    end

    subgraph PlannerAgent["PLANNER AGENT"]
        PlanGeneration["Plan Generation<br/>LLM Prompt"]
        StepDecomposition["Step Decomposition<br/>Research + Processing"]
        DependencyAnalysis["Dependency Analysis<br/>Order Steps"]
        ValidationCheck["Validation Check<br/>Feasibility"]
    end

    subgraph ResearcherAgent["RESEARCHER AGENT"]
        QueryFormulation["Query Formulation<br/>Search Terms"]
        SearchExecution["Search Execution<br/>Multi-Provider"]
        ContentExtraction["Content Extraction<br/>Crawl + Parse"]
        Synthesis["Synthesis<br/>LLM Summary"]
    end

    subgraph CoderAgent["CODER AGENT"]
        CodeGeneration["Code Generation<br/>Python Script"]
        Execution["Execution<br/>REPL Runtime"]
        ErrorHandling["Error Handling<br/>Retry Logic"]
        ResultFormat["Result Format<br/>Structured Output"]
    end

    subgraph ReporterAgent["REPORTER AGENT"]
        DataAggregation["Data Aggregation<br/>All Results"]
        ReportSynthesis["Report Synthesis<br/>LLM Compose"]
        MarkdownFormat["Markdown Format<br/>Structure"]
        AssetGeneration["Asset Generation<br/>Podcast + PPT"]
    end

    IntentAnalysis --> ClarificationLogic
    ClarificationLogic --> ContextBuilder
    ContextBuilder --> RoutingDecision
    
    PlanGeneration --> StepDecomposition
    StepDecomposition --> DependencyAnalysis
    DependencyAnalysis --> ValidationCheck
    
    QueryFormulation --> SearchExecution
    SearchExecution --> ContentExtraction
    ContentExtraction --> Synthesis
    
    CodeGeneration --> Execution
    Execution --> ErrorHandling
    ErrorHandling --> ResultFormat
    
    DataAggregation --> ReportSynthesis
    ReportSynthesis --> MarkdownFormat
    MarkdownFormat --> AssetGeneration

    style CoordinatorAgent fill:#f9a825,color:#000000
    style PlannerAgent fill:#512da8,color:#ffffff
    style ResearcherAgent fill:#388e3c,color:#ffffff
    style CoderAgent fill:#00796b,color:#ffffff
    style ReporterAgent fill:#e64a19,color:#ffffff
```

## Tool Integration Architecture

```mermaid
graph TB
    subgraph SearchTools["SEARCH TOOLS"]
        Tavily["Tavily Search<br/>Web + News"]
        Brave["Brave Search<br/>Web API"]
        DuckDuckGo["DuckDuckGo<br/>Privacy Search"]
        SearchRouter["Search Router<br/>Provider Selection"]
    end

    subgraph CrawlerTools["CRAWLER TOOLS"]
        Firecrawl["Firecrawl<br/>JS Rendering"]
        Jina["Jina Reader<br/>Clean Markdown"]
        Playwright["Playwright<br/>Browser Automation"]
        CrawlerRouter["Crawler Router<br/>Best Provider"]
    end

    subgraph CodeExecution["CODE EXECUTION"]
        PythonREPL["Python REPL<br/>Sandboxed"]
        EnvManager["Environment Manager<br/>Dependencies"]
        OutputCapture["Output Capture<br/>Streams"]
    end

    subgraph MCPIntegration["MCP INTEGRATION"]
        MCPServer["MCP Server<br/>Protocol Handler"]
        GitHubTrending["GitHub Trending<br/>MCP Tool"]
        CustomMCP["Custom MCP<br/>User Tools"]
        ToolRegistry["Tool Registry<br/>Dynamic Load"]
    end

    subgraph FileSystem["FILE SYSTEM"]
        FileRead["File Read<br/>Documents"]
        FileWrite["File Write<br/>Reports"]
        ArchiveManager["Archive Manager<br/>Storage"]
    end

    SearchRouter --> Tavily
    SearchRouter --> Brave
    SearchRouter --> DuckDuckGo
    
    CrawlerRouter --> Firecrawl
    CrawlerRouter --> Jina
    CrawlerRouter --> Playwright
    
    PythonREPL --> EnvManager
    EnvManager --> OutputCapture
    
    MCPServer --> GitHubTrending
    MCPServer --> CustomMCP
    MCPServer --> ToolRegistry
    
    FileRead --> ArchiveManager
    FileWrite --> ArchiveManager

    style SearchTools fill:#388e3c,color:#ffffff
    style CrawlerTools fill:#00796b,color:#ffffff
    style CodeExecution fill:#512da8,color:#ffffff
    style MCPIntegration fill:#d32f2f,color:#ffffff
    style FileSystem fill:#7b1fa2,color:#ffffff
```

## LLM Configuration & Routing

```mermaid
graph TB
    subgraph ConfigLayer["CONFIGURATION LAYER"]
        YAMLConfig["conf.yaml<br/>Model Definitions"]
        EnvConfig[".env<br/>API Keys"]
        AgentConfig["Agent Config<br/>LLM Assignment"]
    end

    subgraph LLMTypes["LLM TYPES"]
        PrimaryType["Primary<br/>o1, Claude, Gemini"]
        FastType["Fast<br/>GPT-4o-mini, Haiku"]
        VisionType["Vision<br/>Multi-modal"]
    end

    subgraph AgentMapping["AGENT -> LLM MAPPING"]
        CoordMap["Coordinator → Primary"]
        PlannerMap["Planner → Primary"]
        ResearcherMap["Researcher → Fast"]
        CoderMap["Coder → Fast"]
        ReporterMap["Reporter → Primary"]
    end

    subgraph LLMRouter["LLM ROUTER"]
        TypeResolver["Type Resolver<br/>Config Lookup"]
        ClientFactory["Client Factory<br/>Provider SDK"]
        RateLimiter["Rate Limiter<br/>Token Budget"]
    end

    subgraph Providers["PROVIDER SDKS"]
        OpenAI["OpenAI<br/>GPT Models"]
        Anthropic["Anthropic<br/>Claude"]
        Google["Google<br/>Gemini"]
        Groq["Groq<br/>Fast Inference"]
        Venice["Venice<br/>Custom Models"]
    end

    YAMLConfig --> LLMTypes
    EnvConfig --> LLMTypes
    AgentConfig --> AgentMapping
    
    LLMTypes --> AgentMapping
    AgentMapping --> LLMRouter
    
    TypeResolver --> ClientFactory
    ClientFactory --> RateLimiter
    
    ClientFactory --> Providers

    style ConfigLayer fill:#00796b,color:#ffffff
    style LLMTypes fill:#f9a825,color:#000000
    style AgentMapping fill:#512da8,color:#ffffff
    style LLMRouter fill:#d32f2f,color:#ffffff
    style Providers fill:#7b1fa2,color:#ffffff
```

## State Object Structure

```mermaid
classDiagram
    class State {
        +List~Message~ messages
        +str user_input
        +bool enable_clarification
        +int max_clarification_rounds
        +int clarification_count
        +bool enable_background_investigation
        +Plan current_plan
        +List~Plan~ previous_plans
        +bool auto_accepted_plan
        +Dict research_results
        +str final_report
        +str goto
    }

    class Plan {
        +str query
        +List~Step~ steps
        +str objective
        +bool approved
        +int iteration
    }

    class Step {
        +str description
        +StepType step_type
        +List~str~ queries
        +str code
        +str execution_res
        +bool completed
    }

    class Message {
        +str role
        +str content
        +str name
    }

    class StepType {
        <<enumeration>>
        RESEARCH
        PROCESSING
    }

    State "1" --> "1" Plan : current_plan
    State "1" --> "*" Plan : previous_plans
    State "1" --> "*" Message : messages
    Plan "1" --> "*" Step : steps
    Step --> StepType : step_type
```

## Output Generation Pipeline

```mermaid
graph TB
    subgraph ReportGen["REPORT GENERATION"]
        ResearchData["Research Data<br/>Aggregated Results"]
        PromptTemplate["Prompt Template<br/>Report Structure"]
        LLMSynthesis["LLM Synthesis<br/>Content Generation"]
        MarkdownFormat["Markdown Format<br/>Headings + Citations"]
    end

    subgraph PodcastGen["PODCAST GENERATION"]
        TextExtract["Text Extract<br/>Report Content"]
        ScriptGen["Script Generation<br/>Conversational"]
        TTS["TTS Synthesis<br/>Volcengine/ElevenLabs"]
        AudioMerge["Audio Merge<br/>MP3 Output"]
    end

    subgraph PPTGen["PPT GENERATION"]
        OutlineExtract["Outline Extract<br/>Key Points"]
        MarpTemplate["Marp Template<br/>Slide Markdown"]
        SlideGen["Slide Generation<br/>Marp CLI"]
        PDFExport["PDF Export<br/>Final Slides"]
    end

    subgraph Storage["STORAGE"]
        FileSystem["File System<br/>Archives"]
        S3Bucket["S3 Bucket<br/>Cloud Storage"]
        Database["Database<br/>Metadata"]
    end

    ResearchData --> PromptTemplate
    PromptTemplate --> LLMSynthesis
    LLMSynthesis --> MarkdownFormat
    
    MarkdownFormat --> TextExtract
    TextExtract --> ScriptGen
    ScriptGen --> TTS
    TTS --> AudioMerge
    
    MarkdownFormat --> OutlineExtract
    OutlineExtract --> MarpTemplate
    MarpTemplate --> SlideGen
    SlideGen --> PDFExport
    
    MarkdownFormat --> Storage
    AudioMerge --> Storage
    PDFExport --> Storage

    style ReportGen fill:#e64a19,color:#ffffff
    style PodcastGen fill:#f9a825,color:#000000
    style PPTGen fill:#512da8,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
```

## Web UI Architecture

```mermaid
graph TB
    subgraph Frontend["FRONTEND (React)"]
        ChatInterface["Chat Interface<br/>Message Input"]
        PlanViewer["Plan Viewer<br/>Step Breakdown"]
        ProgressTracker["Progress Tracker<br/>Real-time Status"]
        ResultViewer["Result Viewer<br/>Report Display"]
        ReplaySystem["Replay System<br/>Share Sessions"]
    end

    subgraph Backend["BACKEND (FastAPI)"]
        HTTPServer["HTTP Server<br/>uvicorn"]
        WebSocketServer["WebSocket Server<br/>Streaming"]
        SessionManager["Session Manager<br/>User State"]
        APIRouter["API Router<br/>Endpoints"]
    end

    subgraph Integration["INTEGRATION"]
        LangGraphBridge["LangGraph Bridge<br/>Workflow Trigger"]
        StateStreamer["State Streamer<br/>Progress Events"]
        ResultFormatter["Result Formatter<br/>UI Adapters"]
    end

    ChatInterface --> ProgressTracker
    ProgressTracker --> ResultViewer
    PlanViewer --> ResultViewer
    
    Frontend --> WebSocketServer
    Frontend --> APIRouter
    
    HTTPServer --> SessionManager
    WebSocketServer --> SessionManager
    
    APIRouter --> LangGraphBridge
    WebSocketServer --> StateStreamer
    
    LangGraphBridge --> StateStreamer
    StateStreamer --> ResultFormatter
    ResultFormatter --> WebSocketServer

    style Frontend fill:#1976d2,color:#ffffff
    style Backend fill:#7b1fa2,color:#ffffff
    style Integration fill:#f9a825,color:#000000
```

## Key Design Principles

### 1. LangGraph State Machine
- Declarative workflow definition
- Conditional edges for dynamic routing
- Checkpoint-based memory persistence
- Human-in-the-loop approval gates

### 2. Multi-Agent Collaboration
- Specialized agents for distinct tasks
- Coordinator orchestrates workflow
- Research team for parallel execution
- Reporter synthesizes all outputs

### 3. Flexible Tool Ecosystem
- Multiple search providers (Tavily, Brave, DuckDuckGo)
- Web crawling with Firecrawl/Jina
- Python REPL for data processing
- MCP protocol for external tools

### 4. LLM Configuration
- Agent-specific LLM assignment
- Primary (complex) vs Fast (simple) models
- Configurable via YAML + environment
- Rate limiting and cost control

### 5. Output Diversity
- Markdown reports with citations
- TTS-generated podcasts
- Marp-based presentations
- Shareable replay links

### 6. Human-in-the-Loop
- Plan approval before execution
- Clarification rounds for ambiguous queries
- Progress visibility with streaming
- Interruptible workflows

## Technology Stack

- **Core**: Python 3.12+
- **Workflow**: LangGraph, LangChain
- **LLM Providers**: OpenAI, Anthropic, Google, Groq, Venice
- **Search**: Tavily, Brave, DuckDuckGo
- **Crawling**: Firecrawl, Jina Reader
- **Backend**: FastAPI, uvicorn
- **Frontend**: React (Vite), WebSocket
- **TTS**: Volcengine TTS, ElevenLabs
- **Slides**: Marp CLI
- **Code Execution**: Python REPL (sandboxed)

## File Organization

```
deerflow/
├── main.py                 # CLI entry point
├── server.py               # FastAPI server
├── conf.yaml.example       # Configuration template
├── src/
│   ├── graph/
│   │   ├── builder.py      # LangGraph construction
│   │   ├── nodes.py        # Agent node implementations
│   │   └── types.py        # State type definitions
│   ├── agents/
│   │   └── agents.py       # Agent factory
│   ├── prompts/
│   │   └── *.py            # Prompt templates
│   ├── tools/
│   │   ├── search/         # Search tools
│   │   ├── crawler/        # Web crawlers
│   │   └── code/           # Code execution
│   ├── llms/
│   │   └── llm.py          # LLM client factory
│   ├── podcast/
│   │   └── generator.py    # TTS generation
│   ├── ppt/
│   │   └── generator.py    # Marp slides
│   └── server/
│       └── api.py          # FastAPI routes
└── web/
    └── src/                # React frontend
```

---

This architecture enables DeerFlow to conduct systematic, multi-step research with human oversight, producing comprehensive reports enriched with multimedia assets like podcasts and presentations.
