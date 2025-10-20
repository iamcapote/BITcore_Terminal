<!--
Why: Detail the agent orchestration model so implementers know how reasoning loops, delegation, profiles, multi-model execution, and interventions operate.
What: Defines the BaseAgent abstraction, hierarchical patterns, multi-model routing system, and the profile catalog that anchors multi-agent missions.
How: Describes the monologue loop, tool invocation, memory integration, parallel model execution, and extensions for telemetry and logging.
-->

# Agent System

## Core Abstraction: BaseAgent

```javascript
// app/agents/base-agent.mjs

/**
 * BaseAgent: Foundation for all agent types
 * 
 * Responsibilities:
 * - Monologue loop (think → act → observe → repeat)
 * - Tool registry and invocation
 * - Hierarchical communication (superior/subordinate)
 * - Context isolation (own history, memory, state)
 * - Intervention handling (user can pause/redirect)
 * - Extension hooks (middleware for logging, telemetry, etc.)
 */
export class BaseAgent {
  constructor(agentNumber, config, context) {
    this.number = agentNumber;
    this.name = `Agent-${agentNumber}`;
    this.config = config; // { model, temperature, maxTokens, systemPrompt, tools }
    this.context = context; // Shared AgentContext
    
    // Agent-specific state
    this.history = []; // Conversation history
    this.data = {}; // Free-form data store (tool results, temp state)
    this.superior = null; // Parent agent
    this.subordinates = []; // Child agents
    this.intervention = null; // User pause/redirect message
    
    // Tool registry
    this.tools = this.loadTools(config.tools);
    
    // Extension hooks
    this.extensions = this.loadExtensions(config.extensions);
  }
  
  /**
   * Monologue: Main agent loop
   * 
   * Flow:
   * 1. Check for intervention (user pause/message)
   * 2. Call extensions: before_reasoning
   * 3. Generate reasoning via LLM (Chain of Thought)
   * 4. Parse tool calls from reasoning
   * 5. Execute tools
   * 6. Call extensions: after_tool_execution
   * 7. Append results to history
   * 8. Repeat until agent decides to respond or delegate
   */
  async monologue() {
    while (true) {
      await this.handleIntervention();
      
      await this.callExtensions('before_reasoning', { agent: this });
      
      const reasoning = await this.generateReasoning();
      
      await this.callExtensions('after_reasoning', { agent: this, reasoning });
      
      const toolCalls = this.parseToolCalls(reasoning);
      
      if (toolCalls.length === 0) {
        // No tools, agent is responding to user/superior
        break;
      }
      
      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall.name, toolCall.args);
        
        await this.callExtensions('after_tool_execution', { 
          agent: this, 
          tool: toolCall.name, 
          result 
        });
        
        this.addToHistory(`Tool: ${toolCall.name}`, result);
      }
    }
    
    return this.getLastResponse();
  }
  
  /**
   * Generate reasoning via LLM
   */
  async generateReasoning() {
    const prompt = this.buildPrompt();
    
    const response = await this.context.llmClient.chat({
      model: this.config.model,
      messages: prompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      signal: this.context.signal
    });
    
    return response.content;
  }
  
  /**
   * Execute tool
   */
  async executeTool(toolName, args) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    return await tool.execute(this, args);
  }
  
  /**
   * Delegate to subordinate agent
   */
  async delegateToSubordinate(task, profile = null) {
    const subConfig = { ...this.config };
    if (profile) {
      subConfig.systemPrompt = this.context.getProfile(profile);
    }
    
    const subordinate = new BaseAgent(this.number + 1, subConfig, this.context);
    subordinate.superior = this;
    this.subordinates.push(subordinate);
    
    subordinate.addToHistory('User', task);
    const result = await subordinate.monologue();
    
    return result;
  }
  
  /**
   * Intervention handling
   */
  async handleIntervention() {
    if (this.intervention) {
      this.addToHistory('User Intervention', this.intervention);
      this.intervention = null;
    }
    
    if (this.context.isPaused) {
      await this.context.waitForResume();
    }
  }
  
  /**
   * Extension hooks
   */
  async callExtensions(hookName, context) {
    for (const ext of this.extensions) {
      if (ext[hookName]) {
        await ext[hookName](context);
      }
    }
  }
  
  // ... (additional methods: buildPrompt, parseToolCalls, addToHistory, etc.)
}
```

## Agent Hierarchy Patterns

#### Pattern 1: Research Coordinator Flow
```javascript
// Coordinator (Agent 0)
const coordinator = new BaseAgent(0, coordinatorConfig, context);

// Planner (Agent 1)
const planResult = await coordinator.delegateToSubordinate(
  'Create research plan for: BITcore terminal site automation',
  'planner' // Uses planner system prompt
);

// Specialists (Agent 2, 3, 4...)
const searches = await Promise.all([
  coordinator.delegateToSubordinate('Search academic papers', 'researcher'),
  coordinator.delegateToSubordinate('Search GitHub repos', 'code_analyst'),
  coordinator.delegateToSubordinate('Search blog posts', 'researcher')
]);

// Reporter (Agent 5)
const report = await coordinator.delegateToSubordinate(
  `Synthesize findings: ${JSON.stringify(searches)}`,
  'reporter'
);

return report;
```

#### Pattern 2: Tool-First Autonomous Loop
```javascript
// Agent autonomously decides to delegate
const agent = new BaseAgent(0, autonomousConfig, context);

agent.addToHistory('User', 'Build a web scraper for news sites');

// Agent's internal reasoning (via LLM):
// "This task requires:
//  1. Researching best scraping libraries (delegate to researcher)
//  2. Writing code (use code_execution tool)
//  3. Testing on 5 sites (delegate to tester)
// I'll start by delegating research..."

await agent.monologue();
// Agent calls: delegate_to_subordinate tool internally
// Agent calls: code_execution tool internally
  // Agent calls: delegate_to_subordinate tool again for testing
}
```

---

## Multi-Model Execution System

**Purpose:** Enable agents to execute with multiple models in parallel for comparison, consensus, or specialized routing.

**Use Cases:**
1. **Model Comparison**: Run same query through GPT-4, Claude, Llama-70B and compare responses
2. **Consensus Building**: Majority vote across 3+ models for critical decisions
3. **Specialized Routing**: Vision tasks → GPT-4V, code → Claude-3.5-Sonnet, research → Llama-70B
4. **Cost Optimization**: Fast model for simple tasks, expensive model for complex reasoning

### Multi-Model Agent Pattern

```javascript
// app/agents/multi-model-agent.mjs
export class MultiModelAgent extends BaseAgent {
  constructor(agentNumber, config, context) {
    super(agentNumber, config, context);
    this.models = config.models || [config.model]; // Array of model configs
  }
  
  /**
   * Execute reasoning with multiple models in parallel
   */
  async generateReasoningMulti(strategy = 'compare') {
    const prompt = this.buildPrompt();
    
    const responses = await Promise.all(
      this.models.map(model => 
        this.context.llmClient.chat({
          model: model.name,
          messages: prompt,
          temperature: model.temperature || this.config.temperature
        })
      )
    );
    
    switch (strategy) {
      case 'compare':
        return this.formatComparison(responses);
      case 'consensus':
        return this.buildConsensus(responses);
      case 'best':
        return this.selectBest(responses);
      case 'route':
        return this.routeToSpecialist(responses);
      default:
        return responses[0]; // Fallback to first model
    }
  }
  
  formatComparison(responses) {
    return responses.map((r, i) => ({
      model: this.models[i].name,
      response: r.content,
      tokens: r.usage?.total_tokens,
      reasoning: this.extractReasoning(r.content)
    }));
  }
  
  buildConsensus(responses) {
    // Extract tool calls from each response
    const toolCallSets = responses.map(r => this.parseToolCalls(r.content));
    
    // Find tools that appear in majority of responses
    const consensusTools = this.findConsensus(toolCallSets);
    
    return {
      consensus: consensusTools,
      votes: this.countVotes(toolCallSets),
      responses: responses
    };
  }
  
  selectBest(responses) {
    // Rank by quality heuristics: reasoning depth, tool usage, confidence
    const ranked = responses.map((r, i) => ({
      model: this.models[i].name,
      response: r,
      score: this.scoreResponse(r)
    })).sort((a, b) => b.score - a.score);
    
    return ranked[0].response;
  }
}
```

### Configuration

```javascript
// app/config/multi-model.json
{
  "researchAgent": {
    "strategy": "compare",  // compare | consensus | best | route
    "models": [
      { "name": "gpt-4-turbo", "temperature": 0.7, "weight": 1.0 },
      { "name": "claude-3-opus", "temperature": 0.7, "weight": 1.0 },
      { "name": "llama-70b", "temperature": 0.7, "weight": 0.8 }
    ],
    "thresholds": {
      "consensus": 0.66,  // 66% agreement required
      "minModels": 2      // At least 2 models must respond
    }
  },
  "routing": {
    "vision": ["gpt-4-vision", "claude-3-opus"],
    "code": ["claude-3.5-sonnet", "gpt-4-turbo"],
    "research": ["llama-70b", "mixtral-8x7b"],
    "fast": ["gpt-3.5-turbo", "claude-3-haiku"]
  }
}
```

### UI Integration

**Comparison View:**
```
┌─────────────────────────────────────────────────────────┐
│ Multi-Model Comparison                                  │
├─────────────────────────────────────────────────────────┤
│ GPT-4 Turbo          │ Claude 3 Opus   │ Llama 70B      │
│ ──────────────────── │ ─────────────── │ ────────────── │
│ Reasoning:           │ Reasoning:      │ Reasoning:     │
│ Step 1: ...          │ Step 1: ...     │ Step 1: ...    │
│                      │                 │                │
│ Tool Calls:          │ Tool Calls:     │ Tool Calls:    │
│ - search("...")      │ - search("...")  │ - search("...") │
│ - memory_load(...)   │ - code_exec(...) │ - search("...") │
│                      │                 │                │
│ Confidence: 85%      │ Confidence: 92% │ Confidence: 78%│
│ Tokens: 1,234        │ Tokens: 1,456   │ Tokens: 987    │
└─────────────────────────────────────────────────────────┘
```

**Consensus Display:**
```
Consensus Reached (2/3 models agree):
✓ search("AI agent patterns") - GPT-4, Claude
✓ memory_load("langchain") - GPT-4, Claude
✗ code_exec(...) - Claude only (below threshold)
```

---

## Agent Profiles

Profiles are system prompts (plus metadata) that encode role, authority, and tool allowances. They live in `app/agents/profiles/*.prompt.md` with a manifest at `app/agents/profiles/catalog.json` describing tags, default models, and GUI ordering.

**Management Surface:**
- CLI: `pnpm exec bitcore agents profile list|show|set`.
```

## Agent Profiles

Profiles are system prompts (plus metadata) that encode role, authority, and tool allowances. They live in `app/agents/profiles/*.prompt.md` with a manifest at `app/agents/profiles/catalog.json` describing tags, default models, and GUI ordering.

**Management Surface:**
- CLI: `pnpm exec bitcore agents profile list|show|set`.
- GUI: dropdown + search in both chat and orchestration views; editing opens markdown editor with live validation.
- MCP: `agent_profiles.list` exposes the same catalog to external controllers.

**Core Profiles (shipped with SeedCore):**

`coordinator.prompt.md`
```markdown
You orchestrate missions. Translate goals into phases, assign specialists, enforce deadlines, and consolidate results.

Guidelines:
- Build a plan before executing.
- Delegate when a sub-task exceeds three atomic steps.
- Use profiles: planner, deep_researcher, site_builder, validator, sentinel.
- Track dependencies between sub-tasks and reorder when blockers appear.
- Produce structured status updates every iteration.
```

`router.prompt.md`
```markdown
You triage messages and route them to the correct specialist. You never solve tasks directly.

Guidelines:
- Inspect intent, required tools, and risk.
- Choose a target profile and emit a routing directive.
- If uncertain, escalate to coordinator with clarifying questions.
- Maintain a queue of pending actions and surface conflicts early.
```

`deep_researcher.prompt.md`
```markdown
You perform exhaustive research with citations and freshness checks.

Guidelines:
- Use search_engine, memo_capture, and web_reader tools.
- Cross-validate claims across at least two independent sources.
- Flag outdated or conflicting data.
- Summaries include citations formatted as [source-id](url).
- Hand back structured datasets (tables, JSON) when appropriate.
```

`site_builder.prompt.md`
```markdown
You turn research outputs into publishable static sites.

Guidelines:
- Use file_browser and code_execution (jekyll session) tools.
- Generate layouts, SCSS, and Markdown content in `/projects/<mission>/site`.
- Run `bundle exec jekyll build` and attach the build log.
- Ask coordinator for design/theme directives when unspecified.
```

`validator.prompt.md`
```markdown
You verify artefacts for correctness, safety, and policy compliance.

Guidelines:
- Re-run critical commands in isolated sessions.
- Use diff and checksum tools to detect unexpected changes.
- Run policy_lint to enforce guardrails.
- Escalate to sentinel if you detect risk; otherwise approve or reject with reasons.
```

`sentinel.prompt.md`
```markdown
You guard the system. Monitor for anomalies, sandbox breaches, and malicious patterns.

Guidelines:
- Subscribe to audit events from mission_event.bus.
- Inspect environment selections and tool invocations.
- Trigger environment quarantine via select_computer when risk is high.
- You can pause agents by emitting an intervention.
```

Profiles are hot-swappable: the CLI/GUI both expose a simple toggle list so operators or upstream agents can reassign roles mid-mission. Custom profiles drop into the directory and are auto-indexed by a file watcher that updates the catalog, ensuring plug-in and extension packs can bundle new roles without code changes.
