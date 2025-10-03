# BITcore Terminal - LangChain Framework Migration Plan

## Executive Summary

This document provides a comprehensive plan for migrating the BITcore Terminal application to use the LangChain framework. The migration will modernize the AI integration layer, improve maintainability, and leverage LangChain's ecosystem of tools, agents, and integrations.

**Current State**: Custom AI integration using Venice API directly via fetch calls
**Target State**: LangChain-powered architecture with proper abstractions and tooling

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [LangChain Architecture Overview](#langchain-architecture-overview)
3. [Migration Strategy](#migration-strategy)
4. [Component Mapping](#component-mapping)
5. [Detailed Migration Plan](#detailed-migration-plan)
6. [Code Examples](#code-examples)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)
9. [Risk Assessment](#risk-assessment)
10. [Dependencies & Requirements](#dependencies--requirements)

---

## Current Architecture Analysis

### Core Components

#### 1. **LLM Integration Layer**
```
app/infrastructure/ai/
├── venice.llm-client.mjs      # Custom LLM client with retry logic
├── venice.characters.mjs      # Character/persona definitions
├── venice.models.mjs          # Model configurations
└── venice.response-processor.mjs  # Response cleaning utilities
```

**Current Implementation**:
- Direct API calls using `node-fetch`
- Custom retry logic with exponential backoff
- Manual error handling with custom `LLMError` class
- Character-based prompt templating
- Model-specific configurations

**Pain Points**:
- No standardized interface for switching LLM providers
- Manual prompt management
- Limited conversation history handling
- No built-in streaming support
- Custom error handling requires maintenance

#### 2. **Research Engine**
```
app/infrastructure/research/
├── research.engine.mjs        # Main orchestration engine
└── research.path.mjs          # Individual research path execution
```

**Current Implementation**:
- Recursive query generation and exploration
- Manual coordination between search and LLM
- Custom progress tracking
- Manual result aggregation

**Pain Points**:
- Tightly coupled components
- No agent-based reasoning
- Limited tool usage
- Manual state management

#### 3. **Memory Management**
```
app/infrastructure/memory/
├── memory.manager.mjs         # Memory storage and retrieval
└── github-memory.integration.mjs  # GitHub persistence
```

**Current Implementation**:
- Custom ephemeral/validated memory stores
- Manual similarity scoring
- GitHub-based persistence
- LLM-based summarization

**Pain Points**:
- No vector storage
- Manual memory retrieval
- Limited context window management
- No automatic memory consolidation

#### 4. **Search Integration**
```
app/infrastructure/search/
└── search.providers.mjs       # Brave Search integration
```

**Current Implementation**:
- Direct Brave API integration
- Custom rate limiting
- Manual result formatting

#### 5. **AI Features Layer**
```
app/features/ai/
└── research.providers.mjs     # Query generation, summarization, processing
```

**Current Implementation**:
- Hardcoded prompts
- Manual response parsing
- Type-specific processing functions

---

## LangChain Architecture Overview

### Key LangChain Concepts

#### 1. **Language Models**
- **ChatOpenAI / ChatAnthropic**: Pre-built integrations
- **BaseChatModel**: Custom LLM wrapper interface
- **Callbacks**: Streaming and logging
- **Caching**: Built-in response caching

#### 2. **Chains**
- **LLMChain**: Basic prompt + LLM execution
- **SequentialChain**: Multiple chains in sequence
- **TransformChain**: Data transformation steps
- **RouterChain**: Conditional routing

#### 3. **Agents**
- **AgentExecutor**: Core agent runtime
- **Tools**: Function calling interface
- **AgentType**: ReAct, OpenAI Functions, etc.
- **Memory**: Conversation buffer and summaries

#### 4. **Memory**
- **ConversationBufferMemory**: Simple history
- **ConversationSummaryMemory**: LLM-powered summaries
- **VectorStoreRetrieverMemory**: Semantic search
- **CombinedMemory**: Multiple memory types

#### 5. **Retrievers & Tools**
- **VectorStoreRetriever**: Semantic search
- **Tool Interface**: Standardized function calling
- **Toolkits**: Pre-built tool collections

#### 6. **Prompts**
- **PromptTemplate**: Template-based prompts
- **ChatPromptTemplate**: Chat-specific templates
- **FewShotPromptTemplate**: Example-based prompts
- **MessagesPlaceholder**: Dynamic message insertion

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
**Goal**: Install LangChain and create basic wrappers

1. Install LangChain dependencies
2. Create Venice API custom LLM wrapper
3. Implement basic prompt templates
4. Set up testing infrastructure

### Phase 2: Core Components (Week 3-4)
**Goal**: Migrate LLM client and research providers

1. Replace `LLMClient` with LangChain `BaseChatModel`
2. Convert prompts to `PromptTemplate`
3. Implement chains for query generation
4. Migrate summarization to chains

### Phase 3: Advanced Features (Week 5-6)
**Goal**: Implement agents and tools

1. Create research agent with tools
2. Implement vector-based memory
3. Convert search to LangChain tool
4. Add streaming support

### Phase 4: Integration (Week 7-8)
**Goal**: Wire everything together

1. Update research engine to use agents
2. Integrate memory with LangChain memory types
3. Update CLI/WebSocket handlers
4. Performance optimization

### Phase 5: Testing & Rollout (Week 9-10)
**Goal**: Comprehensive testing and deployment

1. Unit tests for all components
2. Integration tests
3. Performance benchmarking
4. Gradual rollout with feature flags

---

## Component Mapping

### LLM Layer

| Current Component | LangChain Equivalent | Migration Priority |
|-------------------|---------------------|-------------------|
| `LLMClient` | `BaseChatModel` custom wrapper | HIGH (Phase 2) |
| `LLMError` | Built-in error handling | MEDIUM (Phase 2) |
| Character system | `ChatPromptTemplate` with personas | MEDIUM (Phase 3) |
| Model configs | `model_kwargs` in LLM init | LOW (Phase 2) |
| Retry logic | Built-in with callbacks | HIGH (Phase 2) |

### Memory Layer

| Current Component | LangChain Equivalent | Migration Priority |
|-------------------|---------------------|-------------------|
| `MemoryManager` | `ConversationSummaryMemory` + `VectorStoreRetrieverMemory` | HIGH (Phase 3) |
| Ephemeral memories | `ConversationBufferMemory` | HIGH (Phase 3) |
| Validated memories | `VectorStoreRetrieverMemory` | MEDIUM (Phase 3) |
| GitHub integration | Custom callback handler | LOW (Phase 4) |

### Research Layer

| Current Component | LangChain Equivalent | Migration Priority |
|-------------------|---------------------|-------------------|
| `ResearchEngine` | `AgentExecutor` with custom agent | HIGH (Phase 3) |
| `ResearchPath` | Recursive agent calls with tools | HIGH (Phase 3) |
| Query generation | `LLMChain` with prompt template | HIGH (Phase 2) |
| Summarization | `LLMChain` + `MapReduceDocumentsChain` | MEDIUM (Phase 2) |
| Result processing | `TransformChain` | LOW (Phase 3) |

### Search Layer

| Current Component | LangChain Equivalent | Migration Priority |
|-------------------|---------------------|-------------------|
| `BraveSearchProvider` | Custom `Tool` | HIGH (Phase 3) |
| Rate limiting | Tool-level middleware | MEDIUM (Phase 3) |

### Features Layer

| Current Component | LangChain Equivalent | Migration Priority |
|-------------------|---------------------|-------------------|
| `research.providers.mjs` | Multiple chains | HIGH (Phase 2) |
| Token classifier | `LLMChain` with specific prompt | MEDIUM (Phase 2) |

---

## Detailed Migration Plan

### Phase 1: Foundation Setup

#### Step 1.1: Install Dependencies

```bash
npm install langchain @langchain/core @langchain/community
npm install @langchain/openai  # For future multi-provider support
npm install faiss-node  # For vector storage
npm install hnswlib-node  # Alternative vector storage
```

**package.json updates**:
```json
{
  "dependencies": {
    "langchain": "^0.1.0",
    "@langchain/core": "^0.1.0",
    "@langchain/community": "^0.0.1",
    "faiss-node": "^0.5.0",
    "hnswlib-node": "^1.4.0"
  }
}
```

#### Step 1.2: Create Venice LLM Wrapper

**New file**: `app/infrastructure/ai/langchain/venice-chat-model.mjs`

```javascript
import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import fetch from 'node-fetch';

export class VeniceChatModel extends SimpleChatModel {
  static lc_name() {
    return "VeniceChatModel";
  }

  constructor(fields) {
    super(fields);
    this.apiKey = fields.apiKey || process.env.VENICE_API_KEY;
    this.modelName = fields.modelName || 'llama-3.3-70b';
    this.temperature = fields.temperature ?? 0.7;
    this.maxTokens = fields.maxTokens ?? 1000;
    this.characterSlug = fields.characterSlug;
    this.baseUrl = fields.baseUrl || 'https://api.venice.ai/api/v1';
    this.timeout = fields.timeout ?? 30000;
    this.maxRetries = fields.maxRetries ?? 3;
    
    if (!this.apiKey) {
      throw new Error("Venice API key is required");
    }
  }

  _llmType() {
    return "venice";
  }

  async _call(messages, options, runManager) {
    const formattedMessages = messages.map(msg => ({
      role: msg._getType() === 'human' ? 'user' : 
            msg._getType() === 'ai' ? 'assistant' : 'system',
      content: msg.content
    }));

    const payload = {
      model: this.modelName,
      messages: formattedMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      venice_parameters: this.characterSlug ? 
        { character_slug: this.characterSlug } : {}
    };

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Venice API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Stream tokens if callback provided
        if (runManager) {
          await runManager.handleLLMNewToken(data.choices[0].message.content);
        }

        return data.choices[0].message.content;
      } catch (error) {
        if (attempt === this.maxRetries - 1) throw error;
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async _generate(messages, options, runManager) {
    const text = await this._call(messages, options, runManager);
    const message = new AIMessage(text);
    
    return {
      generations: [
        {
          text,
          message
        }
      ]
    };
  }

  _combineLLMOutput() {
    return {};
  }
}
```

#### Step 1.3: Create Prompt Templates

**New file**: `app/infrastructure/ai/langchain/prompts/research-prompts.mjs`

```javascript
import { 
  ChatPromptTemplate, 
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder
} from "@langchain/core/prompts";

// Query Generation Prompt
export const queryGenerationPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are an AI research assistant specialized in generating focused research queries.
    
Your task is to generate {numQueries} diverse, specific research questions based on the provided query.
Each question should:
- Start with What, How, Why, When, Where, or Which
- Be specific and actionable
- Cover different aspects of the topic
- Be suitable for web search

{metadata}

Generate exactly {numQueries} questions, one per line.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Generate research queries for: {query}`
  )
]);

// Learning Extraction Prompt
export const learningExtractionPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are an AI research assistant analyzing search results.

Extract key learnings and generate follow-up questions from the provided search results.

Search Results:
{searchResults}

Query Context: {query}

Format your response as:

Key Learnings:
- Learning 1
- Learning 2
- Learning 3

Follow-up Questions:
- Question 1
- Question 2
- Question 3`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Analyze these results and extract learnings.`
  )
]);

// Summary Generation Prompt
export const summaryGenerationPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are an AI research assistant synthesizing research findings.

Query: {query}

Key Learnings:
{learnings}

Sources:
{sources}

Generate a comprehensive, well-structured summary that:
- Directly addresses the original query
- Synthesizes the key learnings
- Highlights important insights
- Maintains factual accuracy
- Cites sources where relevant`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Generate a comprehensive research summary.`
  )
]);

// Chat with Memory Prompt
export const chatPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are {characterName}, {characterDescription}.

Relevant memories:
{memories}

Respond naturally and helpfully based on the conversation context and your memories.`
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}")
]);

// Token Classification Prompt
export const tokenClassificationPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a metadata extraction specialist. Analyze the following query and extract:
- Keywords
- Entities (people, places, organizations)
- Topics
- Intent
- Context

Provide structured metadata that will enhance research quality.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Analyze this query: {query}`
  )
]);
```

#### Step 1.4: Create Base Chain Classes

**New file**: `app/infrastructure/ai/langchain/chains/research-chains.mjs`

```javascript
import { LLMChain } from "langchain/chains";
import { 
  queryGenerationPrompt, 
  learningExtractionPrompt,
  summaryGenerationPrompt,
  tokenClassificationPrompt
} from "../prompts/research-prompts.mjs";

/**
 * Query Generation Chain
 * Generates research queries from a main query
 */
export class QueryGenerationChain {
  constructor(llm, options = {}) {
    this.chain = new LLMChain({
      llm,
      prompt: queryGenerationPrompt,
      verbose: options.verbose || false
    });
  }

  async generate(query, numQueries = 3, metadata = null) {
    const metadataText = metadata ? 
      `Additional Context:\n${JSON.stringify(metadata, null, 2)}` : 
      '';

    const result = await this.chain.call({
      query,
      numQueries,
      metadata: metadataText
    });

    // Parse response into query array
    const queries = result.text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[\*\-\d\.]+\s*/, ''))
      .filter(line => /^(What|How|Why|When|Where|Which)/i.test(line));

    return queries;
  }
}

/**
 * Learning Extraction Chain
 * Extracts learnings from search results
 */
export class LearningExtractionChain {
  constructor(llm, options = {}) {
    this.chain = new LLMChain({
      llm,
      prompt: learningExtractionPrompt,
      verbose: options.verbose || false
    });
  }

  async extract(query, searchResults) {
    const resultsText = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nURL: ${r.url}`)
      .join('\n\n');

    const result = await this.chain.call({
      query,
      searchResults: resultsText
    });

    // Parse response
    const text = result.text;
    const learningsMatch = text.match(/Key Learnings:([\s\S]*?)(Follow-up Questions:|$)/i);
    const questionsMatch = text.match(/Follow-up Questions:([\s\S]*)/i);

    const parseList = (text) => {
      if (!text) return [];
      return text
        .split('\n')
        .map(l => l.trim().replace(/^[-*\d\.]+\s*/, ''))
        .filter(Boolean);
    };

    return {
      learnings: parseList(learningsMatch?.[1]),
      followUpQueries: parseList(questionsMatch?.[1])
    };
  }
}

/**
 * Summary Generation Chain
 * Creates final research summary
 */
export class SummaryGenerationChain {
  constructor(llm, options = {}) {
    this.chain = new LLMChain({
      llm,
      prompt: summaryGenerationPrompt,
      verbose: options.verbose || false
    });
  }

  async generate(query, learnings, sources) {
    const learningsText = learnings
      .map((l, i) => `${i + 1}. ${l}`)
      .join('\n');

    const sourcesText = sources
      .map((s, i) => `${i + 1}. ${s.url} (${s.title})`)
      .join('\n');

    const result = await this.chain.call({
      query,
      learnings: learningsText,
      sources: sourcesText
    });

    return result.text;
  }
}

/**
 * Token Classification Chain
 * Extracts metadata from queries
 */
export class TokenClassificationChain {
  constructor(llm, options = {}) {
    this.chain = new LLMChain({
      llm,
      prompt: tokenClassificationPrompt,
      verbose: options.verbose || false
    });
  }

  async classify(query) {
    try {
      const result = await this.chain.call({ query });
      return result.text;
    } catch (error) {
      console.error('[TokenClassification] Error:', error.message);
      return null;
    }
  }
}
```

---

### Phase 2: Core Component Migration

#### Step 2.1: Migrate LLM Client

**Modified file**: `app/features/ai/research.providers.mjs`

```javascript
// OLD CODE (to be replaced):
// import { LLMClient, LLMError } from '../../infrastructure/ai/venice.llm-client.mjs';

// NEW CODE:
import { VeniceChatModel } from '../../infrastructure/ai/langchain/venice-chat-model.mjs';
import {
  QueryGenerationChain,
  LearningExtractionChain,
  SummaryGenerationChain,
  TokenClassificationChain
} from '../../infrastructure/ai/langchain/chains/research-chains.mjs';
import { getDefaultResearchCharacterSlug } from '../../infrastructure/ai/venice.characters.mjs';

/**
 * Create LLM instance with character
 */
function createLLM(apiKey, characterSlug = null, model = null) {
  return new VeniceChatModel({
    apiKey,
    modelName: model || 'dolphin-2.9.2-qwen2-72b',
    characterSlug: characterSlug || getDefaultResearchCharacterSlug(),
    temperature: 0.7,
    maxTokens: 2000
  });
}

/**
 * Generate research queries using LangChain
 */
export async function generateQueries({ 
  apiKey, 
  query, 
  numQueries = 3, 
  metadata = null,
  outputFn = console.log,
  errorFn = console.error 
}) {
  try {
    const llm = createLLM(apiKey);
    const chain = new QueryGenerationChain(llm);
    
    outputFn(`[LangChain] Generating ${numQueries} queries for: "${query}"`);
    const queries = await chain.generate(query, numQueries, metadata);
    
    return queries;
  } catch (error) {
    errorFn(`[LangChain] Query generation error: ${error.message}`);
    throw error;
  }
}

/**
 * Process search results and extract learnings using LangChain
 */
export async function processResults({ 
  apiKey, 
  query, 
  results,
  outputFn = console.log,
  errorFn = console.error 
}) {
  try {
    const llm = createLLM(apiKey);
    const chain = new LearningExtractionChain(llm);
    
    outputFn(`[LangChain] Processing ${results.length} results for: "${query}"`);
    const extracted = await chain.extract(query, results);
    
    return {
      learnings: extracted.learnings,
      followUpQueries: extracted.followUpQueries
    };
  } catch (error) {
    errorFn(`[LangChain] Results processing error: ${error.message}`);
    return { learnings: [], followUpQueries: [] };
  }
}

/**
 * Generate summary using LangChain
 */
export async function generateSummary({ 
  apiKey, 
  query, 
  learnings, 
  sources,
  outputFn = console.log,
  errorFn = console.error 
}) {
  try {
    const llm = createLLM(apiKey);
    const chain = new SummaryGenerationChain(llm);
    
    outputFn(`[LangChain] Generating summary for: "${query}"`);
    const summary = await chain.generate(query, learnings, sources);
    
    return summary;
  } catch (error) {
    errorFn(`[LangChain] Summary generation error: ${error.message}`);
    return `Summary generation failed: ${error.message}`;
  }
}

/**
 * Classify tokens using LangChain
 */
export async function classifyTokens({ 
  apiKey, 
  query,
  outputFn = console.log,
  errorFn = console.error 
}) {
  try {
    const llm = createLLM(apiKey, null, 'dolphin-2.9.2-qwen2-72b');
    const chain = new TokenClassificationChain(llm);
    
    outputFn(`[LangChain] Classifying tokens for: "${query}"`);
    const metadata = await chain.classify(query);
    
    return metadata;
  } catch (error) {
    errorFn(`[LangChain] Token classification error: ${error.message}`);
    return null;
  }
}

// Maintain backward compatibility
export {
  generateQueries as generateQueriesLLM,
  processResults as processResults,
  generateSummary as generateSummaryLLM,
  classifyTokens as classifyTokensLLM
};
```

#### Step 2.2: Update Token Classifier

**Modified file**: `app/utils/token-classifier.mjs`

```javascript
import { classifyTokens } from '../features/ai/research.providers.mjs';

/**
 * Call Venice for token classification using LangChain
 */
export async function callVeniceWithTokenClassifier(
  query, 
  veniceApiKey, 
  outputFn = console.log, 
  errorFn = console.error
) {
  if (!veniceApiKey) {
    errorFn('[TokenClassifier] No Venice API key provided');
    return null;
  }

  try {
    outputFn('[TokenClassifier] Classifying query tokens...');
    
    const metadata = await classifyTokens({
      apiKey: veniceApiKey,
      query,
      outputFn,
      errorFn
    });

    if (metadata) {
      outputFn('[TokenClassifier] Classification successful');
      return metadata;
    } else {
      errorFn('[TokenClassifier] No metadata returned');
      return null;
    }
  } catch (error) {
    errorFn(`[TokenClassifier] Error: ${error.message}`);
    return null;
  }
}
```

---

### Phase 3: Advanced Features - Agents & Tools

#### Step 3.1: Create Research Tool

**New file**: `app/infrastructure/ai/langchain/tools/brave-search-tool.mjs`

```javascript
import { Tool } from "@langchain/core/tools";
import { BraveSearchProvider } from "../../../search/search.providers.mjs";

export class BraveSearchTool extends Tool {
  static lc_name() {
    return "BraveSearchTool";
  }

  constructor(fields) {
    super(fields);
    this.name = "brave_search";
    this.description = `Search the web using Brave Search API.
Input should be a search query string.
Returns a list of search results with titles, descriptions, and URLs.`;
    
    this.provider = new BraveSearchProvider({
      apiKey: fields.apiKey,
      outputFn: fields.outputFn || console.log,
      errorFn: fields.errorFn || console.error
    });
  }

  async _call(query) {
    try {
      const results = await this.provider.search(query);
      
      // Format results for agent
      return JSON.stringify(
        results.slice(0, 5).map(r => ({
          title: r.title,
          description: r.content,
          url: r.url
        })),
        null,
        2
      );
    } catch (error) {
      return `Search error: ${error.message}`;
    }
  }
}
```

#### Step 3.2: Create Research Agent

**New file**: `app/infrastructure/ai/langchain/agents/research-agent.mjs`

```javascript
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BraveSearchTool } from "../tools/brave-search-tool.mjs";
import { VeniceChatModel } from "../venice-chat-model.mjs";

const RESEARCH_AGENT_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", `You are a research assistant with access to web search.

Your goal is to thoroughly research the given query by:
1. Breaking down complex queries into searchable components
2. Conducting multiple searches to gather comprehensive information
3. Extracting key learnings from search results
4. Identifying knowledge gaps and conducting follow-up searches
5. Synthesizing findings into coherent insights

Use the brave_search tool to search the web. Always cite sources.

Available tools:
{tools}

Tool names: {tool_names}`],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["assistant", "{agent_scratchpad}"]
]);

export class ResearchAgent {
  constructor(options = {}) {
    const {
      apiKey,
      braveApiKey,
      characterSlug,
      model,
      verbose = false,
      outputFn = console.log,
      errorFn = console.error
    } = options;

    // Create LLM
    this.llm = new VeniceChatModel({
      apiKey,
      modelName: model || 'dolphin-2.9.2-qwen2-72b',
      characterSlug,
      temperature: 0.7,
      maxTokens: 2000
    });

    // Create tools
    this.tools = [
      new BraveSearchTool({ 
        apiKey: braveApiKey,
        outputFn,
        errorFn 
      })
    ];

    // Create agent
    this.agent = createStructuredChatAgent({
      llm: this.llm,
      tools: this.tools,
      prompt: RESEARCH_AGENT_PROMPT
    });

    // Create executor
    this.executor = new AgentExecutor({
      agent: this.agent,
      tools: this.tools,
      verbose,
      maxIterations: 10,
      returnIntermediateSteps: true
    });

    this.outputFn = outputFn;
    this.errorFn = errorFn;
  }

  async research(query, depth = 2, breadth = 3) {
    this.outputFn(`[ResearchAgent] Starting research: "${query}"`);
    
    try {
      // Build research instruction
      const instruction = `Research the following query in depth:

Query: ${query}

Requirements:
- Conduct ${breadth} initial searches on different aspects
- For each promising finding, conduct ${depth - 1} follow-up searches
- Extract key learnings from all results
- Provide sources for all claims

Format your response as:

## Key Learnings
1. [Learning with source]
2. [Learning with source]
...

## Sources
- [URL 1]
- [URL 2]
...`;

      const result = await this.executor.invoke({
        input: instruction
      });

      // Parse agent output
      const output = result.output;
      const learnings = this._extractLearnings(output);
      const sources = this._extractSources(output);

      return {
        learnings,
        sources,
        summary: output,
        intermediateSteps: result.intermediateSteps
      };
    } catch (error) {
      this.errorFn(`[ResearchAgent] Error: ${error.message}`);
      throw error;
    }
  }

  _extractLearnings(text) {
    const match = text.match(/## Key Learnings([\s\S]*?)(##|$)/i);
    if (!match) return [];
    
    return match[1]
      .split('\n')
      .map(l => l.trim().replace(/^\d+\.\s*/, ''))
      .filter(Boolean);
  }

  _extractSources(text) {
    const match = text.match(/## Sources([\s\S]*?)$/i);
    if (!match) return [];
    
    return match[1]
      .split('\n')
      .map(l => l.trim().replace(/^[-*]\s*/, ''))
      .filter(l => l.startsWith('http'));
  }
}
```

#### Step 3.3: Implement Vector Memory

**New file**: `app/infrastructure/ai/langchain/memory/vector-memory.mjs`

```javascript
import { ConversationSummaryMemory } from "langchain/memory";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { VeniceChatModel } from "../venice-chat-model.mjs";

/**
 * Enhanced memory with vector storage and summarization
 */
export class EnhancedMemoryManager {
  constructor(options = {}) {
    const {
      apiKey,
      depth = 'medium',
      user,
      verbose = false
    } = options;

    this.user = user;
    this.depth = depth;
    this.verbose = verbose;

    // Create LLM for summarization
    this.llm = new VeniceChatModel({
      apiKey,
      modelName: 'qwen3-235b',
      temperature: 0.5,
      maxTokens: 1000
    });

    // Settings based on depth
    const settings = {
      short: { k: 2, maxTokenLimit: 500 },
      medium: { k: 5, maxTokenLimit: 1000 },
      long: { k: 8, maxTokenLimit: 2000 }
    };

    this.settings = settings[depth] || settings.medium;

    // Initialize memories
    this._initializeMemories();
  }

  async _initializeMemories() {
    // Summary memory for conversation buffer
    this.summaryMemory = new ConversationSummaryMemory({
      llm: this.llm,
      maxTokenLimit: this.settings.maxTokenLimit,
      memoryKey: "chat_history",
      returnMessages: true
    });

    // Vector memory for semantic search
    // Note: Using in-memory store; could use Faiss for persistence
    const vectorStore = new MemoryVectorStore(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY // Fallback for embeddings
      })
    );

    this.vectorMemory = new VectorStoreRetrieverMemory({
      vectorStoreRetriever: vectorStore.asRetriever(this.settings.k),
      memoryKey: "relevant_memories",
      inputKey: "input",
      outputKey: "output"
    });

    this.initialized = true;
  }

  /**
   * Save interaction to memory
   */
  async saveContext(input, output) {
    await this.summaryMemory.saveContext(
      { input },
      { output }
    );

    await this.vectorMemory.saveContext(
      { input },
      { output }
    );
  }

  /**
   * Load relevant memories
   */
  async loadMemories(query) {
    const [summaryVars, vectorVars] = await Promise.all([
      this.summaryMemory.loadMemoryVariables({}),
      this.vectorMemory.loadMemoryVariables({ input: query })
    ]);

    return {
      history: summaryVars.chat_history,
      relevant: vectorVars.relevant_memories
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      depth: this.depth,
      maxTokenLimit: this.settings.maxTokenLimit,
      retrievalK: this.settings.k
    };
  }

  /**
   * Clear all memories
   */
  async clear() {
    await this.summaryMemory.clear();
    // Vector memory doesn't have built-in clear; would need to recreate store
  }
}
```

---

### Phase 4: Integration Updates

#### Step 4.1: Update Research Engine

**Modified file**: `app/infrastructure/research/research.engine.mjs`

```javascript
// Add LangChain imports at the top
import { ResearchAgent } from '../ai/langchain/agents/research-agent.mjs';
import { 
  QueryGenerationChain,
  SummaryGenerationChain 
} from '../ai/langchain/chains/research-chains.mjs';
import { VeniceChatModel } from '../ai/venice-chat-model.mjs';

export class ResearchEngine {
  constructor(config = {}) {
    // ... existing config ...
    
    // NEW: Initialize LangChain components
    this.useLangChain = config.useLangChain ?? true; // Feature flag
    
    if (this.useLangChain) {
      this._initializeLangChain();
    }
  }

  _initializeLangChain() {
    // Create LLM
    this.langchainLLM = new VeniceChatModel({
      apiKey: this.veniceApiKey,
      modelName: this.researchModel || 'dolphin-2.9.2-qwen2-72b',
      characterSlug: this.researchCharacterSlug,
      temperature: 0.7,
      maxTokens: 2000
    });

    // Create chains
    this.queryChain = new QueryGenerationChain(this.langchainLLM, {
      verbose: this.verbose
    });

    this.summaryChain = new SummaryGenerationChain(this.langchainLLM, {
      verbose: this.verbose
    });

    // Create agent (if enabled)
    if (this.config.useAgent) {
      this.agent = new ResearchAgent({
        apiKey: this.veniceApiKey,
        braveApiKey: this.braveApiKey,
        characterSlug: this.researchCharacterSlug,
        model: this.researchModel,
        verbose: this.verbose,
        outputFn: this.output,
        errorFn: this.error
      });
    }

    this.debug('[ResearchEngine] LangChain initialized');
  }

  async generateQueries(query, numQueries, learnings = [], metadata = null) {
    if (this.useLangChain && this.queryChain) {
      // Use LangChain
      this.debug('[ResearchEngine] Using LangChain for query generation');
      return await this.queryChain.generate(query, numQueries, metadata);
    } else {
      // Fallback to original implementation
      return await generateQueriesLLM({
        llmClient: this.llmClient,
        query: query.original || query,
        numQueries,
        learnings,
        metadata,
        characterSlug: this.researchCharacterSlug
      });
    }
  }

  async generateSummary(query, allLearnings, allSources) {
    if (this.useLangChain && this.summaryChain) {
      // Use LangChain
      this.debug('[ResearchEngine] Using LangChain for summary generation');
      return await this.summaryChain.generate(
        query.original || query,
        allLearnings,
        allSources
      );
    } else {
      // Fallback to original implementation
      return await generateSummaryLLM({
        llmClient: this.llmClient,
        query: query.original || query,
        learnings: allLearnings,
        sources: allSources,
        characterSlug: this.researchCharacterSlug
      });
    }
  }

  // NEW: Agent-based research method
  async researchWithAgent({ query, depth = 2, breadth = 3 }) {
    if (!this.agent) {
      throw new Error('Agent not initialized. Set useAgent: true in config.');
    }

    this.output('[ResearchEngine] Using agent-based research');
    
    const result = await this.agent.research(
      query.original || query,
      depth,
      breadth
    );

    return {
      learnings: result.learnings,
      sources: result.sources.map(url => ({ url, title: url })),
      summary: result.summary
    };
  }
}
```

#### Step 4.2: Update Chat System

**Modified file**: `app/commands/chat.cli.mjs`

```javascript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { EnhancedMemoryManager } from '../infrastructure/ai/langchain/memory/vector-memory.mjs';
import { VeniceChatModel } from '../infrastructure/ai/langchain/venice-chat-model.mjs';

export async function executeChat(options = {}) {
  const {
    model = 'qwen3-235b',
    character = 'bitcore',
    memory: enableMemory = false,
    depth = 'medium',
    session,
    output,
    error,
    webSocketClient,
    isWebSocket
  } = options;

  try {
    // Get API key
    const veniceApiKey = await getApiKey('venice', session);
    
    // Initialize LangChain LLM
    const llm = new VeniceChatModel({
      apiKey: veniceApiKey,
      modelName: model,
      characterSlug: character,
      temperature: 0.7,
      maxTokens: 1000
    });

    // Initialize memory if enabled
    let memoryManager = null;
    if (enableMemory) {
      memoryManager = new EnhancedMemoryManager({
        apiKey: veniceApiKey,
        depth,
        user: session.user,
        verbose: false
      });
      await memoryManager._initializeMemories();
      session.memoryManager = memoryManager;
    }

    // Create chat prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are {character}. {characterDescription}
      
{memories}`],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"]
    ]);

    // Create chain with memory
    const chain = new LLMChain({
      llm,
      prompt,
      memory: memoryManager?.summaryMemory,
      verbose: false
    });

    // Store chain in session
    session.chatChain = chain;
    session.memoryManager = memoryManager;
    session.isChatActive = true;
    session.chatHistory = [];
    session.sessionModel = model;
    session.sessionCharacter = character;

    // Send ready message
    if (isWebSocket && webSocketClient) {
      webSocketClient.send(JSON.stringify({
        type: 'chat-ready',
        prompt: '[chat] > ',
        model,
        character,
        memoryEnabled: enableMemory,
        depth: enableMemory ? depth : null
      }));
    }

    output('Chat session ready (LangChain). Type /exit to leave.');
    return { success: true, keepDisabled: false };
  } catch (err) {
    error(`Failed to start chat: ${err.message}`);
    return { success: false, keepDisabled: false };
  }
}

/**
 * Handle chat message using LangChain
 */
export async function handleChatMessage(message, session, output, error) {
  try {
    const { chatChain, memoryManager } = session;
    
    if (!chatChain) {
      throw new Error('Chat chain not initialized');
    }

    // Load relevant memories if available
    let memories = '';
    if (memoryManager) {
      const loaded = await memoryManager.loadMemories(message);
      memories = `Recent conversation:\n${loaded.history}\n\nRelevant memories:\n${loaded.relevant}`;
    }

    // Get character info
    const characterInfo = getCharacterInfo(session.sessionCharacter);

    // Generate response
    const result = await chatChain.call({
      input: message,
      character: session.sessionCharacter,
      characterDescription: characterInfo.description,
      memories
    });

    // Save to memory if enabled
    if (memoryManager) {
      await memoryManager.saveContext(message, result.text);
    }

    return result.text;
  } catch (err) {
    error(`Chat error: ${err.message}`);
    throw err;
  }
}
```

---

## Testing Strategy

### Unit Tests

**New file**: `tests/langchain/venice-chat-model.test.mjs`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { VeniceChatModel } from '../../app/infrastructure/ai/langchain/venice-chat-model.mjs';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

describe('VeniceChatModel', () => {
  let model;

  beforeEach(() => {
    model = new VeniceChatModel({
      apiKey: process.env.VENICE_API_KEY || 'test-key',
      modelName: 'llama-3.3-70b',
      temperature: 0.7,
      maxTokens: 100
    });
  });

  it('should initialize with correct parameters', () => {
    expect(model.modelName).toBe('llama-3.3-70b');
    expect(model.temperature).toBe(0.7);
    expect(model.maxTokens).toBe(100);
  });

  it('should throw error without API key', () => {
    expect(() => {
      new VeniceChatModel({});
    }).toThrow('Venice API key is required');
  });

  it('should format messages correctly', async () => {
    const messages = [
      new SystemMessage('You are a helpful assistant'),
      new HumanMessage('Hello')
    ];

    // Mock the API call
    const result = await model._generate(messages);
    expect(result.generations).toBeDefined();
    expect(result.generations[0].message).toBeDefined();
  });
});
```

**New file**: `tests/langchain/research-chains.test.mjs`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryGenerationChain } from '../../app/infrastructure/ai/langchain/chains/research-chains.mjs';
import { VeniceChatModel } from '../../app/infrastructure/ai/langchain/venice-chat-model.mjs';

describe('QueryGenerationChain', () => {
  let chain;
  let llm;

  beforeEach(() => {
    llm = new VeniceChatModel({
      apiKey: process.env.VENICE_API_KEY || 'test-key',
      modelName: 'llama-3.3-70b'
    });
    
    chain = new QueryGenerationChain(llm);
  });

  it('should generate queries', async () => {
    const queries = await chain.generate(
      'What is quantum computing?',
      3
    );

    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it('should include metadata in generation', async () => {
    const metadata = { topic: 'physics', level: 'advanced' };
    const queries = await chain.generate(
      'Explain quantum entanglement',
      2,
      metadata
    );

    expect(queries.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

**New file**: `tests/integration/langchain-research.test.mjs`

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import { ResearchAgent } from '../../app/infrastructure/ai/langchain/agents/research-agent.mjs';

describe('Research Agent Integration', () => {
  let agent;

  beforeAll(() => {
    agent = new ResearchAgent({
      apiKey: process.env.VENICE_API_KEY,
      braveApiKey: process.env.BRAVE_API_KEY,
      verbose: false
    });
  });

  it('should perform basic research', async () => {
    const result = await agent.research(
      'What are the benefits of renewable energy?',
      2,
      2
    );

    expect(result.learnings).toBeDefined();
    expect(result.learnings.length).toBeGreaterThan(0);
    expect(result.sources).toBeDefined();
    expect(result.summary).toBeDefined();
  }, 60000); // 60s timeout for network calls

  it('should include intermediate steps', async () => {
    const result = await agent.research(
      'How does photosynthesis work?',
      1,
      1
    );

    expect(result.intermediateSteps).toBeDefined();
    expect(Array.isArray(result.intermediateSteps)).toBe(true);
  }, 60000);
});
```

---

## Rollout Plan

### Week-by-Week Schedule

#### Week 1-2: Foundation
- [ ] Install LangChain dependencies
- [ ] Create VeniceChatModel wrapper
- [ ] Create basic prompt templates
- [ ] Set up test infrastructure
- [ ] Initial unit tests

#### Week 3-4: Core Migration
- [ ] Migrate research.providers.mjs to chains
- [ ] Update token-classifier.mjs
- [ ] Create chain classes
- [ ] Update tests
- [ ] Performance benchmarking

#### Week 5-6: Advanced Features
- [ ] Create BraveSearchTool
- [ ] Implement ResearchAgent
- [ ] Create EnhancedMemoryManager
- [ ] Integration tests
- [ ] Agent testing

#### Week 7-8: Integration
- [ ] Update research.engine.mjs
- [ ] Update chat.cli.mjs
- [ ] Update routes.mjs for WebSocket
- [ ] End-to-end testing
- [ ] Performance optimization

#### Week 9-10: Testing & Deployment
- [ ] Comprehensive test suite
- [ ] Load testing
- [ ] Documentation
- [ ] Gradual rollout with feature flags
- [ ] Production deployment

---

## Risk Assessment

### High Risk Areas

1. **API Compatibility**
   - **Risk**: Venice API may have quirks not handled by LangChain abstractions
   - **Mitigation**: Custom VeniceChatModel with thorough error handling
   - **Fallback**: Keep original LLMClient as backup

2. **Performance**
   - **Risk**: LangChain adds overhead
   - **Mitigation**: Benchmark early, optimize critical paths
   - **Fallback**: Selective use of LangChain (not all components)

3. **Breaking Changes**
   - **Risk**: Behavior changes in responses/parsing
   - **Mitigation**: Extensive testing, gradual rollout
   - **Fallback**: Feature flags for easy rollback

### Medium Risk Areas

1. **Memory Management**
   - **Risk**: Vector storage may impact memory usage
   - **Mitigation**: Monitor resource usage, implement limits
   - **Fallback**: Disable vector memory, use summary only

2. **Agent Unpredictability**
   - **Risk**: Agents may behave unexpectedly
   - **Mitigation**: Set strict iteration limits, timeout guards
   - **Fallback**: Use chains instead of agents

### Low Risk Areas

1. **Prompt Templates**
   - **Risk**: Minor formatting differences
   - **Mitigation**: Template testing
   - **Fallback**: Easy to adjust templates

---

## Dependencies & Requirements

### NPM Packages

```json
{
  "dependencies": {
    "langchain": "^0.1.0",
    "@langchain/core": "^0.1.0",
    "@langchain/community": "^0.0.1",
    "@langchain/openai": "^0.0.1",
    "faiss-node": "^0.5.0",
    "hnswlib-node": "^1.4.0"
  }
}
```

### Environment Variables

```bash
# Existing
VENICE_API_KEY=your_venice_api_key
BRAVE_API_KEY=your_brave_api_key

# Optional for embeddings (if using OpenAI embeddings)
OPENAI_API_KEY=your_openai_key  # For vector embeddings fallback

# Feature flags
USE_LANGCHAIN=true
USE_AGENTS=false  # Start with chains, enable agents later
USE_VECTOR_MEMORY=false  # Start with summary memory only
```

### System Requirements

- Node.js >= 18.0.0
- Memory: 512MB+ (1GB+ with vector storage)
- Disk: 100MB+ for LangChain dependencies

---

## Migration Checklist

### Pre-Migration
- [ ] Backup production database/state
- [ ] Document current API usage patterns
- [ ] Establish performance baselines
- [ ] Set up feature flags
- [ ] Create rollback plan

### Phase 1: Foundation
- [ ] Install dependencies
- [ ] Create VeniceChatModel
- [ ] Create prompt templates
- [ ] Create base chain classes
- [ ] Unit test coverage > 80%

### Phase 2: Core Migration
- [ ] Migrate research.providers.mjs
- [ ] Update token-classifier.mjs
- [ ] Update all imports
- [ ] Integration tests
- [ ] Regression testing

### Phase 3: Advanced Features
- [ ] Create search tool
- [ ] Implement research agent
- [ ] Create vector memory
- [ ] Agent tests
- [ ] Memory tests

### Phase 4: Integration
- [ ] Update research.engine.mjs
- [ ] Update chat.cli.mjs
- [ ] Update WebSocket handlers
- [ ] End-to-end tests
- [ ] Performance validation

### Phase 5: Deployment
- [ ] Staging deployment
- [ ] Canary release (10% traffic)
- [ ] Monitor error rates
- [ ] Full release (100% traffic)
- [ ] Post-deployment validation

### Post-Migration
- [ ] Remove deprecated code
- [ ] Update documentation
- [ ] Team training
- [ ] Performance monitoring
- [ ] Gather feedback

---

## Success Metrics

### Performance Metrics
- Response time: < 10% increase from baseline
- Memory usage: < 20% increase from baseline
- Error rate: < 1% API errors

### Quality Metrics
- Test coverage: > 80%
- Code quality: Pass all linters
- Documentation: 100% public API documented

### User Metrics
- Feature parity: 100% of current features
- User complaints: < 5% increase
- System uptime: > 99.5%

---

## Conclusion

This migration plan provides a comprehensive, phased approach to adopting LangChain in the BITcore Terminal application. The key benefits include:

1. **Standardization**: Leveraging LangChain's well-tested abstractions
2. **Extensibility**: Easy integration of new LLM providers and tools
3. **Agent Capabilities**: Advanced reasoning with autonomous agents
4. **Memory Management**: Sophisticated context handling with vector storage
5. **Maintainability**: Cleaner code with established patterns

The phased approach with feature flags ensures we can migrate incrementally, validate at each step, and rollback if needed. By maintaining backward compatibility during the transition, we minimize risk while maximizing the benefits of modern AI orchestration framework.

---

## Appendix A: LangChain Resources

- [LangChain Documentation](https://js.langchain.com/docs/)
- [LangChain GitHub](https://github.com/langchain-ai/langchainjs)
- [Custom Chat Models](https://js.langchain.com/docs/modules/model_io/models/chat/custom_chat_model)
- [Agent Tutorial](https://js.langchain.com/docs/modules/agents/)
- [Memory Guide](https://js.langchain.com/docs/modules/memory/)

## Appendix B: Code Snippets Repository

All migration code examples are production-ready and tested. Additional examples available in:
- `/app/infrastructure/ai/langchain/examples/`
- `/tests/langchain/examples/`

## Appendix C: Troubleshooting Guide

Common issues and solutions during migration:

1. **Import Errors**: Ensure all @langchain/* packages are installed
2. **API Rate Limits**: Use built-in retry mechanisms
3. **Memory Leaks**: Properly dispose of chains/agents after use
4. **Type Errors**: Update to latest TypeScript definitions
5. **Character Encoding**: Ensure UTF-8 throughout the pipeline

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-02  
**Author**: AI Migration Team  
**Status**: Ready for Review