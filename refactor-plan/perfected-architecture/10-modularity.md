<!--
Why: Keep the platform maintainable by enforcing single-responsibility modules, explicit contracts, and testable seams.
What: Documents the structural principles, directory layout, and example workflows for extending the system safely.
How: Enumerates design rules, shows canonical tree layouts, and walks through a new tool addition using the modular pattern.
-->

# Modularity & Composition

## Design Principles

1. **Single Responsibility:** Each module (file) does one thing.
2. **Dependency Injection:** Modules accept dependencies as constructor args or function params.
3. **Interface Contracts:** Modules export well-defined APIs (JSDoc, TypeScript types).
4. **Hot-Reload Friendly:** Modules can be reloaded without restarting server.
5. **Testing Isolation:** Modules testable without real LLMs, databases, or network.

## Module Structure

```
framework/
  agents/
    base-agent.mjs
    agent-context.mjs
    profiles/
      coordinator.prompt.md
      router.prompt.md
      validator.prompt.md
  tools/
    core/
      code-execution.tool.mjs
      select-computer.tool.mjs
      memory-save.tool.mjs
    custom/
      my-tool.tool.mjs
  extensions/
    token-counter.extension.mjs
    telemetry.extension.mjs
  interface/
    web/
      components/
      themes/
    tui/
      panels/
  infrastructure/
    ai/
      venice-llm-client.mjs
      ollama-client.mjs
    docker/
      environment-manager.service.mjs
    memory/
      faiss.service.mjs

projects/
  {mission-id}/
    inputs/
    outputs/
    site/

computers/
  seed/
  catalog/
  cache/

plugins/
  plugin-id/
    manifest.json
    lib/
    assets/

tests/
  agents/
    base-agent.test.mjs
    delegation.test.mjs
  tools/
    select-computer.test.mjs
    memory-save.test.mjs
  interface/
    theme-switcher.test.mjs
```

## Example: Adding a New Tool

**1. Create tool file:**
```javascript
// app/tools/custom/weather-lookup.tool.mjs

export const toolDefinition = {
  name: 'weather_lookup',
  description: 'Get current weather for a location',
  parameters: {
    location: 'string', // City name or lat/lng
    units: 'metric | imperial' // Temperature units
  },
  returns: { temp: 'number', conditions: 'string' }
};

export async function execute(agent, { location, units = 'metric' }) {
  const apiKey = await agent.context.getSecret('openweather_api_key');
  
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${location}&units=${units}&appid=${apiKey}`
  );
  
  const data = await response.json();
  
  return {
    temp: data.main.temp,
    conditions: data.weather[0].description
  };
}
```

**2. Register tool (automatic via file watcher, or manual):**
```javascript
// app/config/tools.json
{
  "enabled": [
    "code_execution",
    "search_engine",
    "weather_lookup"  // Add new tool
  ]
}
```

**3. Agent now has access:**
```javascript
const agent = new BaseAgent(0, config, context);

const result = await agent.callTool('weather_lookup', {
  location: 'San Francisco',
  units: 'imperial'
});

console.log(`Temperature: ${result.temp}°F, Conditions: ${result.conditions}`);
```
