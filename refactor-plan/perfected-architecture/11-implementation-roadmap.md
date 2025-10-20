<!--
Why: Sequence delivery so teams can iterate safely while proving each contract and module before layering complexity.
What: Breaks work into nine phases with goals, deliverables, and tests aligned to the perfected architecture.
How: Lists phase-by-phase checklists that map directly to repo paths and test suites.
-->

# Implementation Roadmap

## Phase 0: Foundation (Weeks 1-2)

**Goals:**
- Refactor existing code to match modular structure
- Create BaseAgent abstraction
- Build AgentContext and event bus
- Implement tool registry with hot-reload

**Deliverables:**
- `app/agents/base-agent.mjs`
- `app/agents/profiles/*.prompt.md`
- `app/tools/core/*.tool.mjs`
- `app/config/tools.json`

**Tests:**
- `tests/base-agent.test.mjs`
- `tests/tool-registry.test.mjs`

## Phase 1: Computer Environments (Weeks 2-3)

**Goals:**
- Docker orchestration layer
- Environment selector tool
- SeedCore + TinyCore + optional Kali catalog images
- Agent state serialization/restoration

**Deliverables:**
- `app/infrastructure/docker/environment-manager.service.mjs`
- `app/tools/core/select-computer.tool.mjs`
- `docker/environments/kali.dockerfile`
- `docker/environments/tinycore.dockerfile`

**Tests:**
- `tests/environment-manager.test.mjs`
- `tests/select-computer.test.mjs`

## Phase 2: File Browser (TUI) (Weeks 3-4)

**Goals:**
- Multi-panel file browser
- Zoxide integration
- File preview (syntax highlighting, images)
- Agent file_browser tool

**Deliverables:**
- `app/features/file-browser/file-browser.service.mjs`
- `app/features/file-browser/zoxide.service.mjs`
- `app/features/file-browser/file-browser.routes.mjs`
- `app/public/components/file-browser/FilePanel.jsx` (for web UI)

**Tests:**
- `tests/file-browser.test.mjs`
- `tests/zoxide.test.mjs`

## Phase 3: Hierarchical Agents (Weeks 4-5)

**Goals:**
- Agent delegation (coordinator → subordinates)
- Profile system (researcher, coder, analyst, validator, sentinel)
- Research coordinator flow (planner → specialists → reporter)
- Agent communication (superior ↔ subordinate)

**Deliverables:**
- `app/agents/hierarchy.mjs` (delegation logic)
- `app/agents/profiles/researcher.prompt.md`
- `app/agents/profiles/coder.prompt.md`
- `app/agents/profiles/coordinator.prompt.md`

**Tests:**
- `tests/agent-hierarchy.test.mjs`
- `tests/delegation.test.mjs`

## Phase 4: Extensions & Middleware (Week 5)

**Goals:**
- Extension hook system
- Token counter extension (example)
- Telemetry extension (metrics)
- Security extension (rate limiting)

**Deliverables:**
- `app/agents/base-agent.mjs` (callExtensions method)
- `app/extensions/token-counter.extension.mjs`
- `app/extensions/telemetry.extension.mjs`
- `app/config/extensions.json`

**Tests:**
- `tests/extensions.test.mjs`

## Phase 5: Memory System (Week 6)

**Goals:**
- FAISS vector store integration
- Memory save/load tools
- Memory consolidation (LLM-based)
- Bidirectional sync with external ontology service

**Deliverables:**
- `app/infrastructure/memory/faiss.service.mjs`
- `app/tools/core/memory-save.tool.mjs`
- `app/tools/core/memory-load.tool.mjs`
- `app/infrastructure/memory/consolidation.service.mjs`

**Tests:**
- `tests/faiss.test.mjs`
- `tests/memory-consolidation.test.mjs`

## Phase 6: UI Skins (Weeks 7-8)

**Goals:**
- Win95 theme (retro)
- Modern chatbot-ui style
- TUI mode (blessed/ink)
- Theme switcher

**Deliverables:**
- `app/public/themes/win95.css`
- `app/public/themes/modern.css`
- `app/public/components/win95/*.jsx`
- `app/public/components/modern/*.jsx`
- `app/commands/tui.cli.mjs`

**Tests:**
- `tests/theme-switcher.test.mjs`
- Visual regression tests (Percy or similar)

## Phase 7: Scheduler & Secrets (Week 8)

**Goals:**
- Task scheduler (cron, one-shot, planned)
- Secrets management (encrypted store)
- Secret injection (agents never see values)

**Deliverables:**
- `app/infrastructure/scheduler/task-scheduler.service.mjs`
- `app/tools/core/scheduler-create-task.tool.mjs`
- `app/infrastructure/secrets/secrets.service.mjs`
- `app/tools/core/secret-get.tool.mjs`

**Tests:**
- `tests/scheduler.test.mjs`
- `tests/secrets.test.mjs`

## Phase 8: Polish & Documentation (Week 9)

**Goals:**
- Comprehensive README
- API documentation (JSDoc → Markdown)
- User guides (agent creation, tool creation, UI customization)
- Video walkthrough

**Deliverables:**
- `README.md`
- `docs/API.md`
- `docs/USER_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/VIDEO_WALKTHROUGH.mp4`
