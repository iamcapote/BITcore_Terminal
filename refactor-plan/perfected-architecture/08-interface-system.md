<!--
Why: Guarantee interface parity across CLI, TUI, and Web GUI so every capability is accessible regardless of surface.
What: Documents the multi-skin architecture, component implementations, and theme-switching controls.
How: Details three canonical skins with example code, lists shared APIs, and outlines user configuration flows.
-->

# Interface System

## Multi-Skin Architecture

**Goal:** Same engine, multiple UIs. Operators choose an aesthetic without sacrificing functionality, and agents observe identical component APIs regardless of skin.

### Skin 1: Win95 Theme (Retro)

**Visual Style:**
- Windows 95 window chrome (title bar, minimize/maximize/close)
- System font (MS Sans Serif or equivalent)
- Start menu, taskbar
- Scrollbars with chunky arrows
- Dialog boxes with "OK" and "Cancel" buttons

**Implementation:**
- React components styled with `react-95` or custom CSS
- Window manager: `react-rnd` for draggable/resizable windows
- Icons: Win95 icon pack

**Example Component:**
```jsx
// app/public/components/win95/ChatWindow.jsx
import { Window, WindowHeader, WindowContent, Button } from 'react-95';

export function ChatWindow({ messages, onSend }) {
  return (
    <Window style={{ width: '600px', height: '400px' }}>
      <WindowHeader className="window-header">
        <span>Chat - BITcore Terminal</span>
        <Button size="sm">×</Button>
      </WindowHeader>
      <WindowContent>
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className="message">
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <input type="text" onKeyDown={handleSend} />
      </WindowContent>
    </Window>
  );
}
```

### Skin 2: Modern Chatbot UI (Clean Style)

**Visual Style:**
- Inspired by chatbot-ui (McKay Wrigley) and openchat-ui
- Clean, minimalist design
- Sidebar with chat history
- Message bubbles (user on right, assistant on left)
- Syntax-highlighted code blocks
- File attachments with preview
- Settings panel with sliders (temperature, max tokens)

**Key Features (from chatbot-ui):**
- **Sidebar:** Collapsible, shows recent chats, folders, prompts
- **Message Actions:** Copy, edit, regenerate, fork chat
- **File Uploads:** Drag-and-drop, shows file count badge
- **Model Selector:** Dropdown with model icon and name
- **Quick Settings:** Temperature/max tokens/prompt without leaving chat
- **Image Display:** Inline images with lightbox on click
- **Streaming:** Real-time token streaming with smooth scroll

**Implementation:**
- Tailwind CSS + shadcn/ui components
- Framer Motion for animations
- React Markdown for message rendering
- Prism.js for syntax highlighting

**Example Component:**
```jsx
// app/public/components/modern/ChatMessage.jsx
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

export function ChatMessage({ message, isUser }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[70%] rounded-lg p-4 ${
        isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        <ReactMarkdown
          components={{
            code({node, inline, className, children, ...props}) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter language={match[1]} {...props}>
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
```

### Skin 3: Superfile TUI (Terminal Mode)

**Visual Style:**
- Full terminal UI (no browser)
- Multi-panel file browser
- Vim-style keybindings
- Status bar at bottom
- Command palette (`Ctrl+P`)

**Implementation:**
- `blessed` or `ink` (React for CLIs) for TUI rendering
- `blessed-contrib` for charts/graphs
- SSH into BITcore container, launch TUI directly

**Example:**
```javascript
// app/commands/tui.cli.mjs
import blessed from 'blessed';

export async function launchTUI() {
  const screen = blessed.screen({ smartCSR: true });
  
  const fileList = blessed.list({
    parent: screen,
    label: ' Files ',
    top: 0,
    left: 0,
    width: '33%',
    height: '100%-3',
    border: { type: 'line' },
    style: {
      fg: 'white',
      border: { fg: 'cyan' },
      selected: { bg: 'blue' }
    },
    keys: true,
    vi: true
  });
  
  const preview = blessed.box({
    parent: screen,
    label: ' Preview ',
    top: 0,
    left: '33%',
    width: '67%',
    height: '100%-3',
    border: { type: 'line' },
    style: { fg: 'white', border: { fg: 'cyan' } },
    scrollable: true,
    keys: true,
    vi: true
  });
  
  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: ' [?] Help | [/] Search | [q] Quit ',
    style: { fg: 'white', bg: 'blue' }
  });
  
  screen.key(['q', 'C-c'], () => process.exit(0));
  
  screen.render();
}
```

## Theme Switching

**User Command:**
```bash
bitcore config set ui.theme win95
bitcore config set ui.theme modern
bitcore config set ui.theme tui
```

**Web UI:**
```javascript
// Settings panel
<Select value={theme} onChange={setTheme}>
  <option value="win95">Windows 95</option>
  <option value="modern">Modern Chatbot</option>
  <option value="tui">Terminal (TUI)</option>
</Select>
```

**Implementation:**
- `app/config/ui-themes.json`: Theme metadata
- `app/public/themes/*.css`: Theme-specific stylesheets
- React context provider: `<ThemeProvider theme={selectedTheme}>`
- Hot-reload CSS on theme change (no page refresh)

---

## Console Embedding Architecture

**Purpose:** Embed BITcore terminal within external ontology/planning UIs (e.g., Semantic Flow console tab)

### Option A: Iframe Embedding

**Implementation:**
```html
<!-- In external ontology UI console tab -->
<iframe
  src="http://localhost:50002/terminal"
  style="width: 100%; height: 100%; border: none;"
  sandbox="allow-same-origin allow-scripts allow-forms"
/>
```

**Pros:**
- Minimal integration effort
- Security isolation by default
- BITcore runs independently

**Cons:**
- Separate auth contexts (need shared session token)
- PostMessage for communication (introduces latency)
- Style inconsistencies (ontology theme vs terminal theme)

**Communication Pattern:**
```javascript
// Ontology UI → BITcore (via postMessage)
iframe.contentWindow.postMessage({
  type: 'workflow:planned',
  data: { workflowId, steps }
}, 'http://localhost:50002');

// BITcore → Ontology UI (event listener)
window.addEventListener('message', (event) => {
  if (event.origin === 'http://localhost:50002') {
    const { type, data } = event.data;
    if (type === 'mission:completed') {
      updateOntologyGraph(data);
    }
  }
});
```

### Option B: Module Federation (Recommended)

**Implementation:**
```javascript
// In external ontology UI webpack config
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'ontologyUI',
      remotes: {
        bitcore: 'bitcore@http://localhost:50002/remoteEntry.js'
      }
    })
  ]
};

// In ontology UI Console component
import { Terminal } from 'bitcore/Terminal';

export function ConsoleTab() {
  const { agentContext } = useOntologyContext();
  
  return (
    <div className="console-container">
      <Terminal sharedContext={agentContext} />
    </div>
  );
}
```

**Pros:**
- Shared React context (single AgentContext across both UIs)
- Seamless UX (no iframe quirks or borders)
- Direct function calls (no postMessage serialization)
- Shared event bus for real-time sync

**Cons:**
- Requires BITcore to build as federated module
- Version coordination complexity (React versions must match)
- Both apps must use compatible build tools

**Shared Context Pattern:**
```javascript
// Shared AgentContext flows between both UIs
class AgentContext {
  constructor(config) {
    this.id = generateId();
    this.sessionId = config.sessionId;
    this.eventBus = new EventEmitter();
    this.subscribers = new Set();
  }
  
  // Emit to all subscribers (ontology UI + terminal UI)
  emit(event, data) {
    this.eventBus.emit(event, data);
    for (const ws of this.subscribers) {
      ws.send(JSON.stringify({ event, data }));
    }
  }
  
  // Subscribe UI
  subscribe(ws) {
    this.subscribers.add(ws);
    ws.on('close', () => this.subscribers.delete(ws));
  }
}
```

### Option C: Shared Backend + Dual Frontends

**Architecture:**
```
┌─────────────────┐       ┌─────────────────┐
│ Ontology UI     │       │  BITcore Web    │
│   (React)       │       │   (Terminal UI) │
└────────┬────────┘       └────────┬────────┘
         │                         │
         └────────┬────────────────┘
                  │
         ┌────────▼────────┐
         │  Shared Backend │
         │  (Node.js API)  │
         │  + Execution    │
         └─────────────────┘
```

**Flow:**
1. Ontology UI calls `/api/missions/create` (shared backend)
2. Backend publishes event to BITcore execution engine (same process)
3. BITcore processes mission, emits progress events
4. Both UIs subscribe to WebSocket (`/api/events`) for real-time updates
5. Ontology Console tab renders BITcore terminal output in styled widget

**API Contracts:**
```javascript
// Shared backend endpoints used by both UIs
POST /api/missions/create
  → { missionId, title, goal, steps }
  
GET  /api/missions/:id
  → { mission, status, telemetry }
  
GET  /api/events
  → SSE stream (mission:started, mission:step_completed, etc.)
  
POST /api/workflows/plan
  → { workflowId, steps }
  → Creates mission + scheduler task
```

**Pros:**
- Single codebase for backend logic
- No iframe or module federation complexity
- Consistent API across both UIs
- Clean separation of concerns

**Cons:**
- Ontology UI depends on BITcore backend (coupling)
- Requires BITcore to run as library, not standalone app
- Deployment coordination required

### BYOK Security Bridge

**Challenge:** Ontology UI stores user API keys; BITcore needs them at runtime

**Option 1: Secure Proxy (Recommended)**
1. User enters keys in ontology UI settings
2. Ontology UI encrypts keys with session-specific keypair
3. Sends encrypted blob to BITcore via HTTPS + auth token
4. BITcore decrypts with private key, stores in memory only (never disk)
5. Keys injected into agent tools at runtime

**Option 2: Direct Transfer (Less Secure)**
1. Ontology UI decrypts keys in browser
2. Sends plaintext via WebSocket (TLS only)
3. BITcore receives and stores in encrypted-config.store.mjs
4. Risk: Keys visible in network logs if TLS breaks

**Recommended Pattern:**
- Keys expire after 24 hours (user re-enters)
- Keys never logged or included in telemetry
- Secrets redacted from LLM context

**Implementation:**
```javascript
// Ontology UI → BITcore key handoff
async function transferKeys(keys, sessionToken) {
  const publicKey = await fetchBITcorePublicKey();
  const encrypted = await encryptWithPublicKey(keys, publicKey);
  
  await fetch('http://localhost:50002/api/secrets/handoff', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ encrypted, expiresIn: 86400 })
  });
}
```
