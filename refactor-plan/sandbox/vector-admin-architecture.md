<!--
Why: Document VectorAdmin's universal vector database management architecture so contributors understand how it provides a unified interface for managing embeddings across multiple vector database providers.
What: Visualizes the multi-provider abstraction layer, document ingestion pipeline, organization management, and the suite of tools for vector data management.
How: Uses Mermaid diagrams to show how VectorAdmin enables visual management of vector data without API complexity.
-->

# VectorAdmin System Architecture

## Overview

VectorAdmin is a full-stack universal GUI and tool suite for managing vector databases at scale. It provides a unified interface for Pinecone, Chroma, Qdrant, Weaviate, and other vector databases, enabling visual management of embeddings, documents, namespaces, and organizations with multi-user support.

## Core Architecture

```mermaid
graph TB
    subgraph Frontend["FRONTEND (React)"]
        WebUI["Web Interface<br/>Vite + React"]
        OrgDashboard["Organization Dashboard<br/>Multi-tenant"]
        DocumentManager["Document Manager<br/>Visual Interface"]
        EmbeddingViewer["Embedding Viewer<br/>Vector Inspection"]
    end

    subgraph Backend["BACKEND (Node.js)"]
        ExpressAPI["Express API<br/>REST Endpoints"]
        RouteHandlers["Route Handlers<br/>Business Logic"]
        AuthMiddleware["Auth Middleware<br/>JWT + Sessions"]
    end

    subgraph VectorDBAbstraction["VECTOR DB ABSTRACTION"]
        UnifiedInterface["Unified Interface<br/>Provider Agnostic"]
        PineconeAdapter["Pinecone Adapter<br/>Cloud"]
        ChromaAdapter["Chroma Adapter<br/>Open Source"]
        QdrantAdapter["Qdrant Adapter<br/>High Performance"]
        WeaviateAdapter["Weaviate Adapter<br/>Semantic Search"]
    end

    subgraph DocumentProcessor["DOCUMENT PROCESSOR (Python)"]
        FlaskServer["Flask Server<br/>Processing API"]
        FileParser["File Parser<br/>Multiple Formats"]
        TextSplitter["Text Splitter<br/>Chunking"]
        EmbeddingEngine["Embedding Engine<br/>OpenAI, Cohere"]
    end

    subgraph OrganizationLayer["ORGANIZATION LAYER"]
        OrgManager["Organization Manager<br/>Multi-tenant"]
        UserRoles["User Roles<br/>Admin/Member"]
        ResourceQuotas["Resource Quotas<br/>Usage Limits"]
        BillingTracker["Billing Tracker<br/>Cost Management"]
    end

    subgraph DocumentManagement["DOCUMENT MANAGEMENT"]
        DocumentStore["Document Store<br/>Metadata"]
        ChunkViewer["Chunk Viewer<br/>Atomic Level"]
        VersionControl["Version Control<br/>Change Tracking"]
        DuplicateDetection["Duplicate Detection<br/>Deduplication"]
    end

    subgraph NamespaceTools["NAMESPACE TOOLS"]
        NamespaceManager["Namespace Manager<br/>Logical Grouping"]
        CopyUtility["Copy Utility<br/>Clone Embeddings"]
        MigrateUtility["Migrate Utility<br/>Cross-DB Transfer"]
        BulkOperations["Bulk Operations<br/>Batch Actions"]
    end

    subgraph BackgroundWorkers["BACKGROUND WORKERS (Inngest)"]
        EmbedWorker["Embedding Worker<br/>Async Processing"]
        MigrationWorker["Migration Worker<br/>Long-running Tasks"]
        RegressionTester["Regression Tester<br/>Quality Assurance"]
    end

    subgraph Storage["STORAGE LAYER"]
        PostgreSQL["PostgreSQL<br/>Metadata + Users"]
        S3Storage["S3 Storage<br/>Document Files"]
        Redis["Redis<br/>Cache + Sessions"]
    end

    WebUI --> OrgDashboard
    OrgDashboard --> DocumentManager
    DocumentManager --> EmbeddingViewer
    
    Frontend --> Backend
    ExpressAPI --> RouteHandlers
    RouteHandlers --> AuthMiddleware
    
    Backend --> VectorDBAbstraction
    UnifiedInterface --> PineconeAdapter
    UnifiedInterface --> ChromaAdapter
    UnifiedInterface --> QdrantAdapter
    UnifiedInterface --> WeaviateAdapter
    
    Backend --> DocumentProcessor
    FlaskServer --> FileParser
    FileParser --> TextSplitter
    TextSplitter --> EmbeddingEngine
    
    Backend --> OrganizationLayer
    OrgManager --> UserRoles
    UserRoles --> ResourceQuotas
    ResourceQuotas --> BillingTracker
    
    Backend --> DocumentManagement
    DocumentStore --> ChunkViewer
    ChunkViewer --> VersionControl
    VersionControl --> DuplicateDetection
    
    Backend --> NamespaceTools
    NamespaceManager --> CopyUtility
    CopyUtility --> MigrateUtility
    MigrateUtility --> BulkOperations
    
    Backend --> BackgroundWorkers
    EmbedWorker --> MigrationWorker
    MigrationWorker --> RegressionTester
    
    Backend --> Storage
    PostgreSQL --> S3Storage
    S3Storage --> Redis

    style Frontend fill:#1976d2,color:#ffffff
    style Backend fill:#f9a825,color:#000000
    style VectorDBAbstraction fill:#388e3c,color:#ffffff
    style DocumentProcessor fill:#512da8,color:#ffffff
    style OrganizationLayer fill:#e64a19,color:#ffffff
    style DocumentManagement fill:#00796b,color:#ffffff
    style NamespaceTools fill:#7b1fa2,color:#ffffff
    style BackgroundWorkers fill:#d32f2f,color:#ffffff
    style Storage fill:#455a64,color:#ffffff
```

## Document Upload & Embedding Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Web UI
    participant API as Backend API
    participant Processor as Document Processor
    participant Embedder as Embedding Engine
    participant VectorDB as Vector Database
    participant Worker as Background Worker
    participant Storage as File Storage

    User->>UI: Upload Document
    UI->>API: POST /documents
    API->>Storage: Save File
    Storage-->>API: File URL
    
    API->>Worker: Queue Processing Job
    Worker->>Processor: Process Document
    
    Processor->>Processor: Parse File<br/>(PDF, DOCX, TXT)
    Processor->>Processor: Split into Chunks
    
    Processor->>Embedder: Generate Embeddings<br/>(Batch)
    Embedder-->>Processor: Vector Embeddings
    
    Processor->>VectorDB: Store Embeddings<br/>with Metadata
    VectorDB-->>Processor: Confirmation
    
    Processor->>API: Update Status
    API->>UI: Document Ready
    UI->>User: Show Document + Chunks
```

## Namespace Copy & Migration Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Web UI
    participant API as Backend API
    participant SourceDB as Source Vector DB
    participant Worker as Migration Worker
    participant TargetDB as Target Vector DB
    participant Monitor as Progress Monitor

    User->>UI: Initiate Copy/Migration
    UI->>API: POST /namespace/copy
    API->>Worker: Queue Migration Job
    
    Worker->>SourceDB: Fetch Vectors<br/>(Paginated)
    SourceDB-->>Worker: Vector Batch
    
    loop For Each Batch
        Worker->>TargetDB: Insert Vectors
        TargetDB-->>Worker: Confirmation
        Worker->>Monitor: Update Progress
        Monitor->>UI: Stream Progress
    end
    
    Worker->>API: Migration Complete
    API->>UI: Success Notification
    UI->>User: Migration Summary
```

## Vector Database Abstraction Layer

```mermaid
graph TB
    subgraph UnifiedAPI["UNIFIED API"]
        VectorOperations["Vector Operations<br/>CRUD Interface"]
        QueryInterface["Query Interface<br/>Similarity Search"]
        MetadataOps["Metadata Operations<br/>Filter + Update"]
        NamespaceOps["Namespace Operations<br/>Create/Delete"]
    end

    subgraph ProviderAdapters["PROVIDER ADAPTERS"]
        PineconeAdapter["Pinecone Adapter"]
        ChromaAdapter["Chroma Adapter"]
        QdrantAdapter["Qdrant Adapter"]
        WeaviateAdapter["Weaviate Adapter"]
        MilvusAdapter["Milvus Adapter"]
    end

    subgraph AdapterLogic["ADAPTER LOGIC"]
        ConnectionPool["Connection Pool<br/>Reuse Clients"]
        RateLimiter["Rate Limiter<br/>API Throttling"]
        ErrorMapper["Error Mapper<br/>Normalize Errors"]
        ResponseFormatter["Response Formatter<br/>Standardize Output"]
    end

    subgraph CapabilityMatrix["CAPABILITY MATRIX"]
        FeatureDetector["Feature Detector<br/>Provider Capabilities"]
        FallbackLogic["Fallback Logic<br/>Unsupported Features"]
        CompatLayer["Compatibility Layer<br/>API Differences"]
    end

    VectorOperations --> ProviderAdapters
    QueryInterface --> ProviderAdapters
    MetadataOps --> ProviderAdapters
    NamespaceOps --> ProviderAdapters
    
    PineconeAdapter --> AdapterLogic
    ChromaAdapter --> AdapterLogic
    QdrantAdapter --> AdapterLogic
    WeaviateAdapter --> AdapterLogic
    MilvusAdapter --> AdapterLogic
    
    ConnectionPool --> ErrorMapper
    RateLimiter --> ErrorMapper
    ErrorMapper --> ResponseFormatter
    
    AdapterLogic --> CapabilityMatrix
    FeatureDetector --> FallbackLogic
    FallbackLogic --> CompatLayer

    style UnifiedAPI fill:#1976d2,color:#ffffff
    style ProviderAdapters fill:#388e3c,color:#ffffff
    style AdapterLogic fill:#f9a825,color:#000000
    style CapabilityMatrix fill:#512da8,color:#ffffff
```

## Organization & User Management

```mermaid
graph TB
    subgraph OrganizationManagement["ORGANIZATION MANAGEMENT"]
        OrgRegistry["Organization Registry<br/>Multi-tenant"]
        OrgSettings["Organization Settings<br/>Config"]
        ResourceAllocation["Resource Allocation<br/>Quotas"]
    end

    subgraph UserManagement["USER MANAGEMENT"]
        UserAuth["User Authentication<br/>JWT + Sessions"]
        RoleManager["Role Manager<br/>Admin/Member"]
        InviteSystem["Invite System<br/>Email Invitations"]
    end

    subgraph PermissionSystem["PERMISSION SYSTEM"]
        AccessControl["Access Control<br/>Resource-level"]
        NamespaceACL["Namespace ACL<br/>Read/Write"]
        DocumentACL["Document ACL<br/>Sharing"]
    end

    subgraph BillingSystem["BILLING SYSTEM"]
        UsageTracker["Usage Tracker<br/>Embeddings Count"]
        CostCalculator["Cost Calculator<br/>Provider Costs"]
        BillingReports["Billing Reports<br/>Analytics"]
    end

    OrgRegistry --> OrgSettings
    OrgSettings --> ResourceAllocation
    
    UserAuth --> RoleManager
    RoleManager --> InviteSystem
    
    OrganizationManagement --> PermissionSystem
    AccessControl --> NamespaceACL
    NamespaceACL --> DocumentACL
    
    OrganizationManagement --> BillingSystem
    UsageTracker --> CostCalculator
    CostCalculator --> BillingReports

    style OrganizationManagement fill:#1976d2,color:#ffffff
    style UserManagement fill:#f9a825,color:#000000
    style PermissionSystem fill:#388e3c,color:#ffffff
    style BillingSystem fill:#e64a19,color:#ffffff
```

## Document & Chunk Management

```mermaid
graph TB
    subgraph DocumentLevel["DOCUMENT LEVEL"]
        DocumentList["Document List<br/>Organization View"]
        DocumentDetail["Document Detail<br/>Metadata"]
        DocumentUpload["Document Upload<br/>Multiple Formats"]
        DocumentDelete["Document Delete<br/>Cascade Cleanup"]
    end

    subgraph ChunkLevel["CHUNK LEVEL"]
        ChunkViewer["Chunk Viewer<br/>Atomic Inspection"]
        ChunkEditor["Chunk Editor<br/>Update Text"]
        ChunkDelete["Chunk Delete<br/>Remove Embedding"]
        ChunkMetadata["Chunk Metadata<br/>Custom Fields"]
    end

    subgraph EmbeddingLevel["EMBEDDING LEVEL"]
        VectorDisplay["Vector Display<br/>Raw Embeddings"]
        SimilarityTest["Similarity Test<br/>Compare Vectors"]
        MetadataFilter["Metadata Filter<br/>Search + Filter"]
    end

    subgraph BulkOperations["BULK OPERATIONS"]
        BatchUpdate["Batch Update<br/>Multiple Chunks"]
        BatchDelete["Batch Delete<br/>Namespace Clear"]
        BatchCopy["Batch Copy<br/>Clone Data"]
    end

    DocumentList --> DocumentDetail
    DocumentDetail --> DocumentUpload
    DocumentUpload --> DocumentDelete
    
    DocumentDetail --> ChunkLevel
    ChunkViewer --> ChunkEditor
    ChunkEditor --> ChunkDelete
    ChunkDelete --> ChunkMetadata
    
    ChunkLevel --> EmbeddingLevel
    VectorDisplay --> SimilarityTest
    SimilarityTest --> MetadataFilter
    
    ChunkLevel --> BulkOperations
    BatchUpdate --> BatchDelete
    BatchDelete --> BatchCopy

    style DocumentLevel fill:#1976d2,color:#ffffff
    style ChunkLevel fill:#f9a825,color:#000000
    style EmbeddingLevel fill:#388e3c,color:#ffffff
    style BulkOperations fill:#512da8,color:#ffffff
```

## Background Worker System (Inngest)

```mermaid
graph TB
    subgraph InngestCore["INNGEST CORE"]
        EventBus["Event Bus<br/>Job Queue"]
        WorkerRegistry["Worker Registry<br/>Function Handlers"]
        Scheduler["Scheduler<br/>Cron + Event-driven"]
    end

    subgraph WorkerFunctions["WORKER FUNCTIONS"]
        EmbedWorker["Embed Worker<br/>Document Processing"]
        MigrationWorker["Migration Worker<br/>DB Transfer"]
        RegressionWorker["Regression Worker<br/>Quality Tests"]
        CleanupWorker["Cleanup Worker<br/>Garbage Collection"]
    end

    subgraph JobManagement["JOB MANAGEMENT"]
        JobQueue["Job Queue<br/>Priority + Retry"]
        ProgressTracker["Progress Tracker<br/>Real-time Status"]
        FailureHandler["Failure Handler<br/>Error Recovery"]
    end

    subgraph Monitoring["MONITORING"]
        JobLogs["Job Logs<br/>Execution History"]
        PerformanceMetrics["Performance Metrics<br/>Duration + Success Rate"]
        AlertSystem["Alert System<br/>Failure Notifications"]
    end

    EventBus --> WorkerRegistry
    WorkerRegistry --> Scheduler
    
    Scheduler --> WorkerFunctions
    EmbedWorker --> WorkerFunctions
    MigrationWorker --> WorkerFunctions
    RegressionWorker --> WorkerFunctions
    CleanupWorker --> WorkerFunctions
    
    WorkerFunctions --> JobManagement
    JobQueue --> ProgressTracker
    ProgressTracker --> FailureHandler
    
    JobManagement --> Monitoring
    JobLogs --> PerformanceMetrics
    PerformanceMetrics --> AlertSystem

    style InngestCore fill:#1976d2,color:#ffffff
    style WorkerFunctions fill:#f9a825,color:#000000
    style JobManagement fill:#388e3c,color:#ffffff
    style Monitoring fill:#512da8,color:#ffffff
```

## Key Design Principles

### 1. Provider Agnostic
- Unified API abstracts provider differences
- Easy switching between vector databases
- Consistent experience across providers

### 2. Visual Management
- Atomic-level chunk inspection and editing
- No API calls required for common operations
- Clear visualization of vector data structure

### 3. Cost Optimization
- Copy embeddings without re-embedding
- Duplicate detection prevents waste
- Usage tracking for billing transparency

### 4. Multi-tenant Architecture
- Organization-level isolation
- Role-based access control
- Resource quotas per organization

### 5. Long-running Tasks
- Background workers for async operations
- Progress tracking for migrations
- Retry logic for resilience

## Technology Stack

- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Document Processing**: Python Flask
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: AWS S3 (or compatible)
- **Background Jobs**: Inngest
- **Vector Databases**: Pinecone, Chroma, Qdrant, Weaviate, Milvus
- **Embedding**: OpenAI, Cohere

## File Organization

```
vector-admin/
├── frontend/              # React web interface
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   └── utils/         # Utilities
├── backend/               # Node.js backend
│   ├── endpoints/         # API routes
│   ├── models/            # Database models
│   ├── utils/             # Core logic
│   └── index.js
├── document-processor/    # Python Flask
│   ├── processSingleDocument/
│   ├── scripts/
│   └── app.py
├── workers/               # Inngest workers
│   ├── functions/         # Worker functions
│   └── index.js
└── docker/                # Docker deployment
```

## Deployment Options

- **Docker**: docker-compose for full stack
- **Cloud**: AWS, GCP, Azure
- **Kubernetes**: Scalable cluster deployment

## Current Status

⚠️ **Note**: This project is no longer actively maintained by Mintplex Labs. The application remains functional but may not support breaking changes from vector database providers. The team's focus has shifted to AnythingLLM.

---

This architecture enabled VectorAdmin to provide a comprehensive, visual interface for managing vector databases at scale, abstracting away provider complexity and offering enterprise-grade multi-tenant management capabilities.
