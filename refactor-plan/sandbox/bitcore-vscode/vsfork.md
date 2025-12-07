import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  File as FileIcon,
  Folder,
  Search,
  Settings,
  MessageSquare,
  Play,
  Cpu,
  Database,
  Server,
  ListChecks,
  Bot,
  FileText,
  Save,
  Plus,
  GitBranch,
  GitCommit,
  Wifi,
  ShieldCheck,
  Cpu as CpuIcon,
  Sparkles,
  PanelLeft,
  PanelTop,
  PanelRight,
  Grid3X3,
  LayoutDashboard,
  Terminal,
  ChevronRight,
  ChevronDown,
  X,
  ToyBrick,
  Layers,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

// ------------------------------------------------------------
// LIGHTWEIGHT VS-FORK WEB IDE GUI — FRONTEND ONLY
// Focus: GUI scaffolding for files, vectors, databases, terminals, tasks,
// chats, agents, MCP servers, instruments, computer-as-tool, and more.
// All functionality here is mock UI state. No backend. No persistence.
// ------------------------------------------------------------

// Utility: simple classnames join
const cx = (...a) => a.filter(Boolean).join(" ");

// Activity bar entries
const ACTIVITIES = [
  { id: "explorer", icon: <Folder size={18} />, label: "Explorer" },
  { id: "vectors", icon: <Layers size={18} />, label: "Vectors" },
  { id: "databases", icon: <Database size={18} />, label: "Databases" },
  { id: "terminals", icon: <Terminal size={18} />, label: "Terminals" },
  { id: "tasks", icon: <ListChecks size={18} />, label: "Tasks" },
  { id: "chats", icon: <MessageSquare size={18} />, label: "Chats" },
  { id: "agents", icon: <Bot size={18} />, label: "Agents" },
  { id: "instruments", icon: <ToyBrick size={18} />, label: "Instruments" },
  { id: "mcp", icon: <Server size={18} />, label: "MCP" },
  { id: "computer", icon: <CpuIcon size={18} />, label: "Computer" },
];

// Top menu model — menus are hidden until clicked
const MENUS = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "new-file", label: "New File", kbd: "Ctrl+N" },
      { id: "new-folder", label: "New Folder" },
      { id: "open", label: "Open…", kbd: "Ctrl+O" },
      { id: "save", label: "Save", kbd: "Ctrl+S" },
      { id: "save-all", label: "Save All" },
      { id: "close", label: "Close Editor" },
      { id: "recent", label: "Open Recent" },
      { id: "preferences", label: "Preferences" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "undo", label: "Undo", kbd: "Ctrl+Z" },
      { id: "redo", label: "Redo", kbd: "Ctrl+Y" },
      { id: "find", label: "Find", kbd: "Ctrl+F" },
      { id: "replace", label: "Replace", kbd: "Ctrl+H" },
      { id: "format", label: "Format Document" },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "toggle-left", label: "Toggle Left Pane" },
      { id: "toggle-right", label: "Toggle Right Pane" },
      { id: "toggle-bottom", label: "Toggle Bottom Pane" },
      { id: "zen", label: "Zen Mode" },
      { id: "palette", label: "Command Palette", kbd: "Ctrl+K" },
      { id: "layout-presets", label: "Layout Presets" },
    ],
  },
  {
    id: "go",
    label: "Go",
    items: [
      { id: "back", label: "Back" },
      { id: "forward", label: "Forward" },
      { id: "file-to-symbol", label: "File → Symbol" },
    ],
  },
  {
    id: "run",
    label: "Run",
    items: [
      { id: "run-task", label: "Run Task" },
      { id: "debug", label: "Debug" },
      { id: "profile", label: "Profile" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      { id: "open-chat", label: "Open Chat" },
      { id: "planner", label: "Planner / DAG Composer" },
      { id: "computer-tool", label: "Computer-as-Tool" },
      { id: "agents", label: "Agents" },
      { id: "prompts", label: "Prompt Library" },
      { id: "policies", label: "Policies" },
      { id: "mcp", label: "MCP Servers" },
      { id: "instruments", label: "Instruments" },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      { id: "vectors", label: "Vector Stores" },
      { id: "databases", label: "Databases" },
      { id: "etl", label: "Pipelines / ETL" },
      { id: "datasets", label: "Datasets" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "extensions", label: "Extensions" },
      { id: "keymap", label: "Keyboard Shortcuts" },
      { id: "themes", label: "Themes" },
      { id: "inspector", label: "UI Inspector" },
    ],
  },
  {
    id: "window",
    label: "Window",
    items: [
      { id: "split-left", label: "Split Left" },
      { id: "split-right", label: "Split Right" },
      { id: "split-down", label: "Split Down" },
      { id: "reset-layout", label: "Reset Layout" },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [
      { id: "docs", label: "Documentation" },
      { id: "shortcuts", label: "Shortcuts Reference" },
      { id: "about", label: "About" },
    ],
  },
];

// Sample resource trees
const SAMPLE_FILES = [
  {
    name: "workspace",
    folder: true,
    children: [
      { name: "README.md" },
      {
        name: "src",
        folder: true,
        children: [
          { name: "main.ts" },
          { name: "app.tsx" },
          { name: "routes.ts" },
        ],
      },
      {
        name: "public",
        folder: true,
        children: [{ name: "index.html" }, { name: "favicon.svg" }],
      },
      { name: "package.json" },
    ],
  },
];

const SAMPLE_VECTOR_STORES = [
  {
    name: "research-embeddings",
    collections: [
      { name: "papers", dim: 1536, size: 12043 },
      { name: "notes", dim: 1536, size: 987 },
    ],
  },
  {
    name: "code-index",
    collections: [
      { name: "symbols", dim: 3072, size: 45012 },
      { name: "snippets", dim: 1536, size: 6123 },
    ],
  },
];

const SAMPLE_DATABASES = [
  {
    name: "app-db (Postgres)",
    schemas: [
      { name: "public", tables: ["users", "projects", "runs", "events"] },
      { name: "ai", tables: ["prompts", "agents", "policies"] },
    ],
  },
  {
    name: "analytics (DuckDB)",
    schemas: [{ name: "main", tables: ["sessions", "metrics"] }],
  },
];

const SAMPLE_INSTRUMENTS = [
  { id: "clean-cache", label: "clean-cache", desc: "Remove temp files and caches", cmd: "scripts/clean-cache.sh" },
  { id: "bootstrap", label: "bootstrap", desc: "Install deps and prepare env", cmd: "scripts/bootstrap.sh" },
  { id: "lint", label: "lint", desc: "Run linter on project", cmd: "npm run lint" },
];

const SAMPLE_AGENTS = [
  { id: "code-assistant", name: "Code Assistant", role: "coding", status: "idle" },
  { id: "researcher", name: "Researcher", role: "retrieval+analysis", status: "idle" },
  { id: "ops", name: "Ops Runner", role: "tasks+scripts", status: "idle" },
];

const SAMPLE_MCP = [
  { id: "filesystem", name: "Filesystem Server", caps: ["fs.read", "fs.write", "walk"], status: "connected" },
  { id: "browser", name: "Browser Server", caps: ["http.get", "http.post"], status: "disconnected" },
  { id: "db", name: "DB Server", caps: ["sql.query", "sql.schema"], status: "connected" },
];

const SAMPLE_TASKS = [
  { id: "build", name: "Build", status: "ready" },
  { id: "test", name: "Test", status: "ready" },
  { id: "index", name: "Index Vectors", status: "paused" },
];

const SAMPLE_TERMINALS = [
  { id: "bash-1", title: "bash", content: "$ echo \"hello\"" },
  { id: "ai-runner", title: "ai-runner", content: "agent: idle" },
];

const SAMPLE_CHATS = [
  { id: "plan-1", title: "Planning", messages: [{ role: "system", text: "Plan tasks" }] },
  { id: "debug-1", title: "Debug", messages: [{ role: "system", text: "Fix bug" }] },
];

// ---------------------------
// Runtime smoke tests
// ---------------------------
function runSmokeTests() {
  const results = [];

  // Icons must be defined
  const iconSet = { PanelLeft, PanelTop, PanelRight, Grid3X3, LayoutDashboard, Terminal, Server };
  Object.entries(iconSet).forEach(([name, val]) => {
    results.push({ name: `icon:${name} defined`, pass: !!val });
  });

  // Activities config
  const ids = new Set();
  const uniqueIds = ACTIVITIES.every((a) => (ids.has(a.id) ? false : (ids.add(a.id), true)));
  results.push({ name: "activities unique ids", pass: uniqueIds });

  // Menus populated
  results.push({ name: "menus non-empty", pass: MENUS.length > 0 });
  results.push({ name: "each menu has items", pass: MENUS.every((m) => Array.isArray(m.items) && m.items.length > 0) });

  return results;
}

// Simple collapsible tree node
function TreeNode({ node, depth = 0, onOpenFile }) {
  const [open, setOpen] = useState(true);
  const isFolder = !!node.folder || Array.isArray(node.children);
  return (
    <div>
      <div
        className={cx(
          "flex items-center gap-1 cursor-pointer select-none rounded px-1 py-0.5 hover:bg-neutral-800",
          depth === 0 && "mt-1"
        )}
        onClick={() => (isFolder ? setOpen(!open) : onOpenFile?.(node.name))}
      >
        {isFolder ? (
          open ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <FileText size={14} />
        )}
        <span className="text-sm text-neutral-200 truncate">{node.name}</span>
      </div>
      {isFolder && open && (
        <div className="ml-4 border-l border-neutral-800 pl-2">
          {node.children?.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuBar({ onAction }) {
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className="flex items-center gap-2 px-2 h-9 bg-neutral-950 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <span className="text-neutral-300 text-sm font-semibold tracking-wide">VS Fork</span>
        <GitBranch size={14} className="text-neutral-500" />
        <span className="text-xs text-neutral-500">main</span>
      </div>

      <div className="flex items-center gap-1 ml-4">
        {MENUS.map((m) => (
          <div key={m.id} className="relative" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === m.id ? null : m.id); }}>
            <button className={cx("px-2 py-1 rounded text-sm text-neutral-300 hover:bg-neutral-800")}>{m.label}</button>
            <AnimatePresence>
              {openMenu === m.id && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute mt-1 min-w-[220px] z-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
                >
                  {m.items.map((it) => (
                    <button
                      key={it.id}
                      onClick={(e) => { e.stopPropagation(); onAction?.(it.id); setOpenMenu(null); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-left text-neutral-200 hover:bg-neutral-800"
                    >
                      <span>{it.label}</span>
                      {it.kbd && <span className="text-[10px] text-neutral-500">{it.kbd}</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1">
          <Search size={14} className="text-neutral-400" />
          <input placeholder="Search files, symbols, commands" className="bg-transparent text-sm outline-none placeholder-neutral-600 w-56" />
        </div>
        <button className="px-2 py-1 text-sm rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200" onClick={() => onAction?.("palette")}>⌘K</button>
        <Wifi size={16} className="text-neutral-500" />
        <ShieldCheck size={16} className="text-neutral-500" />
      </div>
    </div>
  );
}

function ActivityBar({ active, setActive }) {
  return (
    <div className="w-12 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-2 gap-2">
      {ACTIVITIES.map((a) => (
        <button
          key={a.id}
          title={a.label}
          onClick={() => setActive(a.id)}
          className={cx(
            "w-9 h-9 rounded-xl flex items-center justify-center hover:bg-neutral-800",
            active === a.id && "bg-neutral-800"
          )}
        >
          <span className="text-neutral-300">{a.icon}</span>
        </button>
      ))}
      <div className="mt-auto" />
      <button title="Settings" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-neutral-800">
        <Settings size={18} className="text-neutral-400" />
      </button>
    </div>
  );
}

function LeftPane({ active, onOpenFile }) {
  return (
    <div className="w-72 h-full bg-neutral-950 border-r border-neutral-800 p-2 overflow-auto">
      {active === "explorer" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-wider text-neutral-500">Explorer</div>
            <button className="p-1 rounded hover:bg-neutral-800"><Plus size={14} /></button>
          </div>
          {SAMPLE_FILES.map((n, i) => (
            <TreeNode key={i} node={{ ...n, folder: true }} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}

      {active === "vectors" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Vector Stores</div>
          <div className="space-y-2">
            {SAMPLE_VECTOR_STORES.map((s) => (
              <div key={s.name} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                <div className="flex items-center gap-2 text-neutral-200"><Layers size={14} />{s.name}</div>
                <div className="mt-2 text-xs text-neutral-400">Collections</div>
                <div className="mt-1 space-y-1">
                  {s.collections.map((c) => (
                    <div key={c.name} className="text-sm flex items-center justify-between rounded px-2 py-1 hover:bg-neutral-800">
                      <span>{c.name}</span>
                      <span className="text-xs text-neutral-500">dim {c.dim} • {c.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "databases" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Databases</div>
          <div className="space-y-2">
            {SAMPLE_DATABASES.map((db) => (
              <div key={db.name} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                <div className="flex items-center gap-2 text-neutral-200"><Database size={14} />{db.name}</div>
                {db.schemas.map((s) => (
                  <div key={s.name} className="mt-2">
                    <div className="text-xs text-neutral-400">schema.{s.name}</div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {s.tables.map((t) => (
                        <div key={t} className="text-sm rounded px-2 py-1 hover:bg-neutral-800">{t}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "instruments" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Instruments</div>
          <div className="space-y-2">
            {SAMPLE_INSTRUMENTS.map((ins) => (
              <div key={ins.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                <div className="flex items-center justify-between">
                  <div className="text-neutral-200 text-sm">{ins.label}</div>
                  <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Run</button>
                </div>
                <div className="text-xs text-neutral-500 mt-1">{ins.desc}</div>
                <div className="text-xs text-neutral-600 mt-1">{ins.cmd}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "mcp" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">MCP Servers</div>
          <div className="space-y-2">
            {SAMPLE_MCP.map((m) => (
              <div key={m.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                <div className="flex items-center justify-between text-sm text-neutral-200">
                  <div className="flex items-center gap-2"><Server size={14} />{m.name}</div>
                  <span className={cx("text-xs", m.status === "connected" ? "text-emerald-400" : "text-neutral-500")}>{m.status}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">{m.caps.join(", ")}</div>
                <div className="mt-2 flex gap-2">
                  <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Connect</button>
                  <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Inspect</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "agents" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Agents</div>
          <div className="space-y-2">
            {SAMPLE_AGENTS.map((a) => (
              <div key={a.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-200">{a.name}</div>
                  <div className="text-xs text-neutral-500">{a.role}</div>
                </div>
                <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Open</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "tasks" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Tasks</div>
          <div className="space-y-1">
            {SAMPLE_TASKS.map((t) => (
              <div key={t.id} className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 flex items-center justify-between">
                <div className="text-sm text-neutral-200">{t.name}</div>
                <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Run</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "terminals" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Terminal Sessions</div>
          <div className="space-y-1">
            {SAMPLE_TERMINALS.map((t) => (
              <div key={t.id} className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 flex items-center justify-between">
                <div className="text-sm text-neutral-200">{t.title}</div>
                <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Focus</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "chats" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Chat Threads</div>
          <div className="space-y-1">
            {SAMPLE_CHATS.map((c) => (
              <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 flex items-center justify-between">
                <div className="text-sm text-neutral-200">{c.title}</div>
                <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Open</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "computer" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Computer-as-Tool</div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 space-y-2">
            <div className="text-sm text-neutral-200 flex items-center gap-2"><Cpu size={14} /> System Controls</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
              <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-2">Screen • virtual</div>
              <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-2">Keyboard • captured</div>
              <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-2">Mouse • synthetic</div>
              <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-2">FS • sandbox</div>
            </div>
            <button className="w-full text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Request Control</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorTabs({ tabs, activeId, onSetActive, onClose }) {
  return (
    <div className="flex items-center h-9 bg-neutral-950 border-b border-neutral-800 overflow-auto">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={cx(
            "flex items-center gap-2 px-3 h-9 cursor-pointer border-r border-neutral-900",
            activeId === t.id ? "bg-neutral-900" : "hover:bg-neutral-900/60"
          )}
          onClick={() => onSetActive(t.id)}
        >
          <FileIcon size={14} className="text-neutral-400" />
          <span className="text-sm text-neutral-200">{t.title}</span>
          <button className="ml-1 rounded hover:bg-neutral-800" onClick={(e) => { e.stopPropagation(); onClose(t.id); }}>
            <X size={12} className="text-neutral-500" />
          </button>
        </div>
      ))}
    </div>
  );
}

function EditorSurface({ tab }) {
  if (!tab) return (
    <div className="flex-1 grid place-items-center text-neutral-500">Empty</div>
  );

  return (
    <div className="flex-1 grid grid-rows-[auto_1fr]">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-950 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-300 text-sm">
          <Sparkles size={16} /> Smart Tools: <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">Refactor</button><button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">Explain</button><button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">Test</button>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs flex items-center gap-1"><Save size={14} />Save</button>
          <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs flex items-center gap-1"><Play size={14} />Run</button>
        </div>
      </div>
      <div className="p-4 overflow-auto text-sm leading-relaxed text-neutral-200">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="text-xs mb-2 text-neutral-500">Editor • {tab.title}</div>
          <pre className="text-neutral-300 text-sm">
{`// This is a placeholder editor. Integrate Monaco or CodeMirror.
function greet(name) {
  return 'hello ' + name
}
`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function RightPane({ mode = "chat" }) {
  return (
    <div className="w-[22rem] min-w-[20rem] h-full bg-neutral-950 border-l border-neutral-800 grid grid-rows-[auto_1fr_auto]">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-neutral-500">AI</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">New Chat</button>
          <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">Prompt Library</button>
        </div>
      </div>
      <div className="overflow-auto p-3 space-y-3">
        <div className="text-xs text-neutral-500">Thread • Debug</div>
        <div className="space-y-2">
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-2 text-sm">system: Provide steps only.</div>
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-2 text-sm">user: Why does build fail?</div>
          <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-2 text-sm">assistant: Check tsconfig, then deps, then scripts.</div>
        </div>
      </div>
      <div className="p-2 border-t border-neutral-800">
        <div className="flex items-center gap-2">
          <input placeholder="Type a message or /tool" className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm outline-none" />
          <button className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm">Send</button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          <CpuIcon size={14} /> Computer access available • MCP: 2/3 connected
        </div>
      </div>
    </div>
  );
}

function BottomPane({ testResults = [] }) {
  const [tab, setTab] = useState("terminal");
  return (
    <div className="h-56 bg-neutral-950 border-t border-neutral-800 grid grid-rows-[auto_1fr]">
      <div className="flex items-center gap-2 h-8 border-b border-neutral-800 px-2">
        {[
          { id: "terminal", label: "Terminal" },
          { id: "problems", label: "Problems" },
          { id: "output", label: "Output" },
          { id: "tests", label: "Tests" },
          { id: "tasks", label: "Tasks" },
          { id: "ai-logs", label: "AI Logs" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cx("px-2 py-1 text-xs rounded", tab === t.id ? "bg-neutral-800" : "hover:bg-neutral-900")}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
          <ButtonIcon icon={<RefreshCw size={14} />} />
          <ButtonIcon icon={<SlidersHorizontal size={14} />} />
        </div>
      </div>
      <div className="overflow-auto p-2 text-sm">
        {tab === "terminal" && (
          <div className="font-mono rounded-xl bg-neutral-950 border border-neutral-800 p-2">
            <div className="text-xs text-neutral-500 mb-1">bash</div>
            <div className="leading-6">
              <div>$ npm run dev</div>
              <div>Starting dev server…</div>
              <div>Ready on http://localhost:5173</div>
            </div>
          </div>
        )}
        {tab === "problems" && <div className="text-neutral-400">No problems.</div>}
        {tab === "output" && <div className="text-neutral-400">Build output will appear here.</div>}
        {tab === "tests" && (
          <div className="space-y-1">
            {testResults.map((r, i) => (
              <div key={i} className={cx("rounded-lg border px-2 py-1", r.pass ? "border-emerald-900 bg-emerald-950/40 text-emerald-300" : "border-red-900 bg-red-950/40 text-red-300")}>{r.pass ? "PASS" : "FAIL"} — {r.name}</div>
            ))}
            {testResults.length === 0 && <div className="text-neutral-500">No tests executed.</div>}
          </div>
        )}
        {tab === "tasks" && (
          <div className="space-y-1">
            {SAMPLE_TASKS.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1">
                <div className="text-sm text-neutral-200">{t.name}</div>
                <button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Run</button>
              </div>
            ))}
          </div>
        )}
        {tab === "ai-logs" && (
          <div className="space-y-2">
            <div className="text-xs text-neutral-500">MCP: filesystem.read → OK</div>
            <div className="text-xs text-neutral-500">Agent[researcher]: plan → 4 steps</div>
            <div className="text-xs text-neutral-500">Instrument[lint]: executed</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ButtonIcon({ icon }) {
  return <button className="w-7 h-7 grid place-items-center rounded hover:bg-neutral-800 text-neutral-300">{icon}</button>;
}

function StatusBar() {
  return (
    <div className="h-8 bg-neutral-950 border-t border-neutral-800 px-2 flex items-center gap-3 text-xs text-neutral-400">
      <div className="flex items-center gap-1"><LayoutDashboard size={14} /> Spaces: 1</div>
      <div className="flex items-center gap-1"><GitCommit size={14} /> main*</div>
      <div className="flex items-center gap-1"><CpuIcon size={14} /> AI: ready</div>
      <div className="flex items-center gap-1"><Database size={14} /> DB: 2</div>
      <div className="flex items-center gap-1"><Layers size={14} /> Vectors: 2</div>
      <div className="ml-auto flex items-center gap-2">
        <LayoutButtons />
      </div>
    </div>
  );
}

function LayoutButtons() {
  return (
    <div className="flex items-center gap-1">
      <ButtonIcon icon={<PanelLeft size={14} />} />
      <ButtonIcon icon={<PanelTop size={14} />} />
      <ButtonIcon icon={<PanelRight size={14} />} />
      <ButtonIcon icon={<Grid3X3 size={14} />} />
    </div>
  );
}

function CommandPalette({ open, onClose, onRun, items }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())), [q, items]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open ? onClose() : null;
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0 grid place-items-start pt-24">
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="w-[720px] rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
                <Search size={16} className="text-neutral-500" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command" className="flex-1 bg-transparent outline-none text-sm" />
                <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300"><X size={16} /></button>
              </div>
              <div className="max-h-80 overflow-auto p-2">
                {filtered.map((i) => (
                  <button key={i.id} onClick={() => onRun(i.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-900">
                    <div className="text-sm text-neutral-200">{i.label}</div>
                    {i.desc && <div className="text-xs text-neutral-500">{i.desc}</div>}
                  </button>
                ))}
                {filtered.length === 0 && <div className="text-neutral-500 text-sm px-3 py-6">No results</div>}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function VSForkUI() {
  const [active, setActive] = useState("explorer");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [tabs, setTabs] = useState([{ id: "readme", title: "README.md" }]);
  const [activeTabId, setActiveTabId] = useState("readme");

  const [testResults, setTestResults] = useState([]);
  useEffect(() => {
    setTestResults(runSmokeTests());
  }, []);

  const runMenuAction = (id) => {
    if (id === "palette") setPaletteOpen(true);
    if (id === "toggle-left") setLeftOpen((v) => !v);
    if (id === "toggle-right") setRightOpen((v) => !v);
    if (id === "toggle-bottom") setBottomOpen((v) => !v);
    if (id === "new-file") openFile("untitled.txt");
    if (id === "open-chat") setActive("chats");
    if (id === "mcp") setActive("mcp");
    if (id === "instruments") setActive("instruments");
    if (id === "vectors") setActive("vectors");
    if (id === "databases") setActive("databases");
    if (id === "computer-tool") setActive("computer");
  };

  const openFile = (name) => {
    const id = name;
    setTabs((t) => (t.find((x) => x.id === id) ? t : [...t, { id, title: name }]));
    setActiveTabId(id);
  };

  const closeTab = (id) => {
    setTabs((t) => t.filter((x) => x.id !== id));
    if (activeTabId === id && tabs.length > 1) setActiveTabId(tabs[0].id);
  };

  const paletteItems = useMemo(
    () => [
      { id: "toggle-left", label: "Toggle Left Pane" },
      { id: "toggle-right", label: "Toggle Right Pane" },
      { id: "toggle-bottom", label: "Toggle Bottom Pane" },
      { id: "new-file", label: "New File" },
      { id: "open-chat", label: "Open Chat" },
      { id: "mcp", label: "Show MCP Servers" },
      { id: "instruments", label: "Show Instruments" },
      { id: "vectors", label: "Show Vector Stores" },
      { id: "databases", label: "Show Databases" },
      { id: "computer", label: "Computer-as-Tool" },
      { id: "split-left", label: "Split Left" },
      { id: "reset-layout", label: "Reset Layout" },
    ],
    []
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto] bg-neutral-950 text-neutral-100">
      {/* Top Menu Bar */}
      <MenuBar onAction={runMenuAction} />

      {/* Main layout */}
      <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[1fr_auto]">
        {/* Activity Bar */}
        <ActivityBar active={active} setActive={setActive} />

        {/* Left Pane */}
        {leftOpen ? (
          <LeftPane active={active} onOpenFile={openFile} />
        ) : (
          <div />
        )}

        {/* Right Pane */}
        {rightOpen ? (
          <RightPane />
        ) : (
          <div className="w-0" />
        )}

        {/* Center Editor Column spans between left and right */}
        <div className="col-start-2 col-end-3 row-start-1 row-end-2 grid grid-rows-[auto_1fr] border-x border-neutral-800">
          <EditorTabs tabs={tabs} activeId={activeTabId} onSetActive={setActiveTabId} onClose={closeTab} />
          <EditorSurface tab={activeTab} />
        </div>

        {/* Bottom Pane spans all columns */}
        {bottomOpen ? (
          <div className="col-span-3 row-start-2 row-end-3"><BottomPane testResults={testResults} /></div>
        ) : (
          <div />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRun={(id) => {
          runMenuAction(id);
          setPaletteOpen(false);
        }}
        items={paletteItems}
      />
    </div>
  );
}
