
# Deep Research: Technical Documentation for Old App but still applies to New app

Key differences for the new app is the token classifiers, users, and similar.

## System Architecture Overview

The Deep Research system implements a privacy-focused research pipeline combining AI analysis with privacy-centric search capabilities. The architecture follows a modular design with strict separation of concerns.

### Core System Components and Data Flow

```mermaid
graph TD
    A[ResearchEngine] --> B[ResearchPath]
    B --> C[BraveSearchProvider]
    B --> D[LLMClient]
    D --> E[VeniceAI Integration]
    C --> F[Rate Limiter]
    F --> G[Result Processing]
    G --> H[Content Sanitization]
    H --> I[Learning Extraction]
    I --> J[Source Tracking]
    K[OutputManager] --> L[Progress Tracking]
```

## Detailed Component Architecture

### 1. Research Engine Core (ResearchEngine)

The ResearchEngine orchestrates the research process with:

```mermaid
sequenceDiagram
    participant Client
    participant Engine
    participant Config
    participant Progress
    
    Client->>Engine: Initialize(query, depth, breadth)
    Engine->>Config: ValidateConfig()
    Engine->>Progress: InitializeProgress()
    Progress->>Engine: ProgressUpdates
    Engine->>Client: ResearchResults
```

Core Components:
- ResearchConfig interface:
  - query: Research topic initialization
  - breadth: Parallel path configuration
  - depth: Path depth control
  - onProgress: Progress monitoring
- ResearchProgress tracking:
  - Real-time depth/breadth monitoring
  - Query completion status
  - Progress event handling

### 2. Research Path Implementation (ResearchPath)

Research execution flow:

```mermaid
graph TD
    A[Initialize Path] --> B[Query Distribution]
    B --> C[Query Generation]
    C --> D[Search Execution]
    D --> E[Result Processing]
    E --> F[Learning Extraction]
    F --> G[Follow-up Generation]
    G --> H[Depth Control]
```

Core Processing Steps:
1. Query Generation and Management
   - Intelligent query generation with LLM
   - Dynamic query reduction
   - Token optimization system
   - Context window management
   - Automatic query refinement

2. Search Execution System
   - Exponential backoff retry mechanism
   - Intelligent request throttling
   - API state management
   - Dynamic rate limiting
   - Error recovery protocols

3. Result Processing Pipeline
   - Content sanitization
   - Source validation
   - Learning synthesis
   - Token optimization
   - Cross-reference verification

### 3. LLM Integration Architecture (LLMClient)

Venice.ai integration system:

```mermaid
graph TD
    A[Request Handler] --> B[Token Management]
    B --> C[Rate Control]
    C --> D[Context Window]
    D --> E[Response Handler]
    E --> F[Error Recovery]
```

Key Features:
- Adaptive token management
- Model selection optimization
- Smart retry mechanisms
- State preservation
- Response validation

### 4. Search Provider Architecture (BraveSearchProvider)

Privacy-focused search implementation:

```mermaid
graph TD
    A[Search Request] --> B[Rate Limiter]
    B --> C[API Validator]
    C --> D[Request Handler]
    D --> E[Response Parser]
    E --> F[Content Filter]
    F --> G[Source Manager]
```

Implementation:
- Request rate optimization
- Error classification system
- Intelligent retry logic
- Content validation pipeline
- Source verification

### 5. Progress Tracking System (OutputManager)

Real-time monitoring system:

```mermaid
graph TD
    A[Progress Event] --> B[Progress Analyzer]
    B --> C[Console Handler]
    C --> D[Status Manager]
    D --> E[Display System]
```

Features:
- Real-time progress computation
- Dynamic visualization system
- State management
- Query tracking optimization

### 6. Resource Management

System resource optimization:

```mermaid
graph TD
    A[Resource Manager] --> B[Memory Handler]
    B --> C[API Manager]
    C --> D[Rate Controller]
    D --> E[Token Monitor]
```

Core Features:
- Memory optimization system
- Batch processing controller
- Buffer management system
- Resource allocation optimization

### 7. Error Handling Architecture

Robust error recovery system:

```mermaid
graph TD
    A[Error Handler] --> B[Error Classifier]
    B --> C[Retry Manager]
    C --> D[Backoff System]
    D --> E[Recovery Handler]
```

Implementation:
- Smart backoff system
- State preservation mechanism
- Error classification engine
- Recovery strategy optimization

## Performance Optimization

Performance architecture:

```mermaid
graph TD
    A[Performance Manager] --> B[Query Optimizer]
    B --> C[Result Handler]
    C --> D[Resource Controller]
    D --> E[Cache System]
```

Key Areas:
1. Query Optimization
   - Dynamic query refinement
   - Context-aware generation
   - Redundancy elimination
   - Pattern recognition

2. Result Processing
   - Parallel processing system
   - Incremental aggregation
   - Memory-efficient handling
   - Result validation

3. Resource Utilization
   - Dynamic rate management
   - Adaptive batch processing
   - Smart resource allocation
   - Cache optimization

## Technical Integration Points

Integration architecture:

```mermaid
graph TD
    A[API Integration] --> B[Rate Manager]
    B --> C[Token Handler]
    C --> D[Error System]
    D --> E[State Controller]
```

Implementation:
- Secure API management
- Rate control optimization
- Token usage monitoring
- State management system
- Recovery mechanisms
