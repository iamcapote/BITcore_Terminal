<!--
Why: Document the Ollama + Open WebUI deployment architecture on Fly.io so contributors understand how to run local LLMs with a web interface on GPU infrastructure.
What: Visualizes the containerized deployment, resource management, auto-scaling, and the integration between Ollama (LLM runtime) and Open WebUI (chat interface).
How: Uses Mermaid diagrams to show the Fly.io deployment pattern for running Ollama and Open WebUI together on the same GPU-equipped machine.
-->

# Ollama + Open WebUI on Fly.io Architecture

## Overview

This is a deployment template for running Ollama (local LLM runtime powered by llama.cpp) and Open WebUI (web chat interface) together on the same Fly.io Machine with GPU support. It enables private, self-hosted AI chat with models running on Nvidia L40s GPUs, featuring auto-scaling to zero for cost optimization.

## Core Architecture

```mermaid
graph TB
    subgraph FlyInfra["FLY.IO INFRASTRUCTURE"]
        FlyProxy["Fly Proxy<br/>Edge Routing"]
        FlyMachine["Fly Machine<br/>Nvidia L40s GPU"]
        FlyVolume["Fly Volume<br/>Model Storage"]
        FlyNetwork["Fly Network<br/>Private IPv6"]
    end

    subgraph Container["CONTAINER (Docker)"]
        StartScript["Start Script<br/>Initialization"]
        OllamaService["Ollama Service<br/>LLM Runtime"]
        OpenWebUI["Open WebUI<br/>Web Interface"]
        SharedStorage["Shared Storage<br/>/root/.ollama"]
    end

    subgraph OllamaCore["OLLAMA CORE"]
        ModelManager["Model Manager<br/>Pull/Load Models"]
        LlamaCPP["llama.cpp Engine<br/>Inference"]
        VRAM["VRAM Management<br/>Model Loading"]
        APIServer["API Server<br/>OpenAI-compatible"]
    end

    subgraph WebUICore["OPEN WEBUI CORE"]
        ChatInterface["Chat Interface<br/>User Experience"]
        ConversationManager["Conversation Manager<br/>History"]
        ModelSelector["Model Selector<br/>Switch Models"]
        UserAuth["User Authentication<br/>Multi-user"]
    end

    subgraph ScalingSystem["SCALING SYSTEM"]
        AutoScale["Auto-scale to Zero<br/>Cost Optimization"]
        WarmupHandler["Warmup Handler<br/>~15s Boot"]
        RequestRouter["Request Router<br/>Wake on Demand"]
    end

    FlyProxy --> FlyMachine
    FlyMachine --> FlyVolume
    FlyVolume --> FlyNetwork
    
    FlyMachine --> Container
    StartScript --> OllamaService
    StartScript --> OpenWebUI
    OllamaService --> SharedStorage
    OpenWebUI --> SharedStorage
    
    OllamaService --> OllamaCore
    ModelManager --> LlamaCPP
    LlamaCPP --> VRAM
    VRAM --> APIServer
    
    OpenWebUI --> WebUICore
    ChatInterface --> ConversationManager
    ConversationManager --> ModelSelector
    ModelSelector --> UserAuth
    
    FlyProxy --> ScalingSystem
    AutoScale --> WarmupHandler
    WarmupHandler --> RequestRouter

    style FlyInfra fill:#1976d2,color:#ffffff
    style Container fill:#f9a825,color:#000000
    style OllamaCore fill:#388e3c,color:#ffffff
    style WebUICore fill:#512da8,color:#ffffff
    style ScalingSystem fill:#e64a19,color:#ffffff
```

## Request Flow with Auto-scaling

```mermaid
sequenceDiagram
    participant User
    participant FlyProxy as Fly Proxy
    participant Machine as Fly Machine (Stopped)
    participant Container as Container
    participant Ollama as Ollama Service
    participant WebUI as Open WebUI
    participant GPU as GPU (L40s)

    User->>FlyProxy: HTTPS Request
    alt Machine Stopped
        FlyProxy->>Machine: Wake Machine
        Machine->>Machine: Boot (~3s)
        Machine->>Container: Start Container
        Container->>Ollama: Launch Ollama
        Container->>WebUI: Launch WebUI
        Note over WebUI: Ready in ~15s
    end
    
    FlyProxy->>WebUI: Forward Request
    WebUI-->>User: Serve UI
    
    User->>WebUI: Send Chat Message
    WebUI->>Ollama: POST /api/chat
    
    alt Model Not Loaded
        Ollama->>GPU: Load Model to VRAM
        Note over GPU: Varies by Model Size
    end
    
    Ollama->>GPU: Run Inference
    
    loop Stream Tokens
        GPU-->>Ollama: Token
        Ollama-->>WebUI: Stream Token
        WebUI-->>User: Display Token
    end
    
    Ollama-->>WebUI: Response Complete
    WebUI-->>User: Final Message
    
    Note over Machine: Auto-stop after idle timeout
```

## Container Startup Sequence

```mermaid
graph TB
    subgraph StartupScript["STARTUP SCRIPT (start.sh)"]
        Init["Initialize<br/>Environment"]
        LaunchOllama["Launch Ollama<br/>Background Process"]
        WaitOllama["Wait for Ollama<br/>Health Check"]
        LaunchWebUI["Launch Open WebUI<br/>Foreground"]
    end

    subgraph OllamaInit["OLLAMA INITIALIZATION"]
        BindPort["Bind Port 11434<br/>API Server"]
        LoadConfig["Load Config<br/>/root/.ollama"]
        CheckGPU["Check GPU<br/>CUDA/ROCm"]
    end

    subgraph WebUIInit["WEB UI INITIALIZATION"]
        BindPort8080["Bind Port 8080<br/>HTTP Server"]
        ConnectOllama["Connect to Ollama<br/>localhost:11434"]
        LoadSettings["Load Settings<br/>User Config"]
    end

    subgraph HealthChecks["HEALTH CHECKS"]
        OllamaHealth["Ollama Health<br/>/api/tags"]
        WebUIHealth["WebUI Health<br/>HTTP 200"]
        GPUStatus["GPU Status<br/>VRAM Available"]
    end

    Init --> LaunchOllama
    LaunchOllama --> WaitOllama
    WaitOllama --> LaunchWebUI
    
    LaunchOllama --> OllamaInit
    BindPort --> LoadConfig
    LoadConfig --> CheckGPU
    
    LaunchWebUI --> WebUIInit
    BindPort8080 --> ConnectOllama
    ConnectOllama --> LoadSettings
    
    StartupScript --> HealthChecks
    OllamaHealth --> WebUIHealth
    WebUIHealth --> GPUStatus

    style StartupScript fill:#1976d2,color:#ffffff
    style OllamaInit fill:#f9a825,color:#000000
    style WebUIInit fill:#388e3c,color:#ffffff
    style HealthChecks fill:#512da8,color:#ffffff
```

## Model Management

```mermaid
graph TB
    subgraph ModelDiscovery["MODEL DISCOVERY"]
        ModelLibrary["Model Library<br/>Ollama Registry"]
        CommunityModels["Community Models<br/>Hugging Face"]
        CustomModels["Custom Models<br/>GGUF Files"]
    end

    subgraph ModelOperations["MODEL OPERATIONS"]
        PullModel["Pull Model<br/>ollama pull"]
        LoadModel["Load Model<br/>Into VRAM"]
        UnloadModel["Unload Model<br/>Free VRAM"]
        DeleteModel["Delete Model<br/>Free Disk"]
    end

    subgraph StorageManagement["STORAGE MANAGEMENT"]
        FlyVolume["Fly Volume<br/>Persistent Disk"]
        ModelCache["Model Cache<br/>/root/.ollama/models"]
        DiskUsage["Disk Usage<br/>Monitor Space"]
    end

    subgraph VRAMManagement["VRAM MANAGEMENT"]
        GPUMemory["GPU Memory<br/>L40s (48GB)"]
        ModelSize["Model Size<br/>Fit Check"]
        QuantizationLevel["Quantization Level<br/>4-bit/8-bit"]
    end

    ModelLibrary --> ModelOperations
    CommunityModels --> ModelOperations
    CustomModels --> ModelOperations
    
    PullModel --> LoadModel
    LoadModel --> UnloadModel
    UnloadModel --> DeleteModel
    
    ModelOperations --> StorageManagement
    FlyVolume --> ModelCache
    ModelCache --> DiskUsage
    
    LoadModel --> VRAMManagement
    GPUMemory --> ModelSize
    ModelSize --> QuantizationLevel

    style ModelDiscovery fill:#1976d2,color:#ffffff
    style ModelOperations fill:#f9a825,color:#000000
    style StorageManagement fill:#388e3c,color:#ffffff
    style VRAMManagement fill:#512da8,color:#ffffff
```

## Open WebUI Features

```mermaid
graph TB
    subgraph UserInterface["USER INTERFACE"]
        ChatView["Chat View<br/>Conversation"]
        ModelSelector["Model Selector<br/>Switch LLMs"]
        SettingsPanel["Settings Panel<br/>Configuration"]
    end

    subgraph UserManagement["USER MANAGEMENT"]
        AdminUser["Admin User<br/>Initial Setup"]
        UserSignup["User Signup<br/>Optional"]
        AccessControl["Access Control<br/>Enable/Disable Signup"]
    end

    subgraph ConversationFeatures["CONVERSATION FEATURES"]
        MessageHistory["Message History<br/>Persistent"]
        EditMessages["Edit Messages<br/>Regenerate"]
        ExportChat["Export Chat<br/>Download"]
    end

    subgraph ModelFeatures["MODEL FEATURES"]
        LocalModels["Local Models<br/>Ollama"]
        StreamingResponse["Streaming Response<br/>Real-time"]
        ContextWindow["Context Window<br/>Token Management"]
    end

    ChatView --> ModelSelector
    ModelSelector --> SettingsPanel
    
    UserInterface --> UserManagement
    AdminUser --> UserSignup
    UserSignup --> AccessControl
    
    UserInterface --> ConversationFeatures
    MessageHistory --> EditMessages
    EditMessages --> ExportChat
    
    UserInterface --> ModelFeatures
    LocalModels --> StreamingResponse
    StreamingResponse --> ContextWindow

    style UserInterface fill:#1976d2,color:#ffffff
    style UserManagement fill:#f9a825,color:#000000
    style ConversationFeatures fill:#388e3c,color:#ffffff
    style ModelFeatures fill:#512da8,color:#ffffff
```

## Fly.io Configuration

```mermaid
graph TB
    subgraph FlyConfig["FLY.TOML CONFIGURATION"]
        AppName["App Name<br/>Unique Identifier"]
        VMSettings["VM Settings<br/>l40s GPU"]
        EnvVariables["Environment Variables<br/>ENABLE_SIGNUP"]
        ServiceConfig["Service Config<br/>Port 8080"]
    end

    subgraph ResourceAllocation["RESOURCE ALLOCATION"]
        GPUType["GPU Type<br/>Nvidia L40s"]
        CPUCores["CPU Cores<br/>Shared/Dedicated"]
        RAMAllocation["RAM Allocation<br/>Memory"]
        DiskSize["Disk Size<br/>Volume"]
    end

    subgraph NetworkConfig["NETWORK CONFIGURATION"]
        HTTPService["HTTP Service<br/>Port 8080"]
        InternalIP["Internal IP<br/>fly-local-6pn"]
        PublicIP["Public IP<br/>Fly Edge"]
    end

    subgraph ScalingConfig["SCALING CONFIGURATION"]
        AutoStopDelay["Auto-stop Delay<br/>Idle Timeout"]
        MinMachines["Min Machines<br/>0 (Scale to Zero)"]
        MaxMachines["Max Machines<br/>1 (Cost Control)"]
    end

    AppName --> VMSettings
    VMSettings --> EnvVariables
    EnvVariables --> ServiceConfig
    
    FlyConfig --> ResourceAllocation
    GPUType --> CPUCores
    CPUCores --> RAMAllocation
    RAMAllocation --> DiskSize
    
    FlyConfig --> NetworkConfig
    HTTPService --> InternalIP
    InternalIP --> PublicIP
    
    FlyConfig --> ScalingConfig
    AutoStopDelay --> MinMachines
    MinMachines --> MaxMachines

    style FlyConfig fill:#1976d2,color:#ffffff
    style ResourceAllocation fill:#f9a825,color:#000000
    style NetworkConfig fill:#388e3c,color:#ffffff
    style ScalingConfig fill:#512da8,color:#ffffff
```

## Key Design Principles

### 1. Unified Deployment
- Single Docker container runs both services
- Shared storage for models and data
- Simplified management

### 2. Cost Optimization
- Auto-scale to zero when idle
- GPU resources released automatically
- Pay only for active usage

### 3. GPU Performance
- Nvidia L40s for high performance
- llama.cpp leverages GPU acceleration
- Fast inference for most models

### 4. Quick Startup
- Machine boots in ~3 seconds
- Services ready in ~15 seconds
- Model loading time varies by size

### 5. Privacy-First
- Self-hosted with full control
- No external API dependencies
- Data stays on your infrastructure

## Technology Stack

- **LLM Runtime**: Ollama (llama.cpp)
- **Web Interface**: Open WebUI
- **Container**: Docker
- **Infrastructure**: Fly.io (GPU Machines)
- **GPU**: Nvidia L40s (48GB VRAM)
- **Storage**: Fly Volumes (persistent)
- **Networking**: Fly Proxy (edge routing)

## File Organization

```
ollama-open-webui/
├── Dockerfile             # Container definition
├── start.sh               # Startup script
├── fly.toml               # Fly.io configuration
└── README.md              # Documentation
```

## Deployment

```bash
# Clone and deploy
fly launch --from https://github.com/fly-apps/ollama-open-webui

# Access at https://[app].fly.dev

# First user becomes admin
# Optionally disable signup:
# Set ENABLE_SIGNUP=false in fly.toml
```

## Configuration Options

### VM Types
- Default: `l40s` (Nvidia L40s GPU)
- Alternative: Standard Fly Machines (CPU-only, slower)

### Environment Variables
- `ENABLE_SIGNUP`: Allow/prevent new user registration
- `OLLAMA_HOST`: Ollama API endpoint (default: localhost:11434)

### Volume Settings
- Size: Configurable (models can be large)
- Persistence: Survives machine restarts

## Performance Characteristics

### Startup Times
- Machine boot: ~3 seconds
- Container start: ~10 seconds
- Services ready: ~15 seconds total
- Model loading: Varies by model size (7B ~5s, 70B ~30s)

### Inference Performance
- Depends on model size and quantization
- L40s provides excellent performance
- llama.cpp optimizations for CUDA

### Cost Optimization
- Scales to zero automatically
- Only charged for active usage
- GPU time is premium but efficient

## Limitations & Considerations

- **Model Size**: Ensure model fits in VRAM (L40s = 48GB)
- **Cold Starts**: ~15s latency on first request after idle
- **CPU Performance**: Reduced without GPU, but functional
- **Network**: Private IPv6 within Fly network

---

This architecture provides a simple, cost-effective way to run private AI chat with local models on GPU infrastructure, combining the power of Ollama's LLM runtime with Open WebUI's polished interface, all automatically scaled on Fly.io.
