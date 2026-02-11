<!--
Why: Preserve the core architecture doctrine and system foundations that shape all delivery.
What: Conceptual foundation, system doctrine, architecture flows, migration path, vendor patterns, and system diagrams.
How: Keep canonical content intact while grouping foundations and architectural signals.
Status: active
Last Updated: 2026-02-02
-->

# Architecture Foundations

## 1) Conceptual Foundation (Ophanim Metaphor)
BITcore is modeled after the Ophanim: self-similar, all-seeing, concentric layers of consciousness.

- **Self-similar consciousness**: agents compose tools → capabilities → primitives without rewrites.
- **All eyes, all directions**: every decision is observable via telemetry/logs across CLI and GUI.
- **Concentric rings**: layered architecture keeps core reasoning decoupled from IO and external systems.
- **Consciousness-as-process**: behavior emerges from composing simple components, not hard-wired flows.

**Why it matters**: scalability, adaptability, transparency, and extensibility.

## 2) Architecture Layers (Concentric Rings)
```
┌─────────────────────────────────────────┐
│ Interface (CLI + Web GUI)               │  ← Commands, Settings, Telemetry
├─────────────────────────────────────────┤
│ Orchestration (Agent Scheduler)         │  ← Mission dispatch, retry logic
├─────────────────────────────────────────┤
│ Agents (Reasoning, Planning)            │  ← Goal pursuit, tool selection
├─────────────────────────────────────────┤
│ Knowledge (Memory + Tools + Search)     │  ← Context retrieval, capability lookup
├─────────────────────────────────────────┤
│ Environment (File System, Shell, I/O)   │  ← Computer system, execution
├─────────────────────────────────────────┤
│ External Systems (LLM, Search, DB)      │  ← Venice, Brave, GitHub, Vector DB
└─────────────────────────────────────────┘
```
Each layer has explicit contracts (inputs/outputs/errors/perf budgets). Outer layers depend inward only.

## 3) System Doctrine

### CLI ↔ GUI Parity Mandate
Every feature, setting, option, and toggle must be accessible from both CLI and Web GUI.

**Implementation pattern**:
1) CLI commands export metadata (`app/commands/*.cli.mjs`).
2) `GET /api/commands` exposes metadata to the GUI.
3) GUI renders forms/controls from metadata.
4) Parity tests assert exact match.

### Single-User Contract (Current)
- One operator identity, default role **admin**.
- No multi-user login or role switching in Nova.
- Multi-user adapters remain planned but inactive.

## 4) Perfected Architecture Additions (Critical Signals)

### Environment Sovereignty & Rebuild Guarantee
- Curated distro catalog: SeedCore, TinyCore, Debian Slim, Kali, Alpine, Arch, custom builds.
- Bootstrap wizard (`bitcore start --bootstrap`) materializes catalogs and rebuild scripts.
- Rebuild guarantee: platform can be reconstructed 1:1 after full wipe using seed artifacts and manifests.

### Isolation-First Filesystem Doctrine
- Strict separation of framework, projects, environments, plugins, and user data.
- Agent access is sandboxed to `/workspace`; framework mounted read-only.
- Sensitive archives are double-nested to reduce accidental deletion.

### Extensible by Default
- Plugins, MCP services, themes, tools, and extensions registered via manifests.
- No hard-coded tool or UI constraints; adapters are hot-swappable.

### Lightweight Compute Defaults
- Lean runtimes are default; heavy stacks remain optional add-ons.

## 7) Vendor Pattern Index (Adapt, Don’t Reinvent)
- **Agent Zero**: tool registry, scheduler, dashboard, instruments.
- **Deerflow**: orchestration, hierarchy, telemetry visualization.
- **Superfile**: parity doctrine, keyboard-first navigation.
- **Chatbot-UI**: sidebar layout, chat UX, HSL tokens.
- **Anything-LLM**: vector DB + ingestion pipeline.
- **Semantic Flow**: retro skin + workflow canvas aesthetics.
- **LibreChat**: provider routing + tool invocation.

**Expanded vendor inventory (canonical list)**
- **OpenAI Swarm**: swarm orchestration patterns and tool routing.
- **Ollama**: local model hosting + low-latency inference.
- **Vector-Admin**: vector store administration UI patterns.
- **ChatGPT-UI**: alternate chat shell and settings ergonomics.

## 8) Architecture Examples (Signal Flow)

**Telemetry “All Eyes”**
Research engine emits `research:*` events → telemetry store → GUI progress ring, token gauge, logs tail.

**Nested Agents (Self-Similarity)**
Base agent loop → specialized agents → tool registry → telemetry emission.

**Concentric Dependency Flow**
Interface → Orchestration → Agents → Knowledge → Environment → External systems.

## 8.1) Data Flow (Current + Target)

### Data Flow: Research Request (Current System)
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

### Data Flow: Agent-Based Research Request (Target System)
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

## 8.2) Migration Path (Current → Target)
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

## 22) System Architecture (Current vs Target)

### Current System Architecture (Operational)
```mermaid
graph TB
	subgraph Client[CLIENT LAYER]
		WebTerminal[Web Terminal<br/>XTerm.js + Command Parser]
		CLI[Native CLI<br/>Readline REPL]
	end

	subgraph Transport[TRANSPORT LAYER]
		WSS[WebSocket Server<br/>/api/research/ws]
		HTTP[HTTP Routes<br/>Express Router]
	end

	subgraph Session[SESSION MANAGEMENT]
		SessionStore[Session Store<br/>ID, User, State, History]
		CSRF[CSRF Token<br/>Validation]
		RateLimit[Rate Limiter<br/>5 req/sec default]
	end

	subgraph MessageRouter[MESSAGE ROUTING]
		ConnectionHandler[Connection Handler<br/>Lifecycle Management]
		CommandHandler[Command Handler<br/>Slash Commands]
		ChatHandler[Chat Handler<br/>Conversational Mode]
		InputHandler[Input Handler<br/>Prompt Responses]
	end

	subgraph Commands[COMMAND REGISTRY]
		ResearchCmd[/research]
		ChatCmd[/chat]
		MemoryCmd[/memory]
		KeysCmd[/keys]
		StatusCmd[/status]
		MissionsCmd[/missions]
	end

	subgraph Features[FEATURE CONTROLLERS]
		ResearchCtrl[Research Controller]
		MemoryCtrl[Memory Controller]
		ChatCtrl[Chat History Controller]
		StatusCtrl[Status Controller]
		MissionsCtrl[Missions Controller]
		PromptsCtrl[Prompts Controller]
	end

	subgraph Infrastructure[INFRASTRUCTURE LAYER]
		direction TB
		subgraph AI[AI Services]
			VeniceLLM[Venice LLM Client]
			LangChainModel[LangChain Wrapper]
			LangGraphJS[LangGraph.js]
			Chains[LangChain Chains]
		end

		subgraph Research[Research Engine]
			ResearchEngine[Research Engine]
			ResearchPath[Research Path]
			OverrideRunner[Override Runner]
		end

		subgraph Search[Search Providers]
			BraveSearch[Brave Search]
			SearchMux[Search Multiplexer]
		end

		subgraph Memory[Memory System]
			MemoryManager[Memory Manager]
			MemoryStore[Memory Store]
			MemoryValidators[Memory Validators]
			GithubMemory[GitHub Integration]
		end
	end

	subgraph Persistence[PERSISTENCE LAYER]
		FileSystem[File System<br/>JSON Archives]
		GithubRepo[GitHub Repository]
		ConfigStore[Encrypted Config]
	end

	WebTerminal --> WSS
	CLI --> Commands

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

	MemoryManager <--> MemoryStore
	MemoryManager --> MemoryValidators
	MemoryManager <--> GithubMemory

	MissionsCtrl <--> FileSystem
	MissionsCtrl <--> GithubRepo
	PromptsCtrl <--> GithubRepo
	ConfigStore <--> FileSystem
	MemoryManager <--> FileSystem
	GithubMemory <--> GithubRepo
```

### Target Agent-Based Architecture (Plan)
```mermaid
graph TB
	subgraph Client[CLIENT INTERFACES]
		WebUI[Web Terminal]
		NativeCLI[Native CLI]
		RESTAPI[REST API Clients]
	end

	subgraph Gateway[API GATEWAY]
		WSGateway[WebSocket Gateway]
		HTTPGateway[HTTP Gateway]
		AuthLayer[Auth Middleware]
	end

	subgraph AgentOrch[AGENT ORCHESTRATION CORE]
		AgentContext[Agent Context<br/>State + Event Bus + Tool Registry]
		subgraph AgentHierarchy[Agent Hierarchy]
			CoordAgent[Coordinator Agent]
			PlanAgent[Planner Agent]
			ExecAgents[Execution Agents]
			ReportAgent[Reporter Agent]
		end
		subgraph AgentProfile[Agent Profiles]
			ResearchProfile[Research Specialist]
			CodeProfile[Code Specialist]
			AnalystProfile[Data Analyst]
			ValidatorProfile[Fact Checker]
		end
	end

	subgraph Tools[TOOL REGISTRY]
		SearchTool[Search Tool]
		MemoryTool[Memory Tool]
		CodeTool[Code Execution]
		FileTool[File Operations]
		WebTool[Web Scraper]
		CustomTool[Custom Tools]
	end

	subgraph Infrastructure[INFRASTRUCTURE SERVICES]
		direction TB
		subgraph LLM[LLM Services]
			VeniceClient[Venice Client]
			LangChainWrap[LangChain Wrapper]
			PromptEngine[Prompt Template Engine]
		end
		subgraph MemSys[Memory System]
			WorkingMem[Working Memory]
			LongTermMem[Long-Term Memory]
			OntologyMem[Ontology Memory]
			MemConsolidate[Memory Consolidator]
		end
		subgraph Compute[Compute Environment]
			ContainerMgr[Container Manager]
			EnvProfiles[Environment Profiles]
			IsolationLayer[Process Isolation]
		end
	end

	subgraph Storage[STORAGE LAYER]
		FileStore[File System]
		VectorDB[Vector Database]
		GraphDB[Graph Database]
		ConfigVault[Config Vault]
		GitSync[GitHub Sync]
	end

	subgraph Telemetry[TELEMETRY & MONITORING]
		EventBus[Event Bus]
		Metrics[Metrics Collector]
		Logging[Structured Logging]
		Tracing[Trace Visualization]
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

	CoordAgent -.-> ResearchProfile
	PlanAgent -.-> ResearchProfile
	ExecAgents -.-> ResearchProfile

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
	MemSys <--> FileStore
	FileStore <--> GitSync

	AgentContext --> EventBus
	Tools --> Metrics
	Infrastructure --> Logging
	EventBus --> Tracing
```

## 32) Vendor Pattern Summary

Detailed vendor patterns have been extracted to [04b-vendor-patterns.md](04b-vendor-patterns.md).

**Key pattern categories:**
- Multi-agent orchestration (Deerflow, Agent Zero, AIbitat)
- MCP/tooling integration (Agent Zero, LibreChat, AnythingLLM)
- Frontend shell & navigation (Chatbot-UI, Semantic Flow)
- Memory & RAG pipelines (Agent Zero, AnythingLLM, VectorAdmin)
- CLI ↔ GUI parity (Superfile)
- SSE/SSO authentication (Semantic Flow, LibreChat)
- Provider abstraction (Semantic Flow, AnythingLLM)
- Workflow execution (Semantic Flow, Deerflow)

**Adopt/Defer/Discard summary:**
- **Adopt**: capability routing, token budgeting, provider adapters, human-in-loop approval, conversation branching, streaming-by-default.
- **Defer**: multi-user RBAC, workspace sharing, hosted widgets.
- **Discard**: server-side key storage, monolithic prompts, Supabase multi-tenant RLS.

## 14) Decision Points & Trade-offs (Historical)

**Option A: Incremental migration (chosen)**
- Keep legacy visible while Nova builds out (completed; legacy now reference-only).
- Feature flag reserved for rollback during rollout phases.

**Option B: Full rewrite (not chosen)**
- Single codebase, higher risk.

**Option C: Maintain both (not chosen)**
- Double maintenance, user confusion.
