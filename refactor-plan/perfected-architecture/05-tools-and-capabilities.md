<!--
Why: Enumerate the standard toolchain and customization pathway so agents, operators, and integrators share a single contract surface.
What: Documents core tool definitions, parameters, return shapes, and guidance for registering new tools.
How: Lists JSON-like specifications, highlights parity across CLI/GUI/MCP, and records extension points for custom logic.
-->

# Tools & Capabilities

## Core Tools

#### 1. **code_execution**
```javascript
{
  name: 'code_execution',
  description: 'Execute code in the current computer environment',
  parameters: {
    runtime: 'bash | nodejs | deno | bun | python | ruby | lua',
    code: 'string',
    session: 'number (0-9)', // Multi-session support
    timeout: 'number (ms)',
    files: 'Array<{ path: string, content: string }>' // optional temp files
  },
  returns: { stdout: 'string', stderr: 'string', exitCode: 'number', artifacts: 'string[]' }
}
```

**Multi-Session Support:**
- Session 0: Main shell (persistent environment variables, working directory)
- Session 1-9: Isolated shells for parallel tasks
- Example: Agent runs `npm install` in session 0, then `npm test` in session 1 while session 0 runs `npm run dev`

#### 2. **search_engine** (Brave API)
```javascript
{
  name: 'search_engine',
  description: 'Search the web for information',
  parameters: {
    query: 'string',
    count: 'number (1-20)',
    freshness: 'pd (past day) | pw (past week) | pm (past month)'
  },
  returns: { results: [{title, url, snippet, published}] }
}
```

#### 3. **memory_save / memory_load**
```javascript
{
  name: 'memory_save',
  description: 'Save information to long-term memory (FAISS vectors)',
  parameters: {
    text: 'string',
    area: 'main | solutions | instruments | fragments',
    tags: 'string[]'
  },
  returns: { memoryId: 'string' }
}

{
  name: 'memory_load',
  description: 'Search long-term memory',
  parameters: {
    query: 'string',
    area: 'main | solutions | instruments | fragments',
    count: 'number (1-10)'
  },
  returns: { memories: [{ id, text, similarity, tags }] }
}
```

#### 4. **delegate_to_subordinate**
```javascript
{
  name: 'delegate_to_subordinate',
  description: 'Create subordinate agent to handle sub-task',
  parameters: {
    task: 'string',
    profile: 'researcher | coder | analyst | reporter | custom',
    reset: 'boolean' // Whether to create new subordinate or reuse existing
  },
  returns: { result: 'string' }
}
```

#### 5. **file_browser** (Superfile-inspired)
```javascript
{
  name: 'file_browser',
  description: 'Browse files with TUI (Terminal UI) or programmatic API',
  parameters: {
    action: 'list | read | write | delete | mkdir | search | preview',
    path: 'string',
    content: 'string', // For write action
    query: 'string' // For search action
  },
  returns: { files: [{name, type, size, modified}] | content: 'string' }
}
```

#### 6. **select_computer** (Environment Switcher)
```javascript
{
  name: 'select_computer',
  description: 'Change execution environment',
  parameters: {
    environment: 'seedcore | tinycore | debian | kali | alpine | arch | custom | nested',
    dockerfile: 'string', // For custom environment
    extras: 'string[]', // Optional catalog extras (ollama, gpu, browser)
    persist: 'string | null',
    reason: 'string'
  },
  returns: { containerId: 'string', environment: 'string', extras: 'string[]' }
}
```

#### 7. **scheduler_create_task**
```javascript
{
  name: 'scheduler_create_task',
  description: 'Schedule future task execution',
  parameters: {
    type: 'scheduled | adhoc | planned',
    name: 'string',
    task: 'string',
    schedule: 'cron | datetime', // e.g., '0 9 * * 1' or '2025-10-20T09:00:00Z'
  },
  returns: { taskId: 'string', nextRun: 'datetime' }
}
```

#### 8. **secret_get / secret_set**
```javascript
{
  name: 'secret_set',
  description: 'Store encrypted secret (API keys, tokens)',
  parameters: {
    key: 'string',
    value: 'string'
  },
  returns: { success: 'boolean' }
}

{
  name: 'secret_get',
  description: 'Retrieve secret by key (agent never sees value, injected at runtime)',
  parameters: {
    key: 'string'
  },
  returns: { exists: 'boolean' } // Value injected into tool execution context, not returned
}
```

#### 9. **mcp_request** (Model Context Protocol Bridge)
```javascript
{
  name: 'mcp_request',
  description: 'Invoke external MCP server tools or resources',
  parameters: {
    server: 'string', // Key from app/config/mcp.servers.json
    tool: 'string',
    args: 'Record<string, any>',
    timeout: 'number (ms)'
  },
  returns: { response: 'any', latencyMs: 'number' }
}
```

#### 10. **plugin_execute**
```javascript
{
  name: 'plugin_execute',
  description: 'Call a plugin action registered via manifest',
  parameters: {
    plugin: 'string',
    action: 'string',
    payload: 'Record<string, any>',
    sandbox: 'boolean' // true => run in ephemeral SeedCore child
  },
  returns: { result: 'any', logs: 'string[]' }
}
```

#### 11. **memo_capture**
```javascript
{
  name: 'memo_capture',
  description: 'Store structured intermediate note in working memory',
  parameters: {
    channel: 'thought | citation | risk | decision',
    content: 'string',
    tags: 'string[]'
  },
  returns: { memoId: 'string' }
}
```

#### 12. **policy_lint**
```javascript
{
  name: 'policy_lint',
  description: 'Check artefacts against policy packs (security, compliance)',
  parameters: {
    path: 'string',
    pack: 'safe-default | web-hardening | data-governance'
  },
  returns: { passed: 'boolean', issues: [{ code, message, location }] }
}
```

#### 13. **ollama_chat**
```javascript
{
  name: 'ollama_chat',
  description: 'Use local Ollama model for fast reasoning or drafting',
  parameters: {
    model: 'string', // e.g., llama3, mistral-small
    prompt: 'string',
    format: 'text | json',
    options: { temperature?: number, top_p?: number }
  },
  returns: { output: 'string', tokens: { prompt: number, completion: number } }
}
```

#### 14. **theme_switch**
```javascript
{
  name: 'theme_switch',
  description: 'Change active UI skin or colorway',
  parameters: {
    surface: 'web | tui',
    theme: 'win95 | modern | night-ops | custom:<id>'
  },
  returns: { applied: 'boolean' }
}
```

CLI, GUI, and MCP clients all hit the same REST/WebSocket endpoints for these tools. Every invocation emits a structured log event so agents, humans, and external orchestrators share identical telemetry.

## Custom Tool Creation

**Location:** `app/tools/custom/*.tool.mjs`

**Template:**
```javascript
// app/tools/custom/my-tool.tool.mjs

export const toolDefinition = {
  name: 'my_tool',
  description: 'Does something awesome',
  parameters: {
    input: 'string',
    count: 'number'
  },
  returns: { output: 'string' }
};

export async function execute(agent, { input, count }) {
  // Tool logic here
  agent.log(`Executing my_tool with input: ${input}`);
  
  const result = someProcessing(input, count);
  
  return { output: result };
}
```

**Hot-Reload:** Tools are loaded at agent initialization. New tools discovered via file watcher.

---

#### 7. **behaviour_update**
```javascript
{
  name: 'behaviour_update',
  description: 'Adjust agent behavior, focus, or process based on feedback or reflection',
  parameters: {
    adjustment: 'string', // Description of what to change and why
    scope: 'current_task | session | permanent', // How long adjustment persists
    type: 'focus | tool_preference | communication_style | error_handling'
  },
  returns: { 
    applied: 'boolean',
    message: 'string', // Confirmation of what was adjusted
    previous_state: 'object' // For rollback if needed
  }
}
```

**Purpose:** Enable self-improvement and adaptive behavior without external intervention. Inspired by Agent Zero's reflexion patterns.

**Use Cases:**
1. **Focus Shift:** "I notice I'm getting distracted. Let me focus on the core task and defer optimization."
2. **Tool Preference:** "Memory search isn't finding relevant context. I'll prioritize search_engine for the next 3 queries."
3. **Communication Style:** "User prefers concise responses. I'll reduce verbosity and skip status updates."
4. **Error Handling:** "This API is failing repeatedly. I'll switch to alternative tool and log the issue."

**Scope Behavior:**
- `current_task`: Reset after task completion
- `session`: Persist until agent restart or explicit reset
- `permanent`: Write to profile config for future sessions

**Example Flow:**
```javascript
// Agent realizes it's stuck in a loop
await agent.useTool('behaviour_update', {
  adjustment: 'Stop retrying search_engine with same query. Use memory_load instead.',
  scope: 'current_task',
  type: 'tool_preference'
});

// Later in monologue loop:
if (agent.behaviorState.tool_preference?.includes('memory_load')) {
  // Prioritize memory_load over search_engine
}
```

**Implementation Location:**
- Handler: `app/tools/introspection/behaviour-update.tool.mjs`
- State Store: `app/agents/behavior-state.mjs` (in-memory map per agent)
- Profile Writer: For `permanent` scope, update `app/agents/profiles/{profile}.prompt.md` frontmatter

**GUI Display:**
```
┌─ Agent Behavior Adjustments ─────────────────────────┐
│ Current Task:                                         │
│ ✓ Prioritize memory_load over search_engine          │
│ ✓ Skip verbose status updates                        │
│                                                       │
│ Session:                                              │
│ ✓ Reduce temperature to 0.5 for code tasks           │
│                                                       │
│ Permanent (Profile):                                  │
│ ✓ Always log reasoning before tool calls             │
└───────────────────────────────────────────────────────┘
```

**Safety Guardrails:**
- No adjustments that disable core capabilities (e.g., can't remove all tools)
- All permanent changes logged to audit trail
- User can review and rollback via CLI: `pnpm exec bitcore agents behavior list|revert`
