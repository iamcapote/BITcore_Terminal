<!--
Why: Document ChatGPT-UI's multi-user web chat architecture so contributors understand how it enables persistent conversations with multiple users, languages, and database connections.
What: Visualizes the Nuxt.js frontend, Django backend, conversation management, and multi-database support.
How: Uses Mermaid diagrams to show the full-stack architecture for a ChatGPT clone with server-side persistence.
-->

# ChatGPT-UI System Architecture

## Overview

ChatGPT-UI is a full-stack ChatGPT web client that supports multiple users, multiple languages (i18n), and multiple database connections for persistent data storage. It consists of a Nuxt.js (Vue 3) frontend and a Django REST backend, providing a polished chat experience with conversation history and user management.

## Core Architecture

```mermaid
graph TB
    subgraph Frontend["FRONTEND (Nuxt.js)"]
        NuxtApp["Nuxt 3 App<br/>Vue 3 + TypeScript"]
        ChatInterface["Chat Interface<br/>Message UI"]
        ConversationList["Conversation List<br/>History Sidebar"]
        UserSettings["User Settings<br/>Preferences"]
    end

    subgraph Backend["BACKEND (Django)"]
        DjangoAPI["Django REST API<br/>Python"]
        ViewHandlers["View Handlers<br/>Request Logic"]
        Serializers["Serializers<br/>Data Formatting"]
        Middleware["Middleware Stack<br/>Auth + CORS"]
    end

    subgraph ChatEngine["CHAT ENGINE"]
        MessageProcessor["Message Processor<br/>Format + Parse"]
        ConversationManager["Conversation Manager<br/>Thread Control"]
        PromptBuilder["Prompt Builder<br/>Context Assembly"]
        ResponseStreamer["Response Streamer<br/>SSE/WebSocket"]
    end

    subgraph OpenAIIntegration["OPENAI INTEGRATION"]
        OpenAIClient["OpenAI Client<br/>Python SDK"]
        ModelRouter["Model Router<br/>GPT Selection"]
        TokenCounter["Token Counter<br/>Usage Tracking"]
        StreamHandler["Stream Handler<br/>Async Response"]
    end

    subgraph DatabaseLayer["DATABASE LAYER"]
        DatabaseRouter["Database Router<br/>Multi-DB Support"]
        PostgreSQL["PostgreSQL<br/>Production"]
        MySQL["MySQL<br/>Alternative"]
        SQLite["SQLite<br/>Development"]
    end

    subgraph DataModels["DATA MODELS"]
        UserModel["User Model<br/>Authentication"]
        ConversationModel["Conversation Model<br/>Thread Storage"]
        MessageModel["Message Model<br/>Chat History"]
        SettingsModel["Settings Model<br/>User Preferences"]
    end

    subgraph Authentication["AUTHENTICATION"]
        AuthSystem["Auth System<br/>JWT + Sessions"]
        UserManager["User Manager<br/>Registration"]
        PermissionCheck["Permission Check<br/>Access Control"]
    end

    subgraph I18N["INTERNATIONALIZATION"]
        LanguageRouter["Language Router<br/>Locale Detection"]
        TranslationStore["Translation Store<br/>Message Catalogs"]
        SupportedLangs["Supported Languages<br/>Multi-language"]
    end

    NuxtApp --> ChatInterface
    ChatInterface --> ConversationList
    ConversationList --> UserSettings
    
    Frontend --> Backend
    DjangoAPI --> ViewHandlers
    ViewHandlers --> Serializers
    Serializers --> Middleware
    
    Backend --> ChatEngine
    MessageProcessor --> ConversationManager
    ConversationManager --> PromptBuilder
    PromptBuilder --> ResponseStreamer
    
    ChatEngine --> OpenAIIntegration
    OpenAIClient --> ModelRouter
    ModelRouter --> TokenCounter
    TokenCounter --> StreamHandler
    
    Backend --> DatabaseLayer
    DatabaseRouter --> PostgreSQL
    DatabaseRouter --> MySQL
    DatabaseRouter --> SQLite
    
    DatabaseLayer --> DataModels
    UserModel --> ConversationModel
    ConversationModel --> MessageModel
    MessageModel --> SettingsModel
    
    Backend --> Authentication
    AuthSystem --> UserManager
    UserManager --> PermissionCheck
    
    Backend --> I18N
    LanguageRouter --> TranslationStore
    TranslationStore --> SupportedLangs

    style Frontend fill:#1976d2,color:#ffffff
    style Backend fill:#f9a825,color:#000000
    style ChatEngine fill:#388e3c,color:#ffffff
    style OpenAIIntegration fill:#512da8,color:#ffffff
    style DatabaseLayer fill:#e64a19,color:#ffffff
    style DataModels fill:#00796b,color:#ffffff
    style Authentication fill:#7b1fa2,color:#ffffff
    style I18N fill:#d32f2f,color:#ffffff
```

## Chat Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant Nuxt as Nuxt Frontend
    participant Django as Django Backend
    participant ChatEngine as Chat Engine
    participant OpenAI as OpenAI API
    participant DB as Database

    User->>Nuxt: Type Message
    Nuxt->>Django: POST /api/chat
    Django->>ChatEngine: Process Message
    
    ChatEngine->>DB: Load Conversation History
    DB-->>ChatEngine: Previous Messages
    
    ChatEngine->>ChatEngine: Build Prompt<br/>with Context
    ChatEngine->>OpenAI: Stream Chat Completion
    
    loop Stream Response
        OpenAI-->>ChatEngine: Token
        ChatEngine-->>Django: Forward Token
        Django-->>Nuxt: SSE Stream
        Nuxt-->>User: Display Token
    end
    
    OpenAI-->>ChatEngine: Stream Complete
    ChatEngine->>DB: Save Message + Response
    DB-->>ChatEngine: Confirmation
    
    ChatEngine->>Django: Response Complete
    Django->>Nuxt: Final Status
    Nuxt->>User: Message Delivered
```

## Conversation Management

```mermaid
graph TB
    subgraph ConversationOps["CONVERSATION OPERATIONS"]
        CreateConversation["Create Conversation<br/>New Thread"]
        ListConversations["List Conversations<br/>User History"]
        LoadConversation["Load Conversation<br/>Restore Context"]
        DeleteConversation["Delete Conversation<br/>Archive"]
    end

    subgraph MessageOps["MESSAGE OPERATIONS"]
        SendMessage["Send Message<br/>User Input"]
        StreamResponse["Stream Response<br/>AI Output"]
        EditMessage["Edit Message<br/>Modify History"]
        RegenerateResponse["Regenerate Response<br/>Retry"]
    end

    subgraph ContextManagement["CONTEXT MANAGEMENT"]
        HistoryWindow["History Window<br/>Token Limit"]
        ContextTrimmer["Context Trimmer<br/>Sliding Window"]
        SystemPrompt["System Prompt<br/>Behavior Config"]
    end

    subgraph PersistenceLayer["PERSISTENCE LAYER"]
        MessageStore["Message Store<br/>Full History"]
        ConversationCache["Conversation Cache<br/>Active Sessions"]
        SearchIndex["Search Index<br/>Message Search"]
    end

    CreateConversation --> ListConversations
    ListConversations --> LoadConversation
    LoadConversation --> DeleteConversation
    
    ConversationOps --> MessageOps
    SendMessage --> StreamResponse
    StreamResponse --> EditMessage
    EditMessage --> RegenerateResponse
    
    MessageOps --> ContextManagement
    HistoryWindow --> ContextTrimmer
    ContextTrimmer --> SystemPrompt
    
    ContextManagement --> PersistenceLayer
    MessageStore --> ConversationCache
    ConversationCache --> SearchIndex

    style ConversationOps fill:#1976d2,color:#ffffff
    style MessageOps fill:#f9a825,color:#000000
    style ContextManagement fill:#388e3c,color:#ffffff
    style PersistenceLayer fill:#512da8,color:#ffffff
```

## Multi-Database Architecture

```mermaid
graph TB
    subgraph DatabaseConfig["DATABASE CONFIGURATION"]
        DBSettings["Database Settings<br/>Environment Config"]
        ConnectionPool["Connection Pool<br/>Reuse Connections"]
        MigrationManager["Migration Manager<br/>Schema Updates"]
    end

    subgraph SupportedDatabases["SUPPORTED DATABASES"]
        PostgreSQL["PostgreSQL<br/>Recommended"]
        MySQL["MySQL/MariaDB<br/>Alternative"]
        SQLite["SQLite<br/>Development/Testing"]
    end

    subgraph ORMLayer["ORM LAYER (Django)"]
        ModelDefinitions["Model Definitions<br/>Schema"]
        QueryBuilder["Query Builder<br/>ORM Queries"]
        TransactionManager["Transaction Manager<br/>ACID"]
    end

    subgraph DataAccess["DATA ACCESS PATTERNS"]
        BulkOperations["Bulk Operations<br/>Batch Insert/Update"]
        CachedQueries["Cached Queries<br/>Performance"]
        LazyLoading["Lazy Loading<br/>On-demand Fetch"]
    end

    DBSettings --> ConnectionPool
    ConnectionPool --> MigrationManager
    
    DatabaseConfig --> SupportedDatabases
    PostgreSQL --> SupportedDatabases
    MySQL --> SupportedDatabases
    SQLite --> SupportedDatabases
    
    SupportedDatabases --> ORMLayer
    ModelDefinitions --> QueryBuilder
    QueryBuilder --> TransactionManager
    
    ORMLayer --> DataAccess
    BulkOperations --> CachedQueries
    CachedQueries --> LazyLoading

    style DatabaseConfig fill:#1976d2,color:#ffffff
    style SupportedDatabases fill:#f9a825,color:#000000
    style ORMLayer fill:#388e3c,color:#ffffff
    style DataAccess fill:#512da8,color:#ffffff
```

## User Authentication System

```mermaid
graph TB
    subgraph UserManagement["USER MANAGEMENT"]
        Registration["Registration<br/>Sign Up"]
        Login["Login<br/>Credentials"]
        Logout["Logout<br/>Session End"]
        PasswordReset["Password Reset<br/>Recovery"]
    end

    subgraph AuthMechanism["AUTH MECHANISM"]
        JWTTokens["JWT Tokens<br/>Stateless Auth"]
        SessionStore["Session Store<br/>Server-side"]
        TokenRefresh["Token Refresh<br/>Auto Renewal"]
    end

    subgraph PermissionSystem["PERMISSION SYSTEM"]
        UserRoles["User Roles<br/>Admin/Regular"]
        AccessControl["Access Control<br/>Resource Permissions"]
        RateLimiting["Rate Limiting<br/>Abuse Prevention"]
    end

    Registration --> Login
    Login --> Logout
    Logout --> PasswordReset
    
    UserManagement --> AuthMechanism
    JWTTokens --> SessionStore
    SessionStore --> TokenRefresh
    
    AuthMechanism --> PermissionSystem
    UserRoles --> AccessControl
    AccessControl --> RateLimiting

    style UserManagement fill:#1976d2,color:#ffffff
    style AuthMechanism fill:#f9a825,color:#000000
    style PermissionSystem fill:#388e3c,color:#ffffff
```

## Internationalization (i18n)

```mermaid
graph TB
    subgraph LanguageSupport["LANGUAGE SUPPORT"]
        LanguageDetector["Language Detector<br/>Browser/User Pref"]
        LocaleManager["Locale Manager<br/>Current Language"]
        FallbackLogic["Fallback Logic<br/>Default Language"]
    end

    subgraph TranslationSystem["TRANSLATION SYSTEM"]
        MessageCatalogs["Message Catalogs<br/>Language Files"]
        TranslationLoader["Translation Loader<br/>Lazy Loading"]
        PluralizationRules["Pluralization Rules<br/>Grammar"]
    end

    subgraph SupportedLanguages["SUPPORTED LANGUAGES"]
        English["English (en)"]
        Chinese["Chinese (zh)"]
        Japanese["Japanese (ja)"]
        Spanish["Spanish (es)"]
        OtherLangs["Other Languages"]
    end

    LanguageDetector --> LocaleManager
    LocaleManager --> FallbackLogic
    
    LanguageSupport --> TranslationSystem
    MessageCatalogs --> TranslationLoader
    TranslationLoader --> PluralizationRules
    
    TranslationSystem --> SupportedLanguages
    English --> SupportedLanguages
    Chinese --> SupportedLanguages
    Japanese --> SupportedLanguages
    Spanish --> SupportedLanguages
    OtherLangs --> SupportedLanguages

    style LanguageSupport fill:#1976d2,color:#ffffff
    style TranslationSystem fill:#f9a825,color:#000000
    style SupportedLanguages fill:#388e3c,color:#ffffff
```

## Key Design Principles

### 1. Full-Stack Persistence
- Server-side conversation storage
- Database-backed message history
- Multi-database support for flexibility

### 2. Multi-User Support
- User authentication and authorization
- Isolated conversation spaces per user
- Shared database with proper access control

### 3. Internationalization
- Multi-language UI support
- Browser-based language detection
- Easy translation management

### 4. Real-time Streaming
- Server-Sent Events (SSE) for response streaming
- Token-by-token display
- Smooth user experience

### 5. Production-Ready
- Database migration support
- Docker deployment
- Environment-based configuration

## Technology Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript, TailwindCSS
- **Backend**: Django 4.x, Django REST Framework
- **Database**: PostgreSQL (primary), MySQL, SQLite
- **AI**: OpenAI Python SDK
- **Authentication**: JWT, Django Auth
- **I18n**: Nuxt I18n module
- **Deployment**: Docker, Nginx

## File Organization

```
chatgpt-ui/
├── pages/                 # Nuxt pages (routes)
├── components/            # Vue components
├── composables/           # Vue composables
├── server/                # Nuxt server API
│   └── middleware/        # Server middleware
├── lang/                  # Translation files
├── public/                # Static assets
├── layouts/               # Page layouts
└── nuxt.config.ts         # Nuxt configuration

chatgpt-ui-server/         # Separate Django repo
├── api/                   # Django app
│   ├── models.py          # Data models
│   ├── views.py           # API views
│   ├── serializers.py     # DRF serializers
│   └── urls.py            # URL routing
├── config/                # Django settings
└── manage.py              # Django CLI
```

## Deployment Options

- **Docker Compose**: Full-stack deployment
- **Behind Traefik**: Reverse proxy setup
- **Docker Swarm**: Orchestrated deployment
- **Manual**: Separate frontend + backend hosting

## Configuration

Key environment variables:
- `OPENAI_API_KEY`: OpenAI API credentials
- `DATABASE_URL`: Database connection string
- `SECRET_KEY`: Django secret key
- `CORS_ALLOWED_ORIGINS`: Frontend URL
- `DEFAULT_LANGUAGE`: i18n default

---

This architecture provides a complete, production-ready ChatGPT clone with server-side persistence, multi-user support, and internationalization, making it suitable for deployment in multi-tenant scenarios with full conversation history management.
