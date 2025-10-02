# LangChain Migration - Quick Start Guide

This is a condensed reference guide for the LangChain migration. For the complete plan, see [LANGCHAIN_MIGRATION_PLAN.md](./LANGCHAIN_MIGRATION_PLAN.md).

## Installation

```bash
# Install LangChain core packages
npm install langchain @langchain/core @langchain/community

# Optional: Vector storage for advanced memory
npm install faiss-node hnswlib-node

# Optional: Multi-provider support
npm install @langchain/openai
```

## Quick Component Reference

### 1. Venice LLM Wrapper

```javascript
import { VeniceChatModel } from './app/infrastructure/ai/langchain/venice-chat-model.mjs';

const llm = new VeniceChatModel({
  apiKey: process.env.VENICE_API_KEY,
  modelName: 'llama-3.3-70b',
  temperature: 0.7,
  maxTokens: 1000
});
```

### 2. Simple Chain

```javascript
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromTemplate(
  "Answer this question: {question}"
);

const chain = new LLMChain({ llm, prompt });
const result = await chain.call({ question: "What is AI?" });
```

### 3. Research Agent

```javascript
import { ResearchAgent } from './app/infrastructure/ai/langchain/agents/research-agent.mjs';

const agent = new ResearchAgent({
  apiKey: veniceApiKey,
  braveApiKey: braveApiKey,
  model: 'dolphin-2.9.2-qwen2-72b'
});

const results = await agent.research(
  "What is quantum computing?",
  depth = 2,
  breadth = 3
);
```

### 4. Enhanced Memory

```javascript
import { EnhancedMemoryManager } from './app/infrastructure/ai/langchain/memory/vector-memory.mjs';

const memory = new EnhancedMemoryManager({
  apiKey: veniceApiKey,
  depth: 'medium',
  user: currentUser
});

// Save interaction
await memory.saveContext(userInput, aiResponse);

// Load relevant memories
const memories = await memory.loadMemories(query);
```

## Migration Checklist

### Phase 1: Foundation (Weeks 1-2)
- [ ] Install dependencies
- [ ] Create VeniceChatModel wrapper
- [ ] Create prompt templates
- [ ] Set up tests

### Phase 2: Core (Weeks 3-4)
- [ ] Migrate research.providers.mjs
- [ ] Update token-classifier.mjs
- [ ] Create chain classes
- [ ] Update tests

### Phase 3: Advanced (Weeks 5-6)
- [ ] Create tools (BraveSearchTool)
- [ ] Implement agents
- [ ] Add vector memory
- [ ] Integration tests

### Phase 4: Integration (Weeks 7-8)
- [ ] Update research.engine.mjs
- [ ] Update chat.cli.mjs
- [ ] WebSocket integration
- [ ] Performance tuning

### Phase 5: Deployment (Weeks 9-10)
- [ ] Comprehensive testing
- [ ] Feature flag rollout
- [ ] Monitor metrics
- [ ] Production deployment

## Key Differences: Old vs New

### LLM Client

**Before:**
```javascript
const client = new LLMClient({ apiKey });
const response = await client.complete({
  system: "You are helpful",
  prompt: "Hello",
  temperature: 0.7
});
```

**After:**
```javascript
const llm = new VeniceChatModel({ apiKey });
const messages = [
  new SystemMessage("You are helpful"),
  new HumanMessage("Hello")
];
const response = await llm._generate(messages);
```

### Query Generation

**Before:**
```javascript
const queries = await generateQueries({
  apiKey,
  query: "topic",
  numQueries: 3
});
```

**After:**
```javascript
const chain = new QueryGenerationChain(llm);
const queries = await chain.generate("topic", 3);
```

### Memory Management

**Before:**
```javascript
const memory = new MemoryManager({
  depth: 'medium',
  user: currentUser
});
```

**After:**
```javascript
const memory = new EnhancedMemoryManager({
  apiKey,
  depth: 'medium',
  user: currentUser
});
// Now includes vector storage and semantic search
```

## Feature Flags

Enable LangChain features gradually:

```javascript
// In research.engine.mjs
this.useLangChain = config.useLangChain ?? true;
this.useAgent = config.useAgent ?? false;
this.useVectorMemory = config.useVectorMemory ?? false;
```

Environment variables:
```bash
USE_LANGCHAIN=true
USE_AGENTS=false
USE_VECTOR_MEMORY=false
```

## Testing

### Unit Test Example

```javascript
import { describe, it, expect } from 'vitest';
import { VeniceChatModel } from './venice-chat-model.mjs';

describe('VeniceChatModel', () => {
  it('should initialize correctly', () => {
    const model = new VeniceChatModel({
      apiKey: 'test-key',
      modelName: 'llama-3.3-70b'
    });
    expect(model.modelName).toBe('llama-3.3-70b');
  });
});
```

### Integration Test Example

```javascript
describe('Research Agent', () => {
  it('should perform research', async () => {
    const agent = new ResearchAgent({
      apiKey: process.env.VENICE_API_KEY,
      braveApiKey: process.env.BRAVE_API_KEY
    });
    
    const result = await agent.research('AI', 1, 1);
    expect(result.learnings).toBeDefined();
    expect(result.sources).toBeDefined();
  }, 30000);
});
```

## Common Issues & Solutions

### 1. Import Errors
```bash
Error: Cannot find module '@langchain/core'
```
**Solution**: Install all required packages
```bash
npm install langchain @langchain/core @langchain/community
```

### 2. API Key Not Found
```bash
Error: Venice API key is required
```
**Solution**: Set environment variable or pass in config
```bash
export VENICE_API_KEY=your_key_here
```

### 3. Memory Leaks
```javascript
// Always dispose of chains/agents when done
await chain.dispose?.();
await agent.executor.dispose?.();
```

### 4. Rate Limiting
```javascript
// LangChain has built-in retry logic
const llm = new VeniceChatModel({
  apiKey,
  maxRetries: 3,
  timeout: 30000
});
```

## Performance Benchmarks

Target metrics after migration:

| Metric | Baseline | Target | Max Acceptable |
|--------|----------|--------|----------------|
| Response Time | 2.5s | < 2.75s | < 3.0s |
| Memory Usage | 200MB | < 240MB | < 280MB |
| Error Rate | 0.5% | < 0.5% | < 1.0% |
| Test Coverage | 70% | > 80% | > 75% |

## Rollback Plan

If issues arise:

1. **Disable via Feature Flag**
   ```javascript
   USE_LANGCHAIN=false
   ```

2. **Revert to Previous Version**
   ```bash
   git revert <commit-hash>
   npm install
   pm2 restart mcp-backend
   ```

3. **Selective Rollback**
   - Keep chains, disable agents
   - Use LangChain for new features only
   - Gradual feature-by-feature rollback

## Resources

- **Full Migration Plan**: [LANGCHAIN_MIGRATION_PLAN.md](./LANGCHAIN_MIGRATION_PLAN.md)
- **LangChain Docs**: https://js.langchain.com/docs/
- **Examples**: `/app/infrastructure/ai/langchain/examples/`
- **Tests**: `/tests/langchain/`

## Support

For questions or issues during migration:

1. Check the [Full Migration Plan](./LANGCHAIN_MIGRATION_PLAN.md)
2. Review [Appendix C: Troubleshooting Guide](./LANGCHAIN_MIGRATION_PLAN.md#appendix-c-troubleshooting-guide)
3. Check LangChain documentation
4. Review test examples for patterns

---

**Quick Start Version**: 1.0  
**Last Updated**: 2025-01-02  
**See also**: [LANGCHAIN_MIGRATION_PLAN.md](./LANGCHAIN_MIGRATION_PLAN.md)
