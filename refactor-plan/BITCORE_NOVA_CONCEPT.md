# BITcore Nova: GUI Concept & Implementation Plan

This document outlines the vision, architecture, and implementation plan for "Bitcore Nova," a new graphical user interface for the BITcore Terminal. It synthesizes the best features from existing GUIs, vendor research, and four distinct VS Code-style mockups into a single, coherent, and powerful agent-native development environment.

## 1. Core Philosophy

Bitcore Nova is designed to be an extremely modular, intuitive, and customizable interface for interacting with AI agents. It combines the power of an agentic backend like `agent-zero` with the polished, developer-centric user experience of a modern IDE. The console is the chat; the chat is the console.

Key principles include:
- **Clarity & Minimalism:** Every UI element has a clear purpose.
- **Elegant Interactivity:** Subtle animations and micro-interactions provide satisfying feedback.
- **Themeable:** Full support for custom themes (dark, light, retro).
- **Agent-Centric Flow:** The UI is built around the agent's "plan, simulate, act" loop.
- **Fractal & Organized Interface:** Deeply layered, but never chaotic.
- **Potent Command Deck:** A powerful, keyboard-first command palette for maximum efficiency.

## 2. Synthesized Architecture & Layout

The "Bitcore Nova" GUI is a composite of the best ideas from the `refactor-plan/sandbox/bitcore-vscode/` mockups.

| UI Element | Blueprint Source | Rationale |
| :--- | :--- | :--- |
| **Core Foundation** | `vscodefork.md` | Provides a robust, feature-complete structure using `shadcn/ui`. |
| **Left Sidebar** | `vsagentic.md` | Classic, intuitive two-part layout: a thin "Activity Bar" for context switching and a wider "Sidebar" for content. |
| **Iconography** | `novaide.md` | Superior visual clarity and intuitive, action-oriented icons. |
| **Center Panel** | `vscodefork.md` | Tab-based interface where the **Chat/Console is a first-class citizen** alongside the file editor. |
| **Right Panel** | `vscodefork.md` | Context-sensitive "Inspector" for AI suggestions, metadata, and tool controls. |
| **Bottom Panel** | `novaide.md` | Clean, intuitive tabbed layout for Terminal, Tasks, and Logs. |
| **Status Bar** | `vsfork.md` | Essential at-a-glance info on agent status, environment, and sync state. |

## 3. Feature Integration

Functionality will be drawn from vendor research and the original BITcore GUI.

- **From `agent-zero`**:
    - **Computer-as-Tool:** A central UI for managing agent capabilities (filesystem, shell, etc.).
    - **Agent & Prompt Management:** Dedicated interfaces for managing agent personas and editing system prompts.
    - **Instruments:** A core feature for managing and running reusable scripts.

- **From `vector-admin`**:
    - **Data Management:** Professional, data-centric interfaces for managing vector stores and database connections.

- **From `superfile`**:
    - **Keyboard-First UX:** A powerful Command Palette inspired by the efficiency of terminal-based file managers.

- **From `deer-flow`**:
    - **Modern Chat Components:** Rich markdown, resource mentions, and seamless message inputs.

- **From Legacy BITcore GUI**:
    - **Missions & Tasks:** High-level objectives ("Missions") and background processes ("Tasks") will be integrated into dedicated UI views.

## 4. UI/UX Principles & Design Details

- **Themes:** `dark`, `light`, `retro (Win95)`.
- **Layout:** Bento grids for organized dashboards.
- **Interactions:** Subtle, elegant animations and non-intrusive feedback.
- **Agent Flow:** Explicit "Plan," "Simulate," and "Act" stages with multi-step validation and previews.
- **Core Views:** Command Deck, Mission Briefs, Plan Views, Logs, Dry-Run Simulations, and a comprehensive management interface for Memory/Knowledge/Vectors.

## 5. Implementation Plan

1.  [In-Progress] **Establish Foundation**: Create the new application structure under `app/nova/`. Use `vscodefork.md` as the primary code base.
2.  **Integrate Layouts**: Restructure the `vscodefork.md` code to match the `vsagentic.md` sidebar model.
3.  **Apply Visuals**: Replace default icons and styles with the superior iconography from `novaide.md`.
4.  **Develop Theme**: Create a custom `shadcn/ui` theme to establish the "Bitcore Nova" brand identity.
5.  **Component Porting**: Incrementally port and integrate features from the other mockups and vendor examples, as detailed in the roadmap below.
6.  **Backend Integration**: Wire the new front-end components to the existing BITcore backend services.

## 6. Feature Implementation Roadmap

This roadmap tracks the features and UX goals required for the Nova GUI, with explicit references to vendor implementations for guidance.

### Phase 1: The Foundational IDE Shell

*Goal: Build the core, interactive shell of the application.*

| Feature | Status | UX & Design Goals / Vendor Reference |
| :--- | :--- | :--- |
| **1. Unified Chat / Terminal** | `Not Started` | A tab-based central console. Input auto-switches between chat and command modes. Renders rich content (Markdown, code, tables). **Ref: `LibreChat`, `chatbot-ui`** |
| **2. Visual File Manager** | `Not Started` | A VS Code-style file explorer tree in the left sidebar with full context-menu operations (create, rename, delete). **Ref: `superfile` (for efficiency), VS Code (for layout)** |
| **3. Integrated Web Browser** | `Not Started` | A fully controllable Chromium browser in a main panel tab for agent web navigation and user browsing. Supports visual & headless modes. **Ref: `agent-zero`** |
| **4. Multi-Workspace Support** | `Not Started` | Ability to create, load, and switch between isolated project workspaces from the sidebar. **Ref: `anything-llm`** |
| **5. Comprehensive Settings** | `Not Started` | A dedicated view for managing API Keys, Model Selection, Security, and Appearance. **Ref: `chatbot-ui`, `LibreChat`** |

### Phase 2: Core Agentic Architecture

*Goal: Implement the systems that allow the agent to think, act, and learn.*

| Feature | Status | UX & Design Goals / Vendor Reference |
| :--- | :--- | :--- |
| **1. Agent "Computer" View** | `Not Started` | A transparent view of the agent's environment: working directory, running processes, and shell history. **Ref: `agent-zero`** |
| **2. Agent Memory Manager** | `Not Started` | A UI to visualize and inspect the agent's memory tiers: short-term (session log), long-term (archive), and procedural (skills). **Ref: `agent-zero`** |
| **3. Nested Agent System** | `Not Started` | Core workflow engine allowing a primary agent to delegate tasks to sub-agents or control other web apps via the browser tool. **Ref: `agent-zero`** |
| **4. Visual Workflow Builder** | `Not Started` | A drag-and-drop canvas to view, edit, and debug the agent's plan as a node-based graph. **Ref: `semantic_flow`, `deerflow`** |

### Phase 3: Knowledge & Data Management

*Goal: Build professional interfaces for managing the agent's knowledge base.*

| Feature | Status | UX & Design Goals / Vendor Reference |
| :--- | :--- | :--- |
| **1. Knowledge/Vector DB UI** | `Not Started` | A dashboard for managing vector store connections (Chroma, Pinecone, etc.) and inspecting data. **Ref: `vector-admin`, `anything-llm`** |
| **2. Document Ingestion UI** | `Not Started` | A UI for uploading files/folders, connecting data sources, and monitoring the ingestion and chunking process. **Ref: `anything-llm`** |
| **3. Hot-Directory Service** | `Not Started` | A background service that automatically ingests files from a designated "hot directory." **Ref: `anything-llm` ("Collector")** |

### Phase 4: Tooling & Extensibility

*Goal: Create a rich ecosystem of tools and a clear path for future expansion.*

| Feature | Status | UX & Design Goals / Vendor Reference |
| :--- | :--- | :--- |
| **1. Tooling Backlog** | `Not Started` | Implement a core set of agent tools: HTTPS requests, Webhooks for data reception, and Agent-to-Agent (A2A) communication protocols. **Ref: `agent-zero` ("Instruments")** |
| **2. Plugin/Extension System** | `Not Started` | Design an architecture for adding third-party tools, data connectors, and even custom UI panes. **Ref: `LibreChat`** |
| **3. Ported Legacy Views** | `Not Started` | Re-implement the remaining legacy views (Research Archive, Prompt Editor, Mission Organizer) within the new Nova architecture. |
