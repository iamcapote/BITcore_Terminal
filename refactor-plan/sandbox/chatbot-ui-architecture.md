<!--
Why: Document Chatbot UI's Next.js architecture so contributors understand how it integrates Supabase, manages multi-provider LLMs, implements RAG, and orchestrates chat workflows.
What: Visualizes the frontend components, backend API routes, database schema, and LLM provider integrations that power Chatbot UI's feature-rich chat experience.
How: Uses Mermaid diagrams to show component boundaries, data flows, and the patterns that enable multi-model conversations with document retrieval.
-->

# Chatbot UI System Architecture

## Overview

Chatbot UI is an open-source, feature-rich AI chat application built with Next.js 14, supporting multiple LLM providers (OpenAI, Anthropic, Google, Mistral, Azure, Groq) with built-in RAG, model builder, and Supabase persistence.

## Core Architecture

```mermaid
graph TB
    subgraph Client["CLIENT LAYER"]
        NextUI["Next.js 14 App<br/>React + TypeScript"]
        Components["UI Components<br/>Radix UI + Tailwind"]
        StateContext["Context API<br/>Global State"]
        I18N["i18n<br/>Multi-language"]
    end

    subgraph AppRouter["APP ROUTER"]
        LoginPage["[locale]/login<br/>Authentication"]
        ChatPage["[locale]/[workspaceid]/chat<br/>Main Chat UI"]
        SetupPage["[locale]/setup<br/>Onboarding"]
        APIRoutes["api/*<br/>Server Actions"]
    end

    subgraph ServerActions["SERVER ACTIONS"]
        ChatActions["Chat Actions<br/>Message CRUD"]
        FileActions["File Actions<br/>Upload/Process"]
        AssistantActions["Assistant Actions<br/>Model Builder"]
        RAGActions["RAG Actions<br/>Retrieval"]
    end

    subgraph LLMProviders["LLM PROVIDER LAYER"]
        OpenAI["OpenAI<br/>GPT Models"]
        Anthropic["Anthropic<br/>Claude"]
        Google["Google<br/>Gemini"]
        Mistral["Mistral AI"]
        AzureOpenAI["Azure OpenAI"]
        Groq["Groq<br/>Fast Inference"]
        LocalLLM["Local Models<br/>Ollama Compatible"]
        
        ProviderRouter["Provider Router<br/>Unified Interface"]
    end

    subgraph RAGSystem["RAG SYSTEM"]
        LocalEmbedding["Local Embeddings<br/>Transformers.js"]
        OpenAIEmbedding["OpenAI Embeddings<br/>text-embedding-3"]
        VectorSearch["Vector Search<br/>Supabase pgvector"]
        DocumentProcessor["Document Processor<br/>PDF, TXT, MD, CSV"]
        Chunker["Text Chunker<br/>Semantic Split"]
    end

    subgraph Database["SUPABASE DATABASE"]
        Profiles["Profiles<br/>User Settings"]
        Workspaces["Workspaces<br/>Multi-tenant"]
        Chats["Chats<br/>Conversations"]
        Messages["Messages<br/>Chat History"]
        Files["Files<br/>Documents"]
        Collections["Collections<br/>Knowledge Base"]
        Assistants["Assistants<br/>Custom Agents"]
        Tools["Tools<br/>Functions"]
        Prompts["Prompts<br/>Templates"]
        Presets["Presets<br/>Chat Config"]
    end

    subgraph Storage["SUPABASE STORAGE"]
        MessageFiles["Message Attachments<br/>Images, Docs"]
        ProfileImages["Profile Images<br/>Avatars"]
        AssistantFiles["Assistant Files<br/>Knowledge"]
    end

    subgraph Auth["AUTHENTICATION"]
        SupabaseAuth["Supabase Auth<br/>JWT + Session"]
        RLS["Row Level Security<br/>Postgres RLS"]
        OAuth["OAuth Providers<br/>Google, GitHub"]
    end

    NextUI --> Components
    Components --> StateContext
    StateContext --> I18N
    
    NextUI --> AppRouter
    
    LoginPage --> Auth
    ChatPage --> ServerActions
    SetupPage --> Auth
    APIRoutes --> ServerActions
    
    ChatActions --> LLMProviders
    RAGActions --> RAGSystem
    FileActions --> Storage
    AssistantActions --> Database
    
    ProviderRouter --> OpenAI
    ProviderRouter --> Anthropic
    ProviderRouter --> Google
    ProviderRouter --> Mistral
    ProviderRouter --> AzureOpenAI
    ProviderRouter --> Groq
    ProviderRouter --> LocalLLM
    
    DocumentProcessor --> Chunker
    Chunker --> LocalEmbedding
    Chunker --> OpenAIEmbedding
    LocalEmbedding --> VectorSearch
    OpenAIEmbedding --> VectorSearch
    VectorSearch --> Collections
    
    ServerActions --> Database
    ServerActions --> Storage
    ServerActions --> Auth
    
    Auth --> SupabaseAuth
    SupabaseAuth --> RLS
    RLS --> Database

    style Client fill:#1976d2,color:#ffffff
    style AppRouter fill:#7b1fa2,color:#ffffff
    style ServerActions fill:#f9a825,color:#000000
    style LLMProviders fill:#512da8,color:#ffffff
    style RAGSystem fill:#e64a19,color:#ffffff
    style Database fill:#689f38,color:#ffffff
    style Storage fill:#00796b,color:#ffffff
    style Auth fill:#d32f2f,color:#ffffff
```

## Chat Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant ChatUI as Chat Component
    participant ServerAction as Server Action
    participant Provider as LLM Provider
    participant RAG as RAG Engine
    participant DB as Supabase DB
    participant Storage as Supabase Storage

    User->>ChatUI: Type Message + Attach File
    ChatUI->>Storage: Upload File
    Storage-->>ChatUI: File URL
    
    ChatUI->>ServerAction: createChatMessage(content, fileIds)
    ServerAction->>DB: Insert Message
    DB-->>ServerAction: Message Created
    
    alt RAG Enabled
        ServerAction->>RAG: Retrieve Relevant Docs
        RAG->>DB: Vector Search
        DB-->>RAG: Similar Chunks
        RAG-->>ServerAction: Context Documents
    end
    
    ServerAction->>Provider: Stream Completion<br/>(with context)
    Provider-->>ServerAction: Token Stream
    
    loop Each Token
        ServerAction->>ChatUI: SSE Stream Token
        ChatUI->>User: Display Token
    end
    
    ServerAction->>DB: Insert Assistant Message
    DB-->>ServerAction: Saved
    
    ServerAction->>ChatUI: Stream Complete
    ChatUI->>User: Final Message
```

## RAG Document Processing

```mermaid
graph TB
    subgraph Upload["DOCUMENT UPLOAD"]
        FileSelect["File Selection<br/>Browser Input"]
        FileValidate["File Validation<br/>Type + Size Check"]
        StorageUpload["Storage Upload<br/>Supabase Storage"]
    end

    subgraph Processing["DOCUMENT PROCESSING"]
        TypeDetect["Type Detection<br/>PDF, TXT, MD, CSV"]
        TextExtract["Text Extraction<br/>Parser Layer"]
        TextClean["Text Cleaning<br/>Normalize"]
    end

    subgraph Chunking["CHUNKING"]
        SemanticSplit["Semantic Splitter<br/>Sentence Boundaries"]
        OverlapStrategy["Overlap Strategy<br/>Context Preservation"]
        ChunkMetadata["Chunk Metadata<br/>Position + Source"]
    end

    subgraph Embedding["EMBEDDING"]
        EmbedChoice["Embedding Choice<br/>Local vs OpenAI"]
        LocalEmbed["Transformers.js<br/>Browser-based"]
        OpenAIEmbed["OpenAI API<br/>text-embedding-3"]
        VectorGen["Vector Generation<br/>Float32 Arrays"]
    end

    subgraph Storage["VECTOR STORAGE"]
        PGVector["pgvector Extension<br/>Postgres"]
        CollectionLink["Collection Link<br/>File to Collection"]
        IndexBuild["Index Build<br/>HNSW/IVFFlat"]
    end

    subgraph Retrieval["RETRIEVAL"]
        QueryEmbed["Query Embedding<br/>Same Model"]
        SimilaritySearch["Similarity Search<br/>Cosine Distance"]
        RankResults["Rank Results<br/>Top-K Selection"]
        ContextBuild["Context Building<br/>Format for LLM"]
    end

    FileSelect --> FileValidate
    FileValidate --> StorageUpload
    
    StorageUpload --> TypeDetect
    TypeDetect --> TextExtract
    TextExtract --> TextClean
    
    TextClean --> SemanticSplit
    SemanticSplit --> OverlapStrategy
    OverlapStrategy --> ChunkMetadata
    
    ChunkMetadata --> EmbedChoice
    EmbedChoice --> LocalEmbed
    EmbedChoice --> OpenAIEmbed
    LocalEmbed --> VectorGen
    OpenAIEmbed --> VectorGen
    
    VectorGen --> PGVector
    PGVector --> CollectionLink
    CollectionLink --> IndexBuild
    
    QueryEmbed --> SimilaritySearch
    IndexBuild --> SimilaritySearch
    SimilaritySearch --> RankResults
    RankResults --> ContextBuild

    style Upload fill:#1976d2,color:#ffffff
    style Processing fill:#f9a825,color:#000000
    style Chunking fill:#388e3c,color:#ffffff
    style Embedding fill:#512da8,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
    style Retrieval fill:#e64a19,color:#ffffff
```

## Multi-Provider LLM Integration

```mermaid
graph TB
    subgraph APILayer["API ABSTRACTION LAYER"]
        UnifiedInterface["Unified Chat Interface<br/>buildFinalMessages()"]
        StreamHandler["Stream Handler<br/>SSE + ReadableStream"]
        ErrorHandler["Error Handler<br/>Retry + Fallback"]
    end

    subgraph ProviderSDKs["PROVIDER SDKs"]
        OpenAISDK["OpenAI SDK<br/>@openai/api"]
        AnthropicSDK["Anthropic SDK<br/>@anthropic-ai/sdk"]
        GoogleSDK["Google SDK<br/>@google/generative-ai"]
        MistralSDK["Mistral SDK<br/>@mistralai/mistralai"]
        AzureSDK["Azure SDK<br/>@azure/openai"]
        GroqSDK["Groq SDK<br/>groq-sdk"]
    end

    subgraph ModelCapabilities["MODEL CAPABILITIES"]
        Vision["Vision<br/>Image Understanding"]
        FunctionCalling["Function Calling<br/>Tool Use"]
        Streaming["Streaming<br/>Token-by-Token"]
        LongContext["Long Context<br/>128K+ tokens"]
    end

    subgraph MessageTransform["MESSAGE TRANSFORMATION"]
        Formatter["Format Converter<br/>Provider-specific"]
        SystemPrompt["System Prompt<br/>Injection"]
        ToolDefinitions["Tool Definitions<br/>JSON Schema"]
        ImageHandler["Image Handler<br/>Base64/URL"]
    end

    subgraph RateLimiting["RATE LIMITING"]
        TokenCounter["Token Counter<br/>tiktoken"]
        RateLimiter["Rate Limiter<br/>Per Model"]
        CostTracking["Cost Tracking<br/>Usage Metrics"]
    end

    UnifiedInterface --> StreamHandler
    StreamHandler --> ErrorHandler
    
    UnifiedInterface --> MessageTransform
    MessageTransform --> ProviderSDKs
    
    Formatter --> OpenAISDK
    Formatter --> AnthropicSDK
    Formatter --> GoogleSDK
    Formatter --> MistralSDK
    Formatter --> AzureSDK
    Formatter --> GroqSDK
    
    OpenAISDK --> ModelCapabilities
    AnthropicSDK --> ModelCapabilities
    GoogleSDK --> ModelCapabilities
    
    UnifiedInterface --> RateLimiting
    TokenCounter --> RateLimiter
    RateLimiter --> CostTracking

    style APILayer fill:#f9a825,color:#000000
    style ProviderSDKs fill:#512da8,color:#ffffff
    style ModelCapabilities fill:#388e3c,color:#ffffff
    style MessageTransform fill:#0288d1,color:#ffffff
    style RateLimiting fill:#e64a19,color:#ffffff
```

## Database Schema

```mermaid
erDiagram
    PROFILES ||--o{ WORKSPACES : owns
    PROFILES {
        uuid id PK
        text username
        text email
        jsonb api_keys
        text display_name
        text image_path
        timestamp created_at
    }

    WORKSPACES ||--o{ CHATS : contains
    WORKSPACES ||--o{ FOLDERS : contains
    WORKSPACES ||--o{ COLLECTIONS : contains
    WORKSPACES {
        uuid id PK
        uuid user_id FK
        text name
        text default_model
        jsonb chat_settings
        boolean is_home
        timestamp created_at
    }

    CHATS ||--o{ MESSAGES : contains
    CHATS ||--o{ CHAT_FILES : links
    CHATS {
        uuid id PK
        uuid workspace_id FK
        uuid folder_id FK
        uuid assistant_id FK
        text name
        text model
        jsonb context_length
        timestamp created_at
    }

    MESSAGES ||--o{ MESSAGE_FILE_ITEMS : contains
    MESSAGES {
        uuid id PK
        uuid chat_id FK
        text role
        text content
        text model
        jsonb tool_calls
        bigint sequence_number
        timestamp created_at
    }

    FILES ||--o{ CHAT_FILES : linked_to
    FILES ||--o{ COLLECTION_FILES : linked_to
    FILES ||--o{ MESSAGE_FILE_ITEMS : referenced_in
    FILES {
        uuid id PK
        uuid user_id FK
        text name
        text file_path
        text type
        bigint size
        bigint tokens
        timestamp created_at
    }

    COLLECTIONS ||--o{ COLLECTION_FILES : contains
    COLLECTIONS {
        uuid id PK
        uuid workspace_id FK
        text name
        text description
        text embedding_model
        timestamp created_at
    }

    ASSISTANTS ||--o{ ASSISTANT_TOOLS : uses
    ASSISTANTS ||--o{ ASSISTANT_FILES : uses
    ASSISTANTS {
        uuid id PK
        uuid workspace_id FK
        text name
        text description
        text model
        text instructions
        double_precision temperature
        timestamp created_at
    }

    TOOLS {
        uuid id PK
        uuid workspace_id FK
        text name
        text description
        text url
        jsonb custom_headers
        jsonb schema
        timestamp created_at
    }

    PROMPTS {
        uuid id PK
        uuid workspace_id FK
        text name
        text content
        timestamp created_at
    }

    PRESETS {
        uuid id PK
        uuid workspace_id FK
        text name
        text model
        jsonb context_length
        double_precision temperature
        timestamp created_at
    }
```

## Authentication & Authorization

```mermaid
graph TB
    subgraph AuthFlow["AUTHENTICATION FLOW"]
        Login["Login Page<br/>/login"]
        SupabaseAuth["Supabase Auth<br/>JWT + Session"]
        SessionStore["Session Store<br/>Cookies"]
    end

    subgraph RLS["ROW LEVEL SECURITY"]
        ProfilePolicy["Profile Policy<br/>users.id = auth.uid()"]
        WorkspacePolicy["Workspace Policy<br/>user_id match"]
        ChatPolicy["Chat Policy<br/>via workspace"]
        FilePolicy["File Policy<br/>user_id match"]
    end

    subgraph Middleware["MIDDLEWARE"]
        AuthGuard["Auth Guard<br/>Protected Routes"]
        WorkspaceCheck["Workspace Check<br/>Access Control"]
        APIKeyValidation["API Key Validation<br/>LLM Providers"]
    end

    subgraph OAuth["OAUTH PROVIDERS"]
        GoogleOAuth["Google<br/>OAuth 2.0"]
        GitHubOAuth["GitHub<br/>OAuth 2.0"]
        EmailAuth["Email<br/>Magic Link"]
    end

    Login --> SupabaseAuth
    SupabaseAuth --> SessionStore
    
    SupabaseAuth --> OAuth
    GoogleOAuth --> SupabaseAuth
    GitHubOAuth --> SupabaseAuth
    EmailAuth --> SupabaseAuth
    
    SessionStore --> AuthGuard
    AuthGuard --> WorkspaceCheck
    WorkspaceCheck --> RLS
    
    RLS --> ProfilePolicy
    RLS --> WorkspacePolicy
    RLS --> ChatPolicy
    RLS --> FilePolicy
    
    WorkspaceCheck --> APIKeyValidation

    style AuthFlow fill:#1976d2,color:#ffffff
    style RLS fill:#d32f2f,color:#ffffff
    style Middleware fill:#f9a825,color:#000000
    style OAuth fill:#388e3c,color:#ffffff
```

## Model Builder (Assistants)

```mermaid
graph TB
    subgraph AssistantBuilder["ASSISTANT BUILDER"]
        NameDesc["Name + Description<br/>Identity"]
        ModelSelect["Model Selection<br/>Provider + Model"]
        Instructions["System Instructions<br/>Behavior Prompt"]
        FileAttach["File Attachment<br/>Knowledge Base"]
        ToolSelection["Tool Selection<br/>Function Calling"]
        Settings["Settings<br/>Temperature, Context"]
    end

    subgraph ToolSystem["TOOL SYSTEM"]
        CustomTools["Custom Tools<br/>OpenAPI Spec"]
        BuiltinTools["Built-in Tools<br/>Web Search, Code"]
        ToolSchema["Tool Schema<br/>JSON Schema Validation"]
        ToolExecutor["Tool Executor<br/>HTTP Requests"]
    end

    subgraph AssistantRuntime["ASSISTANT RUNTIME"]
        LoadAssistant["Load Assistant<br/>Configuration"]
        BuildContext["Build Context<br/>Files + Instructions"]
        InjectTools["Inject Tools<br/>Function Definitions"]
        StreamResponse["Stream Response<br/>Handle Tool Calls"]
        ExecuteTool["Execute Tool<br/>Call External API"]
    end

    subgraph Storage["ASSISTANT STORAGE"]
        AssistantDB["Assistant Table<br/>Configuration"]
        AssistantFiles["Assistant Files<br/>Junction Table"]
        AssistantTools["Assistant Tools<br/>Junction Table"]
    end

    NameDesc --> ModelSelect
    ModelSelect --> Instructions
    Instructions --> FileAttach
    FileAttach --> ToolSelection
    ToolSelection --> Settings
    
    ToolSelection --> ToolSystem
    CustomTools --> ToolSchema
    BuiltinTools --> ToolSchema
    ToolSchema --> ToolExecutor
    
    Settings --> Storage
    AssistantDB --> AssistantFiles
    AssistantDB --> AssistantTools
    
    LoadAssistant --> BuildContext
    BuildContext --> InjectTools
    InjectTools --> StreamResponse
    StreamResponse --> ExecuteTool
    ExecuteTool --> ToolExecutor

    style AssistantBuilder fill:#f9a825,color:#000000
    style ToolSystem fill:#388e3c,color:#ffffff
    style AssistantRuntime fill:#512da8,color:#ffffff
    style Storage fill:#689f38,color:#ffffff
```

## Frontend State Management

```mermaid
graph TB
    subgraph ContextProviders["CONTEXT PROVIDERS"]
        ChatContext["Chat Context<br/>Active Conversation"]
        WorkspaceContext["Workspace Context<br/>Current Workspace"]
        GlobalContext["Global Context<br/>User Preferences"]
        ModalContext["Modal Context<br/>UI State"]
    end

    subgraph UIComponents["UI COMPONENTS"]
        ChatInterface["Chat Interface<br/>Message List + Input"]
        Sidebar["Sidebar<br/>Chats + Files + Settings"]
        FileManager["File Manager<br/>Upload + Browse"]
        AssistantManager["Assistant Manager<br/>Create + Edit"]
        SettingsPanel["Settings Panel<br/>Preferences"]
    end

    subgraph Hooks["CUSTOM HOOKS"]
        useChatHandler["useChatHandler<br/>Send Message"]
        useSelectFileHandler["useSelectFileHandler<br/>File Selection"]
        useScroll["useScroll<br/>Auto-scroll"]
        usePromptAndCommand["usePromptAndCommand<br/>Slash Commands"]
    end

    subgraph LocalStorage["LOCAL STORAGE"]
        RecentChats["Recent Chats<br/>Quick Access"]
        DraftMessages["Draft Messages<br/>Unsent Text"]
        UIPreferences["UI Preferences<br/>Theme, Layout"]
    end

    ContextProviders --> UIComponents
    
    ChatContext --> ChatInterface
    WorkspaceContext --> Sidebar
    GlobalContext --> SettingsPanel
    ModalContext --> FileManager
    
    ChatInterface --> Hooks
    Sidebar --> Hooks
    FileManager --> Hooks
    
    useChatHandler --> ContextProviders
    useSelectFileHandler --> ContextProviders
    usePromptAndCommand --> ChatContext
    
    ContextProviders --> LocalStorage

    style ContextProviders fill:#1976d2,color:#ffffff
    style UIComponents fill:#f9a825,color:#000000
    style Hooks fill:#388e3c,color:#ffffff
    style LocalStorage fill:#7b1fa2,color:#ffffff
```

## Key Features Implementation

### 1. Multi-Model Conversations
- Chat with multiple models simultaneously
- Compare responses side-by-side
- Model-specific settings per conversation

### 2. RAG Integration
- Browser-based local embeddings (Transformers.js)
- OpenAI embeddings for server-side processing
- Supabase pgvector for similarity search
- Collection-based knowledge organization

### 3. Model Builder
- Custom assistants with instructions
- File attachment for knowledge
- Tool integration via OpenAPI specs
- Reusable across workspaces

### 4. Multi-Workspace Support
- Separate workspaces for different projects
- Workspace-level default models
- Shared files and collections
- Granular access control via RLS

### 5. Progressive Web App
- Offline capability on localhost
- Native app-like experience on mobile
- Service worker for caching
- Push notifications (optional)

## Technology Stack

- **Frontend**: Next.js 14 App Router, React 18, TypeScript
- **UI**: Radix UI, Tailwind CSS, shadcn/ui
- **Backend**: Next.js Server Actions, Supabase Edge Functions
- **Database**: PostgreSQL (Supabase) with pgvector
- **Auth**: Supabase Auth (JWT + OAuth)
- **Storage**: Supabase Storage (S3-compatible)
- **LLM Providers**: OpenAI, Anthropic, Google, Mistral, Azure, Groq
- **Embeddings**: Transformers.js (local), OpenAI (server)
- **Deployment**: Vercel, Docker, Self-hosted

## File Organization

```
chatbot-ui/
├── app/
│   ├── [locale]/
│   │   ├── login/              # Authentication
│   │   ├── setup/              # Onboarding
│   │   ├── [workspaceid]/
│   │   │   └── chat/           # Main chat UI
│   │   └── page.tsx            # Landing
│   └── api/                    # API routes (legacy)
├── components/
│   ├── chat/                   # Chat components
│   ├── sidebar/                # Sidebar components
│   ├── ui/                     # Base UI components
│   └── utility/                # Utility components
├── context/                    # React Context providers
├── db/                         # Supabase queries
├── lib/
│   ├── models/                 # LLM provider integrations
│   ├── retrieval/              # RAG implementation
│   └── server/                 # Server utilities
├── supabase/
│   ├── migrations/             # Database migrations
│   └── types.ts                # Generated types
└── types/                      # TypeScript types
```

---

This architecture enables Chatbot UI to provide a powerful, multi-tenant chat experience with advanced features like RAG, multi-model support, and custom assistants while maintaining data security and user privacy.
