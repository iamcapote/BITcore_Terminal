<!--
Why: Document the OpenAI Assistant Swarm Manager so contributors understand how it orchestrates multiple OpenAI assistants to delegate complex tasks intelligently.
What: Visualizes the swarm coordination system, assistant registry, delegation logic, and parallel execution patterns.
How: Uses Mermaid diagrams to show how one manager assistant can coordinate an army of specialized assistants through a unified API.
-->

# OpenAI Assistant Swarm Manager Architecture

## Overview

OpenAI Assistant Swarm Manager is a Node.js library that extends the OpenAI SDK to enable intelligent coordination between multiple OpenAI assistants. It allows a single "manager" assistant to delegate work to specialized assistants in parallel, handling complex multi-step tasks through automatic orchestration.

## Core Architecture

```mermaid
graph TB
    subgraph ClientLayer["CLIENT LAYER"]
        OpenAIClient["OpenAI Client<br/>Extended SDK"]
        SwarmInit["Swarm Initializer<br/>Setup Manager"]
        APIExtension["API Extension<br/>.swarm methods"]
    end

    subgraph SwarmManager["SWARM MANAGER ASSISTANT"]
        ManagerAssistant["Manager Assistant<br/>Orchestrator"]
        DelegationLogic["Delegation Logic<br/>Task Analysis"]
        AssistantRegistry["Assistant Registry<br/>Capability Mapping"]
        PriorityQueue["Priority Queue<br/>Task Scheduling"]
    end

    subgraph WorkerAssistants["WORKER ASSISTANTS"]
        SpecializedAgents["Specialized Assistants<br/>Domain Experts"]
        Assistant1["Assistant 1<br/>Web Research"]
        Assistant2["Assistant 2<br/>Code Generation"]
        Assistant3["Assistant 3<br/>Data Analysis"]
        AssistantN["Assistant N<br/>Custom Tasks"]
    end

    subgraph ExecutionEngine["EXECUTION ENGINE"]
        ParallelExecutor["Parallel Executor<br/>Concurrent Tasks"]
        RunManager["Run Manager<br/>Thread Control"]
        ResultCollector["Result Collector<br/>Output Aggregation"]
        ErrorHandler["Error Handler<br/>Retry Logic"]
    end

    subgraph Coordination["COORDINATION LAYER"]
        TaskSplitter["Task Splitter<br/>Work Decomposition"]
        ContextSharing["Context Sharing<br/>Shared Knowledge"]
        SyncManager["Sync Manager<br/>Completion Tracking"]
        ConflictResolver["Conflict Resolver<br/>Result Merging"]
    end

    subgraph Monitoring["MONITORING & DEBUG"]
        PlaygroundLinks["Playground Links<br/>Debug URLs"]
        ExecutionLogs["Execution Logs<br/>Trace Output"]
        PerformanceMetrics["Performance Metrics<br/>Timing Data"]
    end

    OpenAIClient --> SwarmInit
    SwarmInit --> APIExtension
    
    APIExtension --> SwarmManager
    ManagerAssistant --> DelegationLogic
    DelegationLogic --> AssistantRegistry
    AssistantRegistry --> PriorityQueue
    
    SwarmManager --> WorkerAssistants
    SpecializedAgents --> Assistant1
    SpecializedAgents --> Assistant2
    SpecializedAgents --> Assistant3
    SpecializedAgents --> AssistantN
    
    WorkerAssistants --> ExecutionEngine
    ParallelExecutor --> RunManager
    RunManager --> ResultCollector
    ResultCollector --> ErrorHandler
    
    ExecutionEngine --> Coordination
    TaskSplitter --> ContextSharing
    ContextSharing --> SyncManager
    SyncManager --> ConflictResolver
    
    SwarmManager --> Monitoring
    PlaygroundLinks --> ExecutionLogs
    ExecutionLogs --> PerformanceMetrics

    style ClientLayer fill:#1976d2,color:#ffffff
    style SwarmManager fill:#f9a825,color:#000000
    style WorkerAssistants fill:#388e3c,color:#ffffff
    style ExecutionEngine fill:#512da8,color:#ffffff
    style Coordination fill:#e64a19,color:#ffffff
    style Monitoring fill:#00796b,color:#ffffff
```

## Swarm Delegation Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant SDK as OpenAI SDK (Extended)
    participant Manager as Manager Assistant
    participant Registry as Assistant Registry
    participant Worker1 as Assistant 1
    participant Worker2 as Assistant 2
    participant Aggregator as Result Aggregator

    App->>SDK: swarm.execute(task)
    SDK->>Manager: Analyze Task
    Manager->>Manager: Break Down Task<br/>into Subtasks
    
    Manager->>Registry: Find Capable Assistants
    Registry-->>Manager: [Assistant1, Assistant2]
    
    par Parallel Execution
        Manager->>Worker1: Delegate Subtask 1
        Worker1->>Worker1: Process
        Worker1-->>Manager: Result 1
    and
        Manager->>Worker2: Delegate Subtask 2
        Worker2->>Worker2: Process
        Worker2-->>Manager: Result 2
    end
    
    Manager->>Aggregator: Combine Results
    Aggregator-->>Manager: Final Output
    
    Manager->>SDK: Return Aggregated Result
    SDK->>App: Final Response
```

## Assistant Registry & Capability System

```mermaid
graph TB
    subgraph AssistantRegistration["ASSISTANT REGISTRATION"]
        AutoDiscovery["Auto Discovery<br/>Scan Account"]
        ManualRegister["Manual Registration<br/>Explicit Add"]
        CapabilityTagging["Capability Tagging<br/>Skill Metadata"]
    end

    subgraph CapabilityDatabase["CAPABILITY DATABASE"]
        SkillMatrix["Skill Matrix<br/>Assistant → Skills"]
        FunctionMapping["Function Mapping<br/>Tool Definitions"]
        PerformanceProfile["Performance Profile<br/>Speed + Quality"]
    end

    subgraph MatchingEngine["MATCHING ENGINE"]
        TaskAnalyzer["Task Analyzer<br/>Requirement Extraction"]
        SkillMatcher["Skill Matcher<br/>Best Fit Selection"]
        LoadBalancer["Load Balancer<br/>Distribution"]
    end

    subgraph OptimizationLayer["OPTIMIZATION"]
        CostEstimator["Cost Estimator<br/>Token Usage"]
        LatencyPredictor["Latency Predictor<br/>Time Estimates"]
        QualityScorer["Quality Scorer<br/>Output Rating"]
    end

    AutoDiscovery --> CapabilityTagging
    ManualRegister --> CapabilityTagging
    
    CapabilityTagging --> CapabilityDatabase
    SkillMatrix --> FunctionMapping
    FunctionMapping --> PerformanceProfile
    
    CapabilityDatabase --> MatchingEngine
    TaskAnalyzer --> SkillMatcher
    SkillMatcher --> LoadBalancer
    
    MatchingEngine --> OptimizationLayer
    CostEstimator --> LatencyPredictor
    LatencyPredictor --> QualityScorer

    style AssistantRegistration fill:#1976d2,color:#ffffff
    style CapabilityDatabase fill:#f9a825,color:#000000
    style MatchingEngine fill:#388e3c,color:#ffffff
    style OptimizationLayer fill:#512da8,color:#ffffff
```

## Parallel Execution Architecture

```mermaid
graph TB
    subgraph TaskQueue["TASK QUEUE"]
        IngressQueue["Ingress Queue<br/>New Tasks"]
        PrioritySort["Priority Sort<br/>Urgency Ranking"]
        BatchScheduler["Batch Scheduler<br/>Group Similar"]
    end

    subgraph ExecutorPool["EXECUTOR POOL"]
        ThreadManager["Thread Manager<br/>OpenAI Threads"]
        RunCoordinator["Run Coordinator<br/>Execution Control"]
        RateLimiter["Rate Limiter<br/>API Throttling"]
    end

    subgraph ResultHandling["RESULT HANDLING"]
        StreamParser["Stream Parser<br/>Token Processing"]
        OutputFormatter["Output Formatter<br/>Standardization"]
        Merger["Merger<br/>Combine Outputs"]
    end

    subgraph ErrorRecovery["ERROR RECOVERY"]
        RetryManager["Retry Manager<br/>Exponential Backoff"]
        FallbackLogic["Fallback Logic<br/>Alternative Assistants"]
        CircuitBreaker["Circuit Breaker<br/>Failure Protection"]
    end

    IngressQueue --> PrioritySort
    PrioritySort --> BatchScheduler
    
    BatchScheduler --> ExecutorPool
    ThreadManager --> RunCoordinator
    RunCoordinator --> RateLimiter
    
    ExecutorPool --> ResultHandling
    StreamParser --> OutputFormatter
    OutputFormatter --> Merger
    
    ExecutorPool --> ErrorRecovery
    RetryManager --> FallbackLogic
    FallbackLogic --> CircuitBreaker

    style TaskQueue fill:#1976d2,color:#ffffff
    style ExecutorPool fill:#f9a825,color:#000000
    style ResultHandling fill:#388e3c,color:#ffffff
    style ErrorRecovery fill:#e64a19,color:#ffffff
```

## Configuration & Setup

```mermaid
graph TB
    subgraph Initialization["INITIALIZATION"]
        SDKExtension["SDK Extension<br/>EnableSwarmAbilities()"]
        ConfigLoader["Config Loader<br/>Options"]
        ManagerSetup["Manager Setup<br/>Create Assistant"]
    end

    subgraph Configuration["CONFIGURATION OPTIONS"]
        DebugMode["Debug Mode<br/>Logging + Links"]
        ManagerOptions["Manager Options<br/>Name, Model, Instructions"]
        DefaultBehavior["Default Behavior<br/>Delegation Strategy"]
    end

    subgraph SwarmRegistry["SWARM REGISTRY"]
        AssistantSync["Assistant Sync<br/>Fetch from Account"]
        MetadataCache["Metadata Cache<br/>Local Storage"]
        VersionControl["Version Control<br/>Assistant Updates"]
    end

    SDKExtension --> ConfigLoader
    ConfigLoader --> ManagerSetup
    
    ConfigLoader --> Configuration
    DebugMode --> ManagerOptions
    ManagerOptions --> DefaultBehavior
    
    ManagerSetup --> SwarmRegistry
    AssistantSync --> MetadataCache
    MetadataCache --> VersionControl

    style Initialization fill:#1976d2,color:#ffffff
    style Configuration fill:#f9a825,color:#000000
    style SwarmRegistry fill:#388e3c,color:#ffffff
```

## Key Design Principles

### 1. Transparent Delegation
- Manager assistant automatically analyzes and delegates tasks
- No manual orchestration required
- Mental overhead of coordination handled by the library

### 2. Parallel Execution
- Multiple assistants work simultaneously on subtasks
- Optimal resource utilization
- Significant speed improvements for complex workflows

### 3. Capability-Based Routing
- Assistants tagged with skills and capabilities
- Automatic matching to appropriate tasks
- Load balancing across available workers

### 4. Resilient Orchestration
- Retry logic for failed delegations
- Fallback to alternative assistants
- Circuit breakers prevent cascade failures

### 5. Developer-Friendly
- Simple API extension to OpenAI SDK
- Debug mode with playground links
- Minimal configuration required

## Technology Stack

- **Runtime**: Node.js (ES6+)
- **SDK**: OpenAI Node SDK
- **Language**: TypeScript
- **Build**: tsup
- **Package Manager**: yarn/npm

## File Organization

```
openai-assistant-swarm/
├── src/
│   ├── index.ts              # Main entry point
│   ├── swarm-manager.ts      # Manager logic
│   ├── assistant-registry.ts # Capability system
│   ├── executor.ts           # Parallel execution
│   └── utils.ts              # Helpers
├── examples/
│   ├── basic-delegation.js   # Simple example
│   ├── parallel-tasks.js     # Multi-assistant
│   └── advanced.js           # Complex workflows
└── package.json
```

## Usage Pattern

```javascript
import OpenAI from 'openai';
import { EnableSwarmAbilities } from '@mintplex-labs/openai-assistant-swarm';

// Extend OpenAI client
const client = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
EnableSwarmAbilities(client, {
  debug: true,
  managerAssistantOptions: {
    name: "Task Orchestrator",
    model: "gpt-4",
    instructions: "Delegate tasks efficiently"
  }
});

// Initialize swarm
await client.beta.assistants.swarm.init();

// Execute with automatic delegation
const result = await client.beta.assistants.swarm.execute({
  task: "Research AI trends and write a summary",
  assistants: ['researcher', 'writer'],
  parallelExecution: true
});
```

## Key Benefits

1. **Reduced Complexity**: No manual assistant coordination code
2. **Performance**: Parallel execution reduces total time
3. **Scalability**: Easy to add new specialized assistants
4. **Cost Optimization**: Efficient use of API calls
5. **Debugging**: Playground links for each step

---

This architecture enables developers to build complex multi-assistant workflows without the mental overhead of manual orchestration, making it easy to create powerful AI systems that leverage specialized capabilities across multiple assistants.
