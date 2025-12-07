# GUI Migration Plan

This document outlines the strategy for migrating from the legacy GUI (port 3000) to the modern, refactored GUI (port 5173).

## High-Level Strategy

The migration will occur in phased sprints, moving core features from the cluttered, unprofessional legacy UI to a clean, modern, and performant new foundation. The new GUI will be built on a professional design system, enforce strict CLI ↔ Web parity, and leverage patterns from best-in-class open-source vendor projects.

## Dual GUI State

-   **Port 3000 (`pnpm run start`)**: Legacy UI. Feature-complete but suffers from poor UX, inconsistent design, and technical debt. It serves as the functional baseline to be migrated.
-   **Port 5173 (`pnpm run ui:dev`)**: Modern UI. A clean slate built on React/Vite/TypeScript with a proper design token system and component library. This is the future of the BITcore interface.

## Migration Roadmap

The migration is broken down into four distinct phases, each with a clear objective and acceptance gate.

### Phase 1: Shell & Foundation

-   **Objective**: Establish a responsive shell, a functional command palette, and a robust theme provider.
-   **Deliverables**:
    -   Responsive shell layout (sidebar, command surface, insight deck).
    -   Command palette populated by CLI metadata from a `GET /api/commands` endpoint.
    -   Theme provider supporting three distinct skins (Hacker, Modern, Retro).
    -   Functional WebSocket transport layer for telemetry.
-   **Acceptance Gate**: Lighthouse FCP < 2.5s; keyboard navigation audit passes.

### Phase 2: Telemetry & Archives

-   **Objective**: Visualize the agent's inner state with live telemetry and provide access to historical data.
-   **Deliverables**:
    -   Live research progress card (progress ring, stage timeline, token gauge).
    -   Memory timeline with GitHub sync indicators.
    -   Streaming logs viewer with filtering capabilities.
    -   Archive explorer for downloading and exporting session data.
-   **Acceptance Gate**: WebSocket contract tests pass; end-to-end Playwright tests for a research run succeed.

### Phase 3: Full Command Coverage

-   **Objective**: Achieve 100% CLI ↔ GUI parity for all commands and settings.
-   **Deliverables**:
    -   Full-featured chat interface with memory context display.
    -   Comprehensive settings drawer for configuration, API keys, and user preferences.
    -   "Mission Control" board for managing agent tasks.
    -   MCP tool dock displaying the tool registry and connection states.
-   **Acceptance Gate**: Automated CLI parity script passes for all commands.

### Phase 4: Polish & Rollout

-   **Objective**: Harden the UI for performance and accessibility, and make it the default experience.
-   **Deliverables**:
    -   Bundle size under 350 KB (gzipped).
    -   WCAG 2.2 AA compliance.
    -   Complete theme parity across all three skins.
    -   Default application entry points to the new GUI, with the legacy UI available at a `/ui-legacy` path.
-   **Acceptance Gate**: Successful rollout to all users.
