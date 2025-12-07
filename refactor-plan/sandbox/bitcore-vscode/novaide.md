import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {
  Command,
  Palette,
  FileText,
  TerminalSquare,
  Bot,
  Search,
  Settings,
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  FolderTree,
  Database,
  HardDrive,
  Cloud,
  GitBranch,
  Network,
  Cpu,
  Layers,
  Wand2,
  Rocket,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  Save,
  Share2,
  ListChecks,
  BookOpen,
  RefreshCw,
  Bell,
  PanelRightClose,
  PanelRightOpen,
  Filter,
  Link as LinkIcon,
  Plug,
  PlaySquare,
  Boxes,
  FilePlus,
  SplitSquareHorizontal,
  SplitSquareVertical,
  BookMarked,
  ClipboardList,
  Brackets,
  EllipsisVertical,
  MoreHorizontal
} from "lucide-react";

/**
 * Nova IDE — Lightweight VS‑Code style GUI with pragmatic agentic features.
 * Focus: GUI only. No backends. Pure client layout + mocked state.
 * Stack: React + Tailwind + react-resizable-panels + lucide-react.
 */

// ---------- Primitives ----------
const IconBtn = ({ title, children, onClick, active }: { title: string; children: React.ReactNode; onClick?: () => void; active?: boolean; }) => (
  <button title={title} onClick={onClick} className={`p-2 rounded-xl hover:bg-zinc-800/60 transition ${active ? "bg-zinc-800/80" : ""}`}>
    {children}
  </button>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
    {children}
  </span>
);

const SectionTitle = ({ icon, label, right }: { icon: React.ReactNode; label: string; right?: React.ReactNode; }) => (
  <div className="flex items-center justify-between text-xs text-zinc-400 px-2 py-1.5">
    <div className="flex items-center gap-2">{icon}<span className="uppercase tracking-wide">{label}</span></div>
    {right}
  </div>
);

// Lightweight dropdown with keyboard trap omitted for brevity
function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative select-none" onMouseLeave={() => setOpen(false)}>
      <button onMouseEnter={() => setOpen(true)} className="px-2 py-1 rounded-md text-sm hover:bg-zinc-800/40">
        {label}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[220px] rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-2xl p-1">
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, kbd, label }: { icon?: React.ReactNode; kbd?: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-900/60 cursor-default">
      <div className="flex items-center gap-2">{icon}<span className="text-sm">{label}</span></div>
      {kbd && <span className="text-[10px] text-zinc-500">{kbd}</span>}
    </div>
  );
}

const Divider = () => <div className="my-1 h-px bg-zinc-800/80" />;

const TreeItem = ({ name, depth = 0, children, icon, openByDefault }: { name: string; depth?: number; children?: React.ReactNode; icon?: React.ReactNode; openByDefault?: boolean; }) => {
  const [open, setOpen] = useState(!!openByDefault);
  const isLeaf = !children;
  return (
    <div className="text-sm">
      <div className={`flex items-center gap-1.5 pl-${Math.min(depth * 3, 12)} py-1 hover:bg-zinc-800/50 cursor-pointer rounded-md`} onClick={() => !isLeaf && setOpen(!open)}>
        {isLeaf ? <span className="w-4" /> : open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
        {icon}<span className="text-zinc-200 truncate">{name}</span>
      </div>
      {open && children && <div className="ml-4">{children}</div>}
    </div>
  );
};

// ---------- Mock Data ----------
const files = [
  { name: "app", icon: <FolderTree className="w-4 h-4 text-zinc-300" />, children: [
    { name: "App.tsx", icon: <FileText className="w-4 h-4 text-indigo-300" /> },
    { name: "main.tsx", icon: <FileText className="w-4 h-4 text-indigo-300" /> },
    { name: "index.html", icon: <FileText className="w-4 h-4 text-emerald-300" /> }
  ]},
  { name: "agents", icon: <FolderTree className="w-4 h-4 text-zinc-300" />, children: [
    { name: "refactor.mjs", icon: <Wand2 className="w-4 h-4 text-pink-300" /> },
    { name: "test-fix.mjs", icon: <Wand2 className="w-4 h-4 text-pink-300" /> },
    { name: "db-sync.mjs", icon: <Wand2 className="w-4 h-4 text-pink-300" /> }
  ]},
  { name: "instruments", icon: <FolderTree className="w-4 h-4 text-zinc-300" />, children: [
    { name: "img:optimize", icon: <PlaySquare className="w-4 h-4 text-amber-300" /> },
    { name: "code:lint-fix", icon: <PlaySquare className="w-4 h-4 text-amber-300" /> },
    { name: "docs:gen", icon: <PlaySquare className="w-4 h-4 text-amber-300" /> }
  ]}
];

const mcpServers = [
  { name: "GitHub MCP", status: "connected", icon: <GitBranch className="w-4 h-4" /> },
  { name: "Databricks MCP", status: "connected", icon: <Database className="w-4 h-4" /> },
  { name: "Local Tools MCP", status: "idle", icon: <Plug className="w-4 h-4" /> }
];

const vectorSpaces = [
  { name: "project-code", provider: "FAISS", size: "182K" },
  { name: "docs", provider: "pgvector", size: "31K" },
  { name: "assets", provider: "Qdrant", size: "9K" }
];

const databases = [
  { name: "appdb", type: "SQLite", size: "12MB" },
  { name: "analytics", type: "DuckDB", size: "240MB" }
];

// ---------- App ----------
export default function NovaIDE() {
  const [rightPaneVisible, setRightPaneVisible] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"terminal" | "tasks" | "chat" | "agents">("terminal");
  const [tabs, setTabs] = useState([
    { id: "t1", name: "App.tsx", dirty: true },
    { id: "t2", name: "README.md" },
    { id: "t3", name: "index.html" }
  ]);
  const [activeTab, setActiveTab] = useState("t1");

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar with Hidden Menus */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <IconBtn title="Command Palette" onClick={() => setPaletteOpen(true)}>
            <Command className="w-5 h-5" />
          </IconBtn>
          <div className="text-sm font-semibold tracking-wide">Nova IDE</div>
          <Tag>beta</Tag>

          {/* Menubar */}
          <div className="ml-2 hidden md:flex items-center gap-1">
            <Menu label="File">
              <MenuItem icon={<FilePlus className="w-4 h-4" />} label="New File" kbd="⌘N" />
              <MenuItem icon={<FolderTree className="w-4 h-4" />} label="New Workspace" />
              <MenuItem icon={<Upload className="w-4 h-4" />} label="Import" />
              <MenuItem icon={<Download className="w-4 h-4" />} label="Export" />
              <Divider />
              <MenuItem icon={<Save className="w-4 h-4" />} label="Save" kbd="⌘S" />
              <MenuItem icon={<Share2 className="w-4 h-4" />} label="Share Snapshot" />
            </Menu>
            <Menu label="Edit">
              <MenuItem label="Undo" kbd="⌘Z" />
              <MenuItem label="Redo" kbd="⇧⌘Z" />
              <Divider />
              <MenuItem label="Find in File" kbd="⌘F" />
              <MenuItem label="Replace" kbd="⌥⌘F" />
            </Menu>
            <Menu label="View">
              <MenuItem label="Toggle Right Panel" />
              <MenuItem label="Split Editor Horizontally" />
              <MenuItem label="Split Editor Vertically" />
            </Menu>
            <Menu label="Go">
              <MenuItem label="File…" kbd="⌘P" />
              <MenuItem label="Symbol…" kbd="⇧⌘O" />
              <MenuItem label="Definition" kbd="F12" />
            </Menu>
            <Menu label="Run">
              <MenuItem icon={<Play className="w-4 h-4" />} label="Run" kbd="⌘R" />
              <MenuItem icon={<Pause className="w-4 h-4" />} label="Pause" />
              <MenuItem icon={<Square className="w-4 h-4" />} label="Stop" />
            </Menu>
            <Menu label="AI">
              <MenuItem icon={<Bot className="w-4 h-4" />} label="Open Code Pilot" />
              <MenuItem icon={<Wand2 className="w-4 h-4" />} label="Suggest Refactor" />
              <Divider />
              <MenuItem icon={<Layers className="w-4 h-4" />} label="Vectors: Re-embed Workspace" />
              <MenuItem icon={<Database className="w-4 h-4" />} label="DB: Generate Types" />
              <MenuItem icon={<Plug className="w-4 h-4" />} label="MCP: Tools & Servers" />
            </Menu>
            <Menu label="Tools">
              <MenuItem label="Instruments Console" />
              <MenuItem label="Task Runner" />
              <MenuItem label="Terminal Profiles" />
            </Menu>
            <Menu label="Window">
              <MenuItem label="Zen Mode" />
              <MenuItem label="Toggle Status Bar" />
            </Menu>
            <Menu label="Help">
              <MenuItem label="Docs" />
              <MenuItem label="Shortcuts" />
              <MenuItem label="About" />
            </Menu>
          </div>

          <div className="ml-3 hidden sm:flex items-center gap-1 text-xs text-zinc-400">
            <Cpu className="w-4 h-4" /> Agent runtime <span className="text-emerald-400">ready</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2 text-zinc-500" />
            <input placeholder="Search files, symbols, vectors, DB, MCP…" className="pl-8 pr-3 py-1.5 bg-zinc-800/70 rounded-lg text-sm w-80 md:w-96 outline-none focus:ring-2 ring-indigo-500/40" />
          </div>
          <IconBtn title="Notifications"><Bell className="w-5 h-5" /></IconBtn>
          <IconBtn title="Settings"><Settings className="w-5 h-5" /></IconBtn>
        </div>
      </div>

      {/* Body */}
      <PanelGroup direction="horizontal" className="h-[calc(100vh-48px)]">
        {/* Left Sidebar */}
        <Panel defaultSize={18} minSize={12} maxSize={26} className="border-r border-zinc-800/70">
          <div className="h-full grid grid-rows-[auto,1fr,auto]">
            <div className="flex items-center gap-1 p-2 border-b border-zinc-800/70">
              <IconBtn title="Explorer" active><FolderTree className="w-5 h-5" /></IconBtn>
              <IconBtn title="Search"><Search className="w-5 h-5" /></IconBtn>
              <IconBtn title="Vectors"><Layers className="w-5 h-5" /></IconBtn>
              <IconBtn title="Databases"><Database className="w-5 h-5" /></IconBtn>
              <IconBtn title="MCP"><Network className="w-5 h-5" /></IconBtn>
            </div>

            <div className="overflow-auto p-2">
              <SectionTitle icon={<FolderTree className="w-4 h-4" />} label="Workspace" right={<IconBtn title="New File"><FilePlus className="w-4 h-4" /></IconBtn>} />
              {files.map((f) => (
                <TreeItem key={f.name} name={f.name} icon={f.icon} openByDefault>
                  {f.children?.map((c) => (
                    <TreeItem key={c.name} name={c.name} depth={1} icon={c.icon} />
                  ))}
                </TreeItem>
              ))}

              <SectionTitle icon={<Layers className="w-4 h-4" />} label="Vector Spaces" />
              <div className="space-y-1">
                {vectorSpaces.map((v) => (
                  <div key={v.name} className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-300" />
                      <div className="text-sm"><div>{v.name}</div><div className="text-xs text-zinc-500">{v.provider} · {v.size}</div></div>
                    </div>
                    <IconBtn title="Embed/Sync"><Upload className="w-4 h-4" /></IconBtn>
                  </div>
                ))}
              </div>

              <SectionTitle icon={<Database className="w-4 h-4" />} label="Databases" />
              <div className="space-y-1">
                {databases.map((d) => (
                  <div key={d.name} className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-300" />
                      <div className="text-sm"><div>{d.name}</div><div className="text-xs text-zinc-500">{d.type} · {d.size}</div></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconBtn title="Query"><Play className="w-4 h-4" /></IconBtn>
                      <IconBtn title="Export"><Download className="w-4 h-4" /></IconBtn>
                    </div>
                  </div>
                ))}
              </div>

              <SectionTitle icon={<Network className="w-4 h-4" />} label="MCP Servers" />
              <div className="space-y-1">
                {mcpServers.map((m) => (
                  <div key={m.name} className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="text-zinc-300">{m.icon}</div>
                      <div className="text-sm"><div>{m.name}</div><div className="text-xs text-zinc-500">{m.status}</div></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconBtn title="Docs"><BookOpen className="w-4 h-4" /></IconBtn>
                      <IconBtn title="Reconnect"><RefreshCw className="w-4 h-4" /></IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-10 border-t border-zinc-800/70 flex items-center justify-between px-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2"><HardDrive className="w-4 h-4" /><span>workspace</span></div>
              <div className="flex items-center gap-2"><Cloud className="w-4 h-4" /> Synced</div>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-zinc-800/70 hover:bg-zinc-700" />

        {/* Center + Right */}
        <Panel minSize={35} defaultSize={rightPaneVisible ? 58 : 78}>
          <PanelGroup direction="vertical" className="h-full">
            {/* Editors */}
            <Panel defaultSize={68} minSize={40} className="border-b border-zinc-800/70">
              <div className="h-full grid grid-rows-[auto,1fr]">
                <div className="h-10 flex items-center gap-1 px-2 border-b border-zinc-800/60 bg-zinc-900/40">
                  {tabs.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`h-7 px-3 rounded-lg text-sm flex items-center gap-2 border ${activeTab === t.id ? "bg-zinc-800/70 border-zinc-700" : "bg-transparent border-transparent hover:bg-zinc-800/40"}`}>
                      <FileText className="w-4 h-4" /> {t.name}
                      {t.dirty && <span className="ml-1 text-amber-300">●</span>}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <IconBtn title="Split Horizontal"><SplitSquareHorizontal className="w-5 h-5" /></IconBtn>
                  <IconBtn title="Split Vertical"><SplitSquareVertical className="w-5 h-5" /></IconBtn>
                  <IconBtn title="Save"><Save className="w-5 h-5" /></IconBtn>
                  <IconBtn title="Share"><Share2 className="w-5 h-5" /></IconBtn>
                </div>

                <PanelGroup direction="horizontal" className="h-full">
                  <Panel minSize={30} defaultSize={rightPaneVisible ? 65 : 100}>
                    <div className="h-full w-full grid grid-rows-[auto,1fr]">
                      <div className="text-xs text-zinc-400 px-3 py-1.5 border-b border-zinc-800/60">app <ChevronRight className="inline w-3 h-3" /> App.tsx</div>
                      <div className="h-full font-mono text-[13px] leading-6 p-4 overflow-auto"><EditorMock /></div>
                    </div>
                  </Panel>
                  {rightPaneVisible && <PanelResizeHandle className="w-1 bg-zinc-800/70 hover:bg-zinc-700" />}
                  {rightPaneVisible && (
                    <Panel minSize={20} defaultSize={35} className="border-l border-zinc-800/70">
                      <RightAssist />
                    </Panel>
                  )}
                </PanelGroup>
              </div>
            </Panel>

            {/* Bottom Panel */}
            <Panel minSize={18} defaultSize={32}>
              <div className="h-full grid grid-rows-[auto,1fr] bg-zinc-950">
                <div className="h-9 flex items-center gap-2 px-2 border-b border-zinc-800/60 bg-zinc-900/30">
                  {(["terminal","tasks","chat","agents"] as const).map((key) => (
                    <button key={key} className={`px-2 py-1 rounded-md text-sm ${bottomTab === key ? "bg-zinc-800/70" : "hover:bg-zinc-800/40"}`} onClick={() => setBottomTab(key)}>
                      {key === "terminal" && <TerminalSquare className="inline w-4 h-4 mr-1" />} 
                      {key === "tasks" && <ListChecks className="inline w-4 h-4 mr-1" />} 
                      {key === "chat" && <MessageSquare className="inline w-4 h-4 mr-1" />} 
                      {key === "agents" && <Bot className="inline w-4 h-4 mr-1" />} 
                      {key.charAt(0).toUpperCase()+key.slice(1)}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <IconBtn title="Run"><Play className="w-4 h-4" /></IconBtn>
                  <IconBtn title="Pause"><Pause className="w-4 h-4" /></IconBtn>
                  <IconBtn title="Stop"><Square className="w-4 h-4" /></IconBtn>
                  <IconBtn title="Clear"><Trash2 className="w-4 h-4" /></IconBtn>
                </div>

                <div className="h-full overflow-hidden">
                  {bottomTab === "terminal" && <TerminalMock />}
                  {bottomTab === "tasks" && <TasksMock />}
                  {bottomTab === "chat" && <ChatMock />}
                  {bottomTab === "agents" && <AgentsMock />}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Right Rail Toggle */}
        <PanelResizeHandle className="w-1 bg-zinc-800/70 hover:bg-zinc-700" />
        <Panel defaultSize={rightPaneVisible ? 24 : 0} minSize={0} maxSize={28} className={`${rightPaneVisible ? "" : "hidden"} border-l border-zinc-800/70`}>
          <div className="h-full grid grid-rows-[auto,1fr,auto]">
            <div className="h-10 flex items-center justify-between px-2 border-b border-zinc-800/70">
              <div className="text-sm font-medium flex items-center gap-2"><Bot className="w-4 h-4" /> Computer-as-Tool</div>
              <IconBtn title="Collapse" onClick={() => setRightPaneVisible(false)}><PanelRightClose className="w-4 h-4" /></IconBtn>
            </div>
            <div className="overflow-auto p-2">
              <SectionTitle icon={<Wand2 className="w-4 h-4" />} label="Instruments" right={<IconBtn title="New Instrument"><Plus className="w-4 h-4" /></IconBtn>} />
              <div className="grid grid-cols-2 gap-2">
                {[{ name: "img:optimize", desc: "Compress assets" }, { name: "code:lint-fix", desc: "ESLint + Prettier" }, { name: "db:sync", desc: "Migrate + seed" }, { name: "kb:update", desc: "Re-embed docs" }].map((i) => (
                  <button key={i.name} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-left hover:bg-zinc-900">
                    <div className="text-sm font-medium flex items-center gap-2"><PlaySquare className="w-4 h-4 text-amber-300" /> {i.name}</div>
                    <div className="text-xs text-zinc-400">{i.desc}</div>
                  </button>
                ))}
              </div>

              <SectionTitle icon={<MessageSquare className="w-4 h-4" />} label="Agent Chats" right={<Tag>multi-tool</Tag>} />
              <div className="space-y-2">
                {["Code Pilot", "Doc Sage", "Ops Runner"].map((c) => (
                  <div key={c} className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <div className="text-sm font-medium">{c}</div>
                    <div className="text-xs text-zinc-400">Memory, tools, MCP enabled</div>
                  </div>
                ))}
              </div>

              <SectionTitle icon={<Boxes className="w-4 h-4" />} label="Models & Tools" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">GPT‑x • code, reasoning</div>
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">Claude‑x • long context</div>
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">Local • quick ops</div>
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">Vision • assets</div>
              </div>
            </div>
            <div className="h-10 border-t border-zinc-800/70 flex items-center justify-between px-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Toolchain wired</div>
              <IconBtn title="Expand center" onClick={() => setRightPaneVisible(false)}><PanelRightClose className="w-4 h-4" /></IconBtn>
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Status Bar */}
      <div className="h-6 text-[11px] px-2 border-t border-zinc-800/70 bg-zinc-900/60 flex items-center gap-3">
        <div className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5" /> main</div>
        <div className="flex items-center gap-2"><Brackets className="w-3.5 h-3.5" /> TS React</div>
        <div className="flex items-center gap-2"><Cloud className="w-3.5 h-3.5" /> synced</div>
        <div className="ml-auto flex items-center gap-2"><Filter className="w-3.5 h-3.5" /> problems: 3</div>
      </div>

      {paletteOpen && <PaletteModal onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

// ---------- Editor Mock ----------
function EditorMock() {
  const code = `import { useState } from "react";

export function Greeter({ name }: { name: string }) {
  const [count, setCount] = useState(0)
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Hello, {name}</h1>
      <button onClick={() => setCount(c => c + 1)} className="mt-2 px-2 py-1 rounded-md bg-indigo-600/80 hover:bg-indigo-600">Clicks: {count}</button>
    </div>
  )
}
`;
  return (
    <pre className="bg-gradient-to-b from-zinc-950 to-zinc-900 rounded-xl border border-zinc-800/80 p-3"><code>{code}</code></pre>
  );
}

// ---------- Right Assist Pane ----------
function RightAssist() {
  return (
    <div className="h-full grid grid-rows-[auto,auto,1fr]">
      <div className="p-2 border-b border-zinc-800/70">
        <div className="text-sm font-medium">Context</div>
        <div className="text-xs text-zinc-400">Symbols • Tests • References</div>
      </div>
      <div className="p-2 border-b border-zinc-800/70">
        <div className="flex items-center gap-2 text-xs"><Tag>TypeScript</Tag><Tag>React</Tag><Tag>Jest</Tag></div>
      </div>
      <div className="overflow-auto p-2 space-y-2">
        <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-xs text-zinc-400 mb-1">AI Suggestions</div>
          <ul className="text-sm list-disc ml-5 space-y-1">
            <li>Convert Greeter to server component where possible</li>
            <li>Extract UI primitives to /ui</li>
            <li>Add tests for count increment</li>
          </ul>
        </div>
        <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-xs text-zinc-400 mb-1">References</div>
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2"><BookMarked className="w-4 h-4" /> Greeter.spec.tsx</div>
            <div className="flex items-center gap-2"><BookMarked className="w-4 h-4" /> types.ts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Terminal Mock ----------
function TerminalMock() {
  const lines = [
    "$ pnpm dev",
    "Vite vX.X.X  ready in 123 ms",
    "local:   http://localhost:5173",
    "network: http://10.0.0.10:5173",
    "",
    "✔ lint  0 problems",
    "✔ tests  98 passed",
    "⚠ build  3 warnings"
  ];
  return (
    <div className="h-full font-mono text-[12px] p-2 bg-black text-zinc-200 overflow-auto">
      {lines.map((l, i) => (<div key={i} className="leading-6">{l}</div>))}
    </div>
  );
}

// ---------- Tasks Mock ----------
function TasksMock() {
  const items = [
    { id: 1, title: "Fix unit test snapshot", status: "queued" },
    { id: 2, title: "Refactor App.tsx", status: "running" },
    { id: 3, title: "Optimize images", status: "done" }
  ];
  return (
    <div className="h-full overflow-auto p-2">
      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead className="text-zinc-400"><tr><th className="text-left px-2">Task</th><th className="text-left px-2">Status</th><th className="px-2">Actions</th></tr></thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="bg-zinc-900/60 border border-zinc-800/80">
              <td className="px-2 py-1">{t.title}</td>
              <td className="px-2 py-1 text-zinc-400">{t.status}</td>
              <td className="px-2 py-1">
                <div className="flex items-center gap-1 justify-end"><IconBtn title="Run"><Play className="w-4 h-4" /></IconBtn><IconBtn title="Stop"><Square className="w-4 h-4" /></IconBtn></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Chat Mock ----------
function ChatMock() {
  return (
    <div className="h-full grid grid-rows-[1fr,auto]">
      <div className="overflow-auto p-2 space-y-2">
        <div className="max-w-[80%] p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="text-xs text-zinc-400">You</div>
          <div className="text-sm">Generate tests for Greeter</div>
        </div>
        <div className="max-w-[80%] ml-auto p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60">
          <div className="text-xs text-indigo-300">Code Pilot</div>
          <div className="text-sm">Added 2 unit tests. Use Agents tab to run.</div>
        </div>
      </div>
      <div className="h-10 border-t border-zinc-800/70 flex items-center gap-2 px-2">
        <input className="flex-1 bg-zinc-900/60 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-indigo-500/40" placeholder="Message agent…" />
        <button className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-sm">Send</button>
      </div>
    </div>
  );
}

// ---------- Agents Mock ----------
function AgentsMock() {
  const rows = [
    { name: "Refactor", tools: ["search", "edit", "test"], mode: "auto" },
    { name: "Doc Sage", tools: ["read", "embed", "cite"], mode: "assist" },
    { name: "Ops Runner", tools: ["shell", "fs", "db"], mode: "auto" }
  ];
  return (
    <div className="h-full p-2 overflow-auto">
      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead className="text-zinc-400"><tr><th className="text-left px-2">Agent</th><th className="text-left px-2">Tools</th><th className="text-left px-2">Mode</th><th className="px-2">Actions</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="bg-zinc-900/60 border border-zinc-800/80">
              <td className="px-2 py-1">{r.name}</td>
              <td className="px-2 py-1 text-zinc-400">{r.tools.join(", ")}</td>
              <td className="px-2 py-1 text-zinc-400">{r.mode}</td>
              <td className="px-2 py-1">
                <div className="flex items-center gap-1 justify-end">
                  <IconBtn title="Run"><Play className="w-4 h-4" /></IconBtn>
                  <IconBtn title="Stop"><Square className="w-4 h-4" /></IconBtn>
                  <IconBtn title="Configure"><Settings className="w-4 h-4" /></IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Command Palette ----------
function PaletteModal({ onClose }: { onClose: () => void }) {
  const groups = [
    { name: "Files", items: [
      { icon: <FilePlus className="w-4 h-4" />, label: "New file" },
      { icon: <FolderTree className="w-4 h-4" />, label: "Reveal in explorer" }
    ]},
    { name: "Instruments", items: [
      { icon: <PlaySquare className="w-4 h-4" />, label: "Run code:lint-fix" },
      { icon: <PlaySquare className="w-4 h-4" />, label: "Run img:optimize" }
    ]},
    { name: "Agents", items: [
      { icon: <Bot className="w-4 h-4" />, label: "Open Code Pilot" },
      { icon: <Bot className="w-4 h-4" />, label: "Open Ops Runner" }
    ]}
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <input autoFocus placeholder="Type a command or search…" className="w-full pl-9 pr-3 py-3 bg-zinc-900/60 outline-none" />
        </div>
        <div className="max-h-72 overflow-auto p-2">
          {groups.map((g) => (
            <div key={g.name} className="mb-2">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500 px-2 mb-1">{g.name}</div>
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer">
                  <div className="text-zinc-300">{it.icon}</div>
                  <div className="text-sm">{it.label}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="h-9 text-[11px] text-zinc-500 border-t border-zinc-800/80 flex items-center justify-between px-3">
          <div className="flex items-center gap-3"><span>⌘K open</span><span>⌘P files</span><span>⌘. instruments</span></div>
          <button onClick={onClose} className="px-2 py-1 rounded-md bg-zinc-800/70 hover:bg-zinc-800">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
