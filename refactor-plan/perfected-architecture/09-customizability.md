<!--
Why: Expose sanctioned touchpoints where operators tailor agents, tools, themes, environments, and retention policies without forking the core.
What: Lists customization surfaces, their filesystem locations, and examples that illustrate safe extension patterns.
How: Breaks down each customization class with actionable steps and code snippets.
-->

# Customizability

## 1. Agent Profiles (System Prompts)
**Location:** `app/agents/profiles/*.prompt.md` + `catalog.json`  
**User can:**
- Edit existing profiles (coordinator, router, deep_researcher, site_builder, validator, sentinel)
- Create new profiles (drop-in markdown + manifest entry)
- Assign profiles to agents dynamically via CLI/GUI/MCP

## 2. Tool Registry
**Location:** `app/tools/custom/*.tool.mjs`  
**User can:**
- Add new tools (follow template)
- Disable default tools (edit `app/config/tools.json`)
- Override tool implementations

## 3. Extensions/Middleware
**Location:** `app/extensions/*.extension.mjs`  
**User can:**
- Add logging extensions (e.g., log to Elasticsearch)
- Add telemetry extensions (e.g., send metrics to Prometheus)
- Add security extensions (e.g., block certain tool calls)

**Example Extension:**
```javascript
// app/extensions/token-counter.extension.mjs

export const hooks = {
  after_reasoning: async ({ agent, reasoning }) => {
    const tokenCount = reasoning.split(' ').length; // Crude estimate
    agent.data.totalTokens = (agent.data.totalTokens || 0) + tokenCount;
    console.log(`Agent ${agent.name} used ${tokenCount} tokens (total: ${agent.data.totalTokens})`);
  }
};
```

## 4. UI Themes
**Location:** `app/public/themes/*.css` and `app/config/ui-themes.json`  
**User can:**
- Edit CSS variables (colors, fonts, spacing)
- Create new themes (duplicate existing, modify)
- Share themes as JSON+CSS bundles

## 5. Environment Configurations
**Location:** `computers/catalog/*.json`, `computers/custom/*.dockerfile`  
**User can:**
- Define custom environments (Dockerfile or OCI manifest)
- Pre-install tools via `extras` arrays in catalog entries
- Export/import catalog bundles (`bitcore computers bundle export/import`)

## 6. Memory Retention Policies
**Location:** `app/config/memory.json`  
**User can:**
- Adjust consolidation frequency (daily, weekly, manual)
- Set retention thresholds (days, relevance score)
- Define memory areas (main, solutions, fragments, custom)
