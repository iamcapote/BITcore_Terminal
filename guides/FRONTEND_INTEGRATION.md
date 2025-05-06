# Frontend Integration Guide for Deep Research Privacy App

## 1. Objective

This guide provides instructions for frontend developers to adapt an existing or new frontend application to communicate correctly with the "Deep Research Privacy App" backend via its WebSocket API. The goal is to implement the necessary client-side logic for message handling, state management, and user input processing, preparing the frontend's static build assets for integration into the backend's `/app/public` directory.

## 2. Backend API Overview

The backend exposes a stateful, terminal-like interface over a single WebSocket endpoint.

*   **WebSocket Endpoint:** `/api/research/ws`
    *   The connection URL depends on the backend's host and port. Use `window.location` to determine the correct protocol (`ws:` or `wss:`) and host dynamically.
    *   Example: `ws://localhost:3000/api/research/ws` or `wss://your-deployed-app.com/api/research/ws`

## 3. Frontend Implementation Guide

The frontend must act as a compliant WebSocket client, managing its state based on server messages and sending user input in the correct format. A modular JavaScript structure is recommended.

### 3.1. Suggested JavaScript Modules

*   **`webSocketManager.js`**: Handles connection, sending/receiving raw messages, reconnection.
*   **`stateManager.js`**: Tracks frontend state (connection, mode, auth, input status).
*   **`uiManager.js`**: Interacts with the DOM (displaying output, managing input field, updating status).
*   **`inputProcessor.js`**: Handles user input submission, parses commands, routes input based on current mode.
*   **`messageHandler.js`**: Parses specific message types received from the server and triggers appropriate actions (state/UI updates).
*   **`app.js` / `main.js`**: Initializes modules and orchestrates the application startup.

### 3.2. WebSocket Manager (`webSocketManager.js`)

*   **Connect:** Establish connection using dynamic URL based on `window.location`.
*   **Event Handlers:**
    *   `onopen`: Log success, update state/UI (`StateManager.isConnected = true`).
    *   `onmessage`: Parse incoming JSON (`JSON.parse`). Pass valid messages to `MessageHandler.handleMessage()`. Handle parse errors.
    *   `onerror`: Log error, update state/UI, trigger reconnection.
    *   `onclose`: Log close, update state/UI (`StateManager.isConnected = false`), trigger reconnection.
*   **Reconnection:** Implement a robust reconnection strategy (e.g., exponential backoff).
*   **Send Message:** Provide a function `sendMessage(type, payload)` that formats `{ type, payload }`, stringifies it, and sends via the WebSocket. Ensure connection is open before sending.

### 3.3. State Manager (`stateManager.js`)

*   **Track State:** Maintain variables for:
    *   `isConnected`: boolean
    *   `currentMode`: string ('disconnected', 'command', 'chat', 'research', 'prompt')
    *   `isInputEnabled`: boolean
    *   `loggedInUser`: object (`{ username, role }`) or `null`
    *   `currentPromptContext`: string or `null` (from `prompt` messages)
*   **Accessors/Mutators:** Provide functions to get/set state safely.
*   **(Optional) Notifications:** Use callbacks or an event emitter to notify other modules of state changes.

### 3.4. UI Manager (`uiManager.js`)

*   **DOM Elements:** Cache references to input field, output area, status indicators, etc.
*   **Output:**
    *   `appendOutput(text, type)`: Appends text to output area, applying CSS classes based on `type` ('output', 'error', 'system', 'progress', 'prompt'). Scroll to bottom.
*   **Input Field:**
    *   `setInputEnabled(isEnabled)`: Toggle `disabled` attribute, manage focus.
    *   `setInputType(type)`: Change input `type` ('text', 'password').
    *   `clearInput()`: Clear value.
    *   `getInputFieldValue()`: Get value.
*   **Status:**
    *   `updateStatusIndicator(connectionStatus, authStatus)`: Update UI text/styles.
*   **Download:**
    *   `triggerDownload(filename, content)`: Create data URL, use temporary `<a>` tag to trigger browser download.

### 3.5. Input Processor (`inputProcessor.js`)

*   **Event Listener:** Listen for input submission (e.g., Enter key on input field).
*   **Routing Logic:** On submission:
    1.  Get `currentMode` from `StateManager`.
    2.  Get `inputValue` from `UIManager`.
    3.  **If `currentMode === 'prompt'`:**
        *   Send: `{ type: 'input', payload: inputValue }`
        *   Reset `StateManager.currentPromptContext`.
    4.  **If `currentMode === 'chat'` and input is NOT a command (`/`):**
        *   Send: `{ type: 'chat-message', payload: inputValue }`
    5.  **If `currentMode === 'command'` OR (`currentMode === 'chat'` and input IS a command):**
        *   Parse `inputValue` into `command` (e.g., '/login') and `args` (e.g., ['username']). Handle spaces and quotes appropriately.
        *   Send: `{ type: 'command', payload: { command, args } }`
    6.  Call `UIManager.clearInput()`.

### 3.6. Message Handler (`messageHandler.js`)

Implement `handleMessage(message)` using a `switch (message.type)`:

*   **`output`**: `UIManager.appendOutput(message.payload, 'output')`
*   **`error`**: `UIManager.appendOutput(message.payload, 'error')`
*   **`progress`**: `UIManager.appendOutput(\`Progress: ${message.payload.message} (${message.payload.step}/${message.payload.total})\`, 'progress')`
*   **`prompt`**:
    *   `UIManager.appendOutput(message.payload.message, 'prompt')`
    *   `StateManager.setMode('prompt')`
    *   `StateManager.setCurrentPromptContext(message.payload.context)`
    *   If context suggests password, `UIManager.setInputType('password')`, else `UIManager.setInputType('text')`.
    *   `UIManager.setInputEnabled(true)`
*   **`mode_change`**:
    *   `StateManager.setMode(message.payload)`
    *   Update UI prompt indicator if applicable.
    *   Reset input type to 'text' via `UIManager`.
*   **`login_success`**:
    *   `StateManager.setLoggedInUser(message.payload)`
    *   `UIManager.updateStatusIndicator(...)`
    *   `UIManager.appendOutput(\`Login successful as ${message.payload.username} (${message.payload.role}).\`, 'system')`
*   **`logout_success`**:
    *   `StateManager.setLoggedInUser(null)`
    *   `StateManager.setMode('command')`
    *   `UIManager.updateStatusIndicator(...)`
    *   `UIManager.appendOutput('Logout successful.', 'system')`
*   **`enable_input`**: `StateManager.setInputEnabled(true); UIManager.setInputEnabled(true)`
*   **`disable_input`**: `StateManager.setInputEnabled(false); UIManager.setInputEnabled(false)`
*   **`download_file`**: `UIManager.triggerDownload(message.payload.filename, message.payload.content)`
*   **`memory_commit`**: `UIManager.appendOutput(\`Memory committed. SHA: ${message.payload.sha}\`, 'system')`
*   **`research_complete`**: `UIManager.appendOutput('Research complete.', 'system')`
*   **`connection`**: `UIManager.appendOutput(\`Connection: ${message.payload.message}\`, 'system'); UIManager.updateStatusIndicator(...)`
*   **`session-expired`**:
    *   `UIManager.appendOutput('Session expired. Please log in again.', 'error')`
    *   `StateManager.setLoggedInUser(null)`
    *   `StateManager.setMode('command')`
    *   `UIManager.updateStatusIndicator(...)`
*   **`default`**: Log unexpected message types.

## 4. Final Integration Steps

1.  **Build Frontend:** Create a production build of your frontend application, resulting in static HTML, CSS, and JavaScript files.
2.  **Prepare Assets:** Ensure the main entry point is `index.html` and all asset paths (CSS, JS, images) within the HTML are relative.
3.  **Replace Backend Public Folder:**
    *   In the backend project (`MCP`), **delete** the existing contents of the `app/public/` directory (including `index.html`, `terminal.js`, `command-processor.js`, `webcomm.js`, etc.).
    *   **Copy** your built static frontend assets directly into the `app/public/` directory.
4.  **Test:** Run the backend server (`npm start`). Access the application in your browser. Verify that your new frontend loads and successfully communicates with the backend via WebSockets, handling all commands and interactions correctly.

---
*Remember to consult the backend's `README.md` and potentially the source code (`app/features/research/routes.mjs`, `app/public/*` - before deletion) for further context if needed.*