# Vendor Pattern Reference

This document serves as a high-signal inventory of patterns adopted from best-in-class, MIT-licensed open-source projects. It is the canonical reference for "how we build things" by leveraging production-proven solutions.

## Core Principle: Adapt, Don't Reinvent

Before designing any new component or system, consult this guide to see if a vendor has already solved the problem at scale. Our goal is to synthesize the best ideas from the open-source community into a cohesive, professional application.

## Vendor Index

| Vendor | Key Concept | Why It Matters |
| :--- | :--- | :--- |
| **Agent Zero** | Full-computer access, MCP tools, scheduling | The core differentiator for BITcore, enabling true agent autonomy and environment control. |
| **DeerFlow** | Multi-agent orchestration, checkpoint recovery | Provides a battle-tested model for complex, resilient agentic workflows. |
| **LibreChat** | Multi-provider routing, agent controllers | A mature implementation of abstracting LLM providers and handling tool invocation. |
| **Chatbot-UI** | Modern chat shell, sidebar navigation, streaming | The gold standard for a React/TypeScript frontend, especially for session and content hierarchy. |
| **Anything-LLM** | RAG pipelines, document vectorization | A production-grade RAG implementation for knowledge retrieval and document processing. |
| **Superfile** | TUI/UX patterns, CLI ↔ GUI parity | The benchmark for ensuring every CLI command and flag has a perfect GUI equivalent. |
| **Semantic Flow** | Agent skill composition, workflow orchestration | Demonstrates how to build reusable agent skills that can be composed into complex workflows. |

---

## Key Patterns by Domain

### Multi-Agent Orchestration

-   **Pattern**: Use a coordinator/dispatcher model to manage agentic workflows. Employ a state machine for resilience and checkpointing for recovery.
-   **Primary Vendor**: **DeerFlow** (`coordinator.py`, `state_machine.py`, `checkpoint_saver.py`).
-   **BITcore Implementation**:
    -   `app/agents/coordinator.agent.mjs` will adapt DeerFlow's coordinator pattern.
    -   `app/infrastructure/workflow-orchestrator.mjs` will use a state machine inspired by LangGraph.js and DeerFlow's architecture.

### Tooling & Capabilities

-   **Pattern**: Expose agent capabilities as "instruments" via an MCP (Model Context Protocol) server. This allows for a discoverable, standardized way to invoke tools.
-   **Primary Vendor**: **Agent Zero** (`prompts/agent.system.instruments.md`, `python/helpers/mcp_server.py`).
-   **BITcore Implementation**:
    -   `app/infrastructure/tool-registry.service.mjs` will implement the MCP server pattern.
    -   Tool definitions will follow the "instrument" metadata structure.

### Frontend Shell & Navigation

-   **Pattern**: The main application layout should consist of a collapsible sidebar for **content navigation** (sessions, chats, files) and a main content area. Commands are executed via a terminal or command palette, not sidebar buttons.
-   **Primary Vendor**: **Chatbot-UI** (`components/sidebar/`, `app/[locale]/layout.tsx`).
-   **BITcore Implementation**:
    -   The `ShellLayout.tsx` component is a direct adoption of this pattern.
    -   The sidebar will be refactored to manage lists of sessions and research tasks, removing static command buttons.

### Memory & Knowledge Retrieval

-   **Pattern**: Segment agent memory into distinct, purpose-driven areas (e.g., working memory, long-term memory, solutions). Use a vector database and a RAG pipeline for retrieving knowledge from documents.
-   **Primary Vendors**: **Agent Zero** (`memory/memory_areas.py`) for segmentation, **Anything-LLM** (`server/utils/vectorDb/`, `DocumentProcessor.js`) for RAG.
-   **BITcore Implementation**:
    -   `app/infrastructure/memory.service.mjs` will implement the tiered memory areas.
    -   A new `document-processor.service.mjs` will handle vectorization for the RAG pipeline.

### CLI ↔ GUI Parity

-   **Pattern**: Every CLI command, flag, and argument must have a corresponding control in the GUI. This is achieved by exporting metadata from CLI modules and dynamically rendering UI components.
-   **Primary Vendor**: **Superfile** (conceptual model).
-   **BITcore Implementation**:
    -   All `*.cli.mjs` files export a `commandMetadata` object.
    -   A `GET /api/commands` endpoint provides this metadata to the frontend.
    -   The GUI uses this data to auto-generate forms, ensuring perfect synchronization.
