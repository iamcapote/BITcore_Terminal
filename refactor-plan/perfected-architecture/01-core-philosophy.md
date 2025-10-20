<!--
Why: Capture the guiding principles that define the perfected BITcore architecture so every downstream module inherits the same intent.
What: Enumerates the philosophical pillars that inform environment choices, interfaces, extensibility, and rebuild guarantees.
How: Lists each pillar with precise descriptions that teams can reference before designing or implementing features.
-->

# Core Philosophy

## What Makes This "Perfected"?

1. **Environment Sovereignty:**  
   Agents choose from a curated distro catalog—SeedCore (ultra-minimal baseline), TinyCore (micro footprint), Debian Slim (general purpose), Kali (security toolkit), Alpine, Arch, or custom builds. A bootstrap wizard downloads only the required packages so the entire system can be recreated after a wipe.

2. **Unified Pattern Synthesis:**  
   Contracts capture hierarchical coordination loops, deep-research planners, specialist swarms, and outcome reporters that earlier ecosystems pioneered—no external references or proprietary code required.

3. **Isolation-First Filesystem:**  
   Flattened boundaries separate the framework core, user projects, ephemeral computer sandboxes, plugins, and agent state so destructive actions stay contained and recoverable.

4. **Interface Parity:**  
   CLI and GUI ride the same API surface; every feature, toggle, tool call, MCP bridge, and extension is invokable from terminal scripts or themed UIs with machine-readable responses.

5. **Extensible by Default:**  
   Plugins, extensions, MCP services, themes, components, instruments, and scripts register through declarative manifests and hot-swappable adapters; nothing is hard-coded.

6. **Rebuild Guarantee:**  
   Contracts, scaffolding scripts, and wizard flows guarantee the platform can be reproduced 1:1 on any host—even after deleting all binaries—without borrowing code from legacy frameworks.

7. **Lightweight Compute:**  
   Tooling prefers lean runtimes (ggml, onnxruntime, ollama, node, deno, rust). Heavy stacks like PyTorch remain optional add-ons, never a baseline dependency.
