This is a Node.js and Express.js application designed to serve as a research terminal. Currently, the app uses WebSockets for all interactions, leading to instability and unnecessary disconnections. The goal is to refactor the app to use WebSockets only where real-time communication is essential and switch to HTTP requests for everything else.

Primary Objective:
Enhance the stability and efficiency of the app by making a clear distinction between real-time and non-real-time processes.

Detailed Plan:

WebSockets Usage Refinement:

Scope: Reserve WebSockets strictly for descriptive, real-time updates such as live notifications, status updates, and displaying ongoing chat messages.

Exclusions: Avoid using WebSockets for executing processes, handling user authentication, conducting research tasks, or maintaining entire chat sessions.

Reconnection Strategy: Implement a robust reconnection strategy that ensures the user session and state are preserved during temporary disconnections.

HTTP Requests for Stability:

Authentication & Session Management: Shift user login, session management, and other similar tasks to HTTP requests to ensure reliability and persistent sessions.

Research Tasks & Background Processes: Move research task execution and other background operations to HTTP requests or background job queues, ensuring these processes continue running even if a WebSocket connection is interrupted.

Best Practices & Code Organization:

Separation of Concerns: Clearly separate the modules or services handling WebSocket communication from those handling HTTP requests. This improves maintainability and clarity.

Scalability: Design the refactored architecture to handle scaling easily, ensuring that real-time features and background tasks can grow independently.

Priming the Application & Team:

Developer Profile: This refactoring plan is tailored for a senior, experienced developer with extensive knowledge in designing robust, scalable systems. The expectation is to leverage best practices and deep expertise to achieve a production-grade solution.

---


additionally we need a pin pong sort of websocket structure.



---

# WebSocket and HTTP Refactoring Plan

## Objective
Enhance the stability and scalability of the MCP application by refining WebSocket usage and transitioning non-real-time tasks to HTTP.

---

## Key Changes Implemented

### WebSocket Usage Refinement
- **Scope**: WebSockets are now used only for real-time updates (e.g., notifications, chat messages, progress updates).
- **Exclusions**: Tasks like authentication, session management, and research execution have been moved to HTTP endpoints.
- **Ping/Pong Mechanism**: Implemented to detect and handle disconnections.

### HTTP Requests for Stability
- **Authentication & Session Management**: Moved to dedicated HTTP endpoints.
- **Research Tasks**: Long-running research tasks are now handled via background job queues, with progress updates sent through WebSockets.

### Separation of Concerns
- **Modules Created**:
  - `websocket.handler.mjs`: Handles WebSocket connections and message routing.
  - `session.manager.mjs`: Manages user sessions.
  - `research.routes.mjs`: Defines HTTP routes for research tasks.
  - `research.worker.mjs`: Executes research tasks asynchronously.

---
