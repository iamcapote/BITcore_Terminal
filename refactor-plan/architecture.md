# BITcore Architecture

## Core Philosophy: The Ophanim Metaphor

BITcore's architecture is modeled after the Ophanim: a self-similar, all-seeing, fractal consciousness. This is not just a metaphor; it's a technical blueprint for a system that is scalable, adaptable, and transparent by design.

- **Self-Similar Consciousness**: Every agent contains smaller agents (tools → capabilities → atomic functions). This fractal structure allows behavior to scale from micro to macro without re-architecting.
- **All Eyes, All Directions**: The system is designed for complete observability. Every decision, data flow, and state change is captured and exposed through telemetry, logs, and a dual CLI/GUI interface.
- **Concentric Circles**: The architecture is layered, decoupling the agent's core reasoning from its tools, knowledge, and external systems. This allows for independent evolution of each layer.
- **Consciousness-as-Process**: Complex behavior emerges from the interaction of simple, modular components rather than being hard-wired. The agent reasons towards goals, composing capabilities as needed.

## Architectural Layers

The system is organized into a series of loosely-coupled layers, ensuring that changes in one area do not break another.

```
┌─────────────────────────────────────────┐
│ Interface (CLI + Web GUI)               │  ← Commands, Settings, Telemetry
├─────────────────────────────────────────┤
│ Orchestration (Agent Scheduler)         │  ← Mission dispatch, retry logic
├─────────────────────────────────────────┤
│ Agents (Reasoning, Planning)            │  ← Goal pursuit, tool selection
├─────────────────────────────────────────┤
│ Knowledge (Memory + Tools + Search)     │  ← Context retrieval, capability lookup
├─────────────────────────────────────────┤
│ Environment (File System, Shell, I/O)   │  ← Computer system, execution
├─────────────────────────────────────────┤
│ External Systems (LLM, Search, DB)      │  ← Venice, Brave, GitHub, Vector DB
└─────────────────────────────────────────┘
```

## Key Systems

- **Computer Environment**: Manages file systems, process execution, and shell integration, inspired by Agent Zero's "full-computer access" model.
- **Agent System**: Defines multi-agent roles, autonomy levels, and reasoning cycles.
- **Tools & Capabilities**: An MCP-based tool registry for discovering and invoking capabilities.
- **Memory Architecture**: Tiered memory system (episodic, semantic, procedural) for persistence and retrieval.
- **Interface System**: Governed by the **CLI ↔ Web Parity Doctrine**, ensuring every feature is accessible from both surfaces.

## CLI ↔ Web Parity

This is a non-negotiable architectural mandate. Every feature, setting, and toggle must be equally accessible from the command-line interface and the web GUI.

### Implementation Pattern

1.  **CLI Command Metadata**: Each CLI command module exports its metadata (name, description, flags).
2.  **Web Endpoint**: A `GET /api/commands` endpoint exposes this metadata to the frontend.
3.  **GUI Form Generation**: The GUI dynamically renders forms and controls based on the fetched metadata.
4.  **Parity Testing**: Automated tests in CI verify that the CLI and GUI surfaces remain in sync.
