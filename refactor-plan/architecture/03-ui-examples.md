<!--
Why: Consolidate interface system requirements, skins, and UX design patterns for Nova delivery.
What: Interface system details, implementation examples, UI patterns, embedding, and roadmap expansions.
How: Preserve canonical UI and interface signals in one focused file.
Status: active
Last Updated: 2026-02-02
-->

# Interface System Details & Examples

## 25) Interface System Details (Parity + Skins + Embeds)

**Skins**
- Win95: `react-95` styling + `react-rnd` draggable windows.
- Modern Chat: Tailwind + shadcn; sidebar sessions, message actions, file uploads, model selector, streaming chat.
- TUI: `blessed`/`ink` for CLI-first experience, with optional `blessed-contrib` charts.

**Implementation notes**
- Win95 skin uses `react-95` components and window manager patterns.
- Modern skin uses Tailwind + shadcn primitives with HSL tokens.
- TUI uses `blessed` or `ink` with shared command metadata.

**Theme Switching**
- CLI: `bitcore config set ui.theme win95|modern|tui`.
- Web: Settings panel selects theme via `ThemeProvider` with hot-reload CSS.

**Console Embedding Options**
1) Iframe embedding with postMessage bridge.
2) Module federation sharing `AgentContext`.
3) Shared backend with dual frontends (SSE/WS for events).

**Embedding tradeoffs**
- Iframe: fastest integration, separate auth/session; postMessage latency.
- Module federation: shared context, higher build coupling.
- Shared backend: clean API surface, tighter deployment coupling.

**BYOK Security Bridge**
- Recommended: secure proxy with encrypted payloads + session keypair; keys stored in memory only.

## 25.1) Interface Implementation Examples (Reference)

**Win95 chat window (retro skin)**
```jsx
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
				<input type="text" onKeyDown={onSend} />
			</WindowContent>
		</Window>
	);
}
```

**Modern chat message (clean skin)**
```jsx
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
						code({ inline, className, children, ...props }) {
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

**TUI launch (terminal skin)**
```javascript
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

## 25.2) Context Canvas (Semantic Flow Pattern)

**Purpose**: Visual context engineering surface for composing typed nodes and exporting structured context.

**Core behaviors**
- Node graph with typed nodes, edges as references (not execution order).
- Node fields support multi-format content (Markdown, JSON, YAML, XML).
- Export to JSON/YAML/Markdown/XML for downstream tools.
- BYOK keys stored in session storage with AES encryption; never persisted server-side.

**Nova surface mapping**
- Surface: `ContextCanvasSurface` (Phase 2 read-only, Phase 3 editable).
- Panels: node palette, inspector, export drawer, execution console.

## 25.3) Generative UI Artifacts (LibreChat Pattern)

**Artifacts**
- React/HTML/Mermaid artifact previews in a sandboxed iframe.
- Versioned artifact history with export/download.
- Safety pass: HTML sanitization + CSP + iframe isolation.

## 25.4) Code Interpreter Surface (LibreChat Pattern)

**Runtime**
- Sandboxed runtimes (python/node/go) with strict CPU/memory caps.
- File I/O via staged workspace; download artifacts via signed URLs.
- Session lifecycle tied to mission scope; auto-expire on idle.

## 38.2) Interface Design Patterns (Operational)

**Conversational UI**
- Three-column layout (sidebar, messages, metadata).
- Streaming token display, syntax-highlighted code blocks, collapsible tool outputs.
- Message actions: copy, edit/regenerate, fork branch, collapse/expand groups.
- Provider controls: model selector, temperature/top-p/max-tokens, system prompt override.
- Persistence: drafts in local storage, saved chats in DB, export JSON/Markdown.
- Rich text editor: block-based editing with AI actions (improve, shorten, expand, rephrase) and Markdown source view.

**Research Console**
- Tabbed navigation: canvas, API tester, knowledge browser, settings, logs.
- Graph canvas: node palette, drag-to-connect edges, progress overlays, mini-map.
- Event streaming with heartbeat and dedupe; supports reconnection with Last-Event-ID.
- Provider registry: base URL, auth headers, supported models, rate limits; surfaced in settings and stored in config.
- Module separation:
	- `graph-schema.js`: node/edge factories, validators.
	- `ontology.js`: taxonomy registry, cluster colors.
	- `prompting-engine.js`: provider calls, response parsing.
	- `execution-engine.js`: workflow runner, progress tracking.
	- `export-utils.js`: format converters (JSON/MD/YAML/XML).
	- `security.js`: key encryption, session lifecycle.

**Terminal File Manager**
- Three-pane layout (source, destination, preview) with Vim keybindings.
- Preview modes: code, rendered markdown, ASCII image, hex dump.
- Ops: copy/yank, paste, delete (confirm), rename, new file/dir.

**Context window management**
- Sliding window trim; LLM summarization when token pressure rises.
- Pin critical tool outputs as non-evictable.

**Secrets CLI**
- `secrets set`, `secrets list`, `secrets delete` with encrypted storage and runtime injection.

**A2A protocol**
- HTTP/JSON task endpoints with bearer auth; streamed results for peer agents.

**Event streaming**
- SSE `/api/events` with heartbeat and `Last-Event-ID` reconnect support.
- Webhook ingestion uses HMAC verification with 2-minute dedupe window.

## 38.2.1) Interface Embedding & BYOK Handoff

**Embedding options**
- Iframe embedding with postMessage events (`workflow:*`, `mission:*`).
- Module federation for shared `AgentContext` between UIs.
- Shared backend with dual frontends (SSE/WS) for unified telemetry.

**BYOK security bridge**
- Recommended: secure proxy with encrypted payloads and session keypair.
- Keys stored in memory only and never logged; optional 24-hour expiry.

## 40.4) Nova Feature Roadmap Expansion (Concept Signals)

**Phase 1: Foundational IDE shell**
- Unified chat/terminal tab; rich markdown rendering with code blocks.
- Visual file manager (VS Code-style explorer) with context menus.
- Integrated web browser tab for agent navigation (headless/visual).
- Multi-workspace support with sidebar switcher.
- Comprehensive settings view for keys, models, security, appearance.

**Phase 2: Core agentic architecture**
- Agent computer view (working dir, processes, shell history).
- Memory manager UI (short-term, long-term, procedural).
- Nested agent system with delegation workflows.
- Visual workflow builder (node graph).

**Phase 3: Knowledge & data management**
- Knowledge/vector DB UI and document ingestion workflow.
- Hot-directory ingestion service.

**Phase 4: Tooling & extensibility**
- Tooling backlog (HTTPS requests, webhooks, A2A protocol support).
- Plugin/extension system and ported legacy views.
