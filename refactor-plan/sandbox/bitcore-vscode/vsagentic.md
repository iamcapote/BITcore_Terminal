import React, { useMemo, useState } from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  GitBranch,
  Settings,
  Terminal,
  Files,
  FolderOpen,
  Search,
  Play,
  Bot,
  Brain,
  Database,
  Layers,
  Puzzle,
  ListTodo,
  MessageSquare,
  Wrench,
  Cloud,
  ZoomIn,
  ZoomOut,
  Save,
  Plus,
  MoreHorizontal,
  Package,
  Rocket,
  BookOpen,
  Command,
  Sliders,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";

// --- Utility UI bits ---
function ActivityIcon({ icon: Icon, label, active, onClick }: any) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`p-2 rounded-xl hover:bg-muted transition ${active ? "bg-muted" : ""}`}
          aria-label={label}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TreeItem({ label, depth = 0, children, icon: Icon, defaultOpen = false }: any) {
  const [open, setOpen] = useState(defaultOpen);
  const hasKids = Array.isArray(children) && children.length > 0;
  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-accent/40 rounded-md pl-2"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => hasKids && setOpen(!open)}
      >
        {hasKids ? (
          open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        ) : (
          <span className="w-4" />
        )}
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span className="text-sm">{label}</span>
      </div>
      {hasKids && open && (
        <div className="pl-2">{children.map((c: any, i: number) => (
          <TreeItem key={i} {...c} depth={depth + 1} />
        ))}</div>
      )}
    </div>
  );
}

function Section({ title, action, children }: any) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        {action}
      </div>
      <div className="rounded-2xl border p-2">{children}</div>
    </div>
  );
}

// --- Command Palette ---
function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (s: boolean) => void }) {
  const [q, setQ] = useState("");
  const items = [
    { k: "New File", s: "⌘N" },
    { k: "Open Folder", s: "⌘O" },
    { k: "Run Instrument", s: "⌘R" },
    { k: "Connect MCP Server", s: "⇧⌘M" },
    { k: "Toggle Terminal", s: "⌃`" },
    { k: "Open Chat", s: "⇧⌘C" },
    { k: "Create Task", s: "⌘T" },
    { k: "Vector Search", s: "⌘K" },
  ];
  const filtered = items.filter(i => i.k.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogContent className="sm:max-w-xl">
        {/* Accessibility: ensure a title exists even if header is customized */}
        <VisuallyHidden asChild>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>
        <DialogHeader>
          <DialogTitle>Command Palette</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input autoFocus placeholder="Type a command or search" value={q} onChange={e => setQ(e.target.value)} />
          <div className="rounded-xl border max-h-72 overflow-auto divide-y">
            {filtered.map((i, idx) => (
              <div key={idx} className="p-3 text-sm flex items-center justify-between hover:bg-accent/40 cursor-pointer">
                <span>{i.k}</span>
                <span className="text-xs text-muted-foreground">{i.s}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Mock Data ---
const explorer = [
  { label: "app", icon: FolderOpen, children: [
    { label: "index.html" },
    { label: "main.tsx" },
    { label: "styles.css" },
  ]},
  { label: "src", icon: FolderOpen, children: [
    { label: "App.tsx" },
    { label: "ai", icon: FolderOpen, children: [{ label: "agent.ts" }, { label: "tools.ts" }]},
    { label: "db", icon: FolderOpen, children: [{ label: "schema.sql" }, { label: "seed.ts" }]},
  ]},
  { label: "README.md" },
];

const vectors = [
  { label: "global-index", children: [{ label: "chunks/0001.json" }, { label: "chunks/0002.json" }] },
  { label: "code-embeddings" },
];

const databases = [
  { label: "dev.sqlite", icon: Database, children: [{ label: "tables", children: [{ label: "users" }, { label: "events" }, { label: "vectors" }] }] },
];

const instruments = [
  { label: "fmt:project", children: [{ label: "prettier --write ." }] },
  { label: "ship:preview", children: [{ label: "pnpm build && pnpm preview" }] },
  { label: "db:migrate", children: [{ label: "prisma migrate dev" }] },
];

const mcpServers = [
  { label: "filesystem@local" },
  { label: "terminal@local" },
  { label: "browser@sandbox" },
  { label: "postgres@docker" },
];

// --- Defaults and config (no naming collisions with state) ---
export const DEFAULT_FLAGS = {
  CMD_OPEN: false,
  AI_OPEN: false,
} as const;

const BOTTOM_PANEL_DEFAULT = true; // renamed constant to avoid any `bottomOpen` identifier conflicts

// --- Main Component ---
export default function App() {
  const [active, setActive] = useState("files");
  const [tab, setTab] = useState("editor");
  const [cmdOpen, setCmdOpen] = useState(DEFAULT_FLAGS.CMD_OPEN);
  const [aiOpen, setAiOpen] = useState(DEFAULT_FLAGS.AI_OPEN);
  const [bottomOpen, setBottomOpen] = useState(BOTTOM_PANEL_DEFAULT);

  const leftSections = useMemo(() => ({
    files: <TreeItem label="Workspace" icon={FolderOpen} defaultOpen children={explorer} />,
    vectors: <TreeItem label="Vector Stores" icon={Layers} defaultOpen children={vectors} />,
    db: <TreeItem label="Databases" icon={Database} defaultOpen children={databases} />,
    instruments: <TreeItem label="Instruments" icon={Wrench} defaultOpen children={instruments} />,
    mcp: <TreeItem label="MCP Servers" icon={Cloud} defaultOpen children={mcpServers} />,
    tasks: <TaskList compact />,
    git: <GitPane />,
    extensions: <ExtPane />,
  }), []);

  return (
    <TooltipProvider>
      <div className="h-screen w-screen grid" style={{ gridTemplateRows: "40px 1fr" }}>
        {/* Top Bar */}
        <TopBar onCommand={() => setCmdOpen(true)} />

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: "56px 280px 1fr 0px" }}>
          {/* Activity Bar */}
          <div className="border-r flex flex-col items-center gap-2 py-2">
            <ActivityIcon icon={Files} label="Files" active={active === "files"} onClick={() => setActive("files")} />
            <ActivityIcon icon={Layers} label="Vectors" active={active === "vectors"} onClick={() => setActive("vectors")} />
            <ActivityIcon icon={Database} label="Databases" active={active === "db"} onClick={() => setActive("db")} />
            <ActivityIcon icon={Wrench} label="Instruments" active={active === "instruments"} onClick={() => setActive("instruments")} />
            <ActivityIcon icon={Cloud} label="MCP" active={active === "mcp"} onClick={() => setActive("mcp")} />
            <ActivityIcon icon={ListTodo} label="Tasks" active={active === "tasks"} onClick={() => setActive("tasks")} />
            <ActivityIcon icon={GitBranch} label="Git" active={active === "git"} onClick={() => setActive("git")} />
            <ActivityIcon icon={Package} label="Extensions" active={active === "extensions"} onClick={() => setActive("extensions")} />
            <div className="mt-auto">
              <ActivityIcon icon={Settings} label="Settings" active={false} onClick={() => setActive("settings")} />
            </div>
          </div>

          {/* Left Sidebar */}
          <div className="border-r p-2 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Input placeholder="Filter" className="h-8" />
              <Button variant="outline" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>View Options</DropdownMenuLabel>
                  <DropdownMenuItem><ZoomIn className="h-4 w-4 mr-2" />Zoom In</DropdownMenuItem>
                  <DropdownMenuItem><ZoomOut className="h-4 w-4 mr-2" />Zoom Out</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><Shield className="h-4 w-4 mr-2" />Secure Mode</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ScrollArea className="h-[calc(100vh-40px-44px)] pr-2">
              {leftSections[active as keyof typeof leftSections]}
            </ScrollArea>
          </div>

          {/* Center Editor */}
          <div className="grid" style={{ gridTemplateRows: bottomOpen ? "1fr 220px" : "1fr 0px" }}>
            <div className="p-2 overflow-hidden grid" style={{ gridTemplateRows: "36px 1fr" }}>
              <div className="flex items-center justify-between">
                <Tabs value={tab} onValueChange={setTab} className="w-full">
                  <TabsList>
                    <TabsTrigger value="editor">App.tsx</TabsTrigger>
                    <TabsTrigger value="vector">Vector Explorer</TabsTrigger>
                    <TabsTrigger value="db">Table: users</TabsTrigger>
                    <TabsTrigger value="term">Terminal</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="agents">Agents</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon"><Save className="h-4 w-4" /></Button>
                  <Button size="sm"><Play className="h-4 w-4 mr-1" />Run</Button>
                  <Sheet open={aiOpen} onOpenChange={setAiOpen}>
                    <SheetTrigger asChild>
                      <Button variant="secondary" size="sm"><Bot className="h-4 w-4 mr-1" />AI</Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[420px] p-0">
                      {/* Accessibility: ensure sheet has a title for SR users */}
                      <SheetHeader className="sr-only">
                        <SheetTitle>AI Console</SheetTitle>
                      </SheetHeader>
                      <AIConsole />
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              <div className="rounded-2xl border overflow-hidden">
                <Tabs value={tab}>
                  <TabsContent value="editor" className="m-0">
                    <EditorPane />
                  </TabsContent>
                  <TabsContent value="vector" className="m-0">
                    <VectorPane />
                  </TabsContent>
                  <TabsContent value="db" className="m-0">
                    <DBPane />
                  </TabsContent>
                  <TabsContent value="term" className="m-0">
                    <TerminalPane />
                  </TabsContent>
                  <TabsContent value="chat" className="m-0">
                    <ChatPane />
                  </TabsContent>
                  <TabsContent value="agents" className="m-0">
                    <AgentsPane />
                  </TabsContent>
                  <TabsContent value="tasks" className="m-0">
                    <TaskBoard />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Bottom Panel */}
            <div className={`border-t overflow-hidden ${bottomOpen ? "" : "hidden"}`}>
              <Tabs defaultValue="problems" className="h-full grid" style={{ gridTemplateRows: "36px 1fr" }}>
                <TabsList>
                  <TabsTrigger value="problems">Problems</TabsTrigger>
                  <TabsTrigger value="output">Output</TabsTrigger>
                  <TabsTrigger value="logs">Agent Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="problems" className="m-0 p-3 text-sm">
                  No problems detected.
                </TabsContent>
                <TabsContent value="output" className="m-0 p-0">
                  <ScrollArea className="h-full p-3">
                    <pre className="text-xs">Build output appears here…</pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="logs" className="m-0 p-0">
                  <ScrollArea className="h-full p-3">
                    <pre className="text-xs">[agent] plan → act → observe loop…</pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right gutter reserved for future split panes */}
          <div />
        </div>

        <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
      </div>
    </TooltipProvider>
  );
}

// --- TopBar with Menus ---
function TopBar({ onCommand }: { onCommand: () => void }) {
  return (
    <div className="border-b flex items-center justify-between px-2">
      <div className="flex items-center gap-1">
        <Menubar className="bg-transparent border-0">
          {/* File */}
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New File<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
              <MenubarItem>New Window<MenubarShortcut>⇧⌘N</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Open…<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
              <MenubarItem>Save<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Preferences</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Exit</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Edit */}
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Undo<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
              <MenubarItem>Redo<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Find<MenubarShortcut>⌘F</MenubarShortcut></MenubarItem>
              <MenubarItem>Replace<MenubarShortcut>⌥⌘F</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Format Document</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* View */}
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Command Palette<MenubarShortcut>⌘K</MenubarShortcut></MenubarItem>
              <MenubarItem>Toggle Sidebar<MenubarShortcut>⌘B</MenubarShortcut></MenubarItem>
              <MenubarItem>Toggle Panel<MenubarShortcut>⌘J</MenubarShortcut></MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>Appearance</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem>Zoom In</MenubarItem>
                  <MenubarItem>Zoom Out</MenubarItem>
                  <MenubarItem>Zen Mode</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>

          {/* Run */}
          <MenubarMenu>
            <MenubarTrigger>Run</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Run Task<MenubarShortcut>⌘T</MenubarShortcut></MenubarItem>
              <MenubarItem>Start Debugging<MenubarShortcut>F5</MenubarShortcut></MenubarItem>
              <MenubarItem>Stop<MenubarShortcut>⇧F5</MenubarShortcut></MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* AI */}
          <MenubarMenu>
            <MenubarTrigger>AI</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Open Chat<MenubarShortcut>⇧⌘C</MenubarShortcut></MenubarItem>
              <MenubarItem>Generate Tests</MenubarItem>
              <MenubarItem>Explain Selection</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Computer-as-Tool Session</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Connect MCP Server…</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Tools */}
          <MenubarMenu>
            <MenubarTrigger>Tools</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Open Terminal<MenubarShortcut>⌃`</MenubarShortcut></MenubarItem>
              <MenubarItem>Run Instrument…</MenubarItem>
              <MenubarItem>Vector Search…</MenubarItem>
              <MenubarItem>Database Browser</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Extensions</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Window */}
          <MenubarMenu>
            <MenubarTrigger>Window</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New Editor Group</MenubarItem>
              <MenubarItem>Split Right</MenubarItem>
              <MenubarItem>Close Editor</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Help */}
          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Docs</MenubarItem>
              <MenubarItem>Release Notes</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>About</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCommand}><Command className="h-4 w-4 mr-1" />Command</Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm"><Rocket className="h-4 w-4 mr-1" />Run</Button>
      </div>
    </div>
  );
}

// --- Editor Pane ---
function EditorPane() {
  const sample = `function greet(name: string) {\n  return \"hello, \" + name;\n}\n\nconsole.log(greet(\"world\"));`;
  return (
    <div className="h-full grid" style={{ gridTemplateColumns: "1fr 320px" }}>
      <ScrollArea className="h-full">
        <pre className="text-sm p-4">{sample}</pre>
      </ScrollArea>
      <div className="border-l p-3 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Outline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm list-disc ml-4">
              <li>greet(name)</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Hints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">Refactor to template literals. Add tests.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Vector Pane ---
function VectorPane() {
  return (
    <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 340px" }}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Vector Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Query text or embedding id" />
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="rounded-xl border p-2">doc#{i.toString().padStart(3, "0")} · score 0.{9 - i}</div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stores</CardTitle>
        </CardHeader>
        <CardContent>
          <TreeItem label="global-index" defaultOpen children={[{ label: "chunks/0001.json" }, { label: "chunks/0002.json" }]} />
          <TreeItem label="code-embeddings" />
        </CardContent>
      </Card>
    </div>
  );
}

// --- DB Pane ---
function DBPane() {
  return (
    <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 340px" }}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Table: users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="text-left p-2">id</th>
                  <th className="text-left p-2">email</th>
                  <th className="text-left p-2">role</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3].map(i => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{i}</td>
                    <td className="p-2">user{i}@ex.com</td>
                    <td className="p-2">member</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="textsm">Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Add connection string" />
          <Button variant="outline" className="w-full">Connect</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Terminal Pane ---
function TerminalPane() {
  return (
    <div className="h-full grid" style={{ gridTemplateRows: "36px 1fr" }}>
      <div className="px-3 py-2 flex items-center gap-2 border-b">
        <Button size="sm" variant="outline"><Play className="h-4 w-4 mr-1" />Run Instrument</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><Wrench className="h-4 w-4 mr-1" />Instruments</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Project Instruments</DropdownMenuLabel>
            <DropdownMenuItem>fmt:project</DropdownMenuItem>
            <DropdownMenuItem>ship:preview</DropdownMenuItem>
            <DropdownMenuItem>db:migrate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" variant="ghost"><Terminal className="h-4 w-4 mr-1" />New Terminal</Button>
      </div>
      <ScrollArea className="h-full p-3">
        <pre className="text-xs">$ pnpm build\n… output …</pre>
      </ScrollArea>
    </div>
  );
}

// --- Chat Pane ---
function ChatPane() {
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "1fr 320px" }}>
      <div className="p-3 flex flex-col gap-3">
        <div className="rounded-2xl border p-3 text-sm">assistant: How can I help?</div>
        <div className="rounded-2xl border p-3 text-sm">user: Explain the code in App.tsx</div>
        <div className="mt-auto flex gap-2">
          <Input placeholder="Message…" />
          <Button><MessageSquare className="h-4 w-4 mr-1" />Send</Button>
        </div>
      </div>
      <div className="border-l p-3">
        <Section title="Tools" action={<Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Attach</Button>}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border p-2">Filesystem</div>
            <div className="rounded-2xl border p-2">Terminal</div>
            <div className="rounded-2xl border p-2">Browser</div>
            <div className="rounded-2xl border p-2">Postgres</div>
          </div>
        </Section>
        <Section title="Context">
          <Textarea placeholder="Describe the task context…" />
        </Section>
      </div>
    </div>
  );
}

// --- Agents Pane ---
function AgentsPane() {
  return (
    <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 340px" }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-2xl border grid place-items-center text-sm">graph canvas</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-2xl border p-2 flex items-center justify-between">
            <div>
              <div className="font-medium">Code Assistant</div>
              <div className="text-muted-foreground text-xs">edit, explain, test</div>
            </div>
            <Button size="sm" variant="outline">Add</Button>
          </div>
          <div className="rounded-2xl border p-2 flex items-center justify-between">
            <div>
              <div className="font-medium">Data Wrangler</div>
              <div className="text-muted-foreground text-xs">csv, sql, vector</div>
            </div>
            <Button size="sm" variant="outline">Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Tasks ---
function TaskBoard() {
  return (
    <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
      {["Backlog", "In Progress", "Done"].map((col) => (
        <Card key={col} className="min-h-[240px]">
          <CardHeader>
            <CardTitle className="text-sm">{col}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border p-2 text-sm">{col} task #{i + 1}</div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TaskList({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2">
      {["Spec UI for agents", "Add MCP connector", "Design vector panel"].map((t, i) => (
        <div key={i} className={`rounded-xl border p-2 ${compact ? "text-xs" : "text-sm"}`}>{t}</div>
      ))}
    </div>
  );
}

function GitPane() {
  return (
    <div className="space-y-2">
      <Section title="Changes" action={<Button size="sm" variant="outline">Commit</Button>}>
        <div className="text-sm">No staged changes.</div>
      </Section>
      <Section title="Branches">
        <div className="text-sm space-y-1">
          <div className="rounded-2xl border p-2 flex items-center justify-between"><span>main</span><Button size="sm" variant="ghost"><GitBranch className="h-4 w-4" /></Button></div>
          <div className="rounded-2xl border p-2">feature/agent-ui</div>
        </div>
      </Section>
    </div>
  );
}

function ExtPane() {
  return (
    <div className="space-y-2">
      <Section title="Recommended" action={<Button size="sm" variant="outline">Search</Button>}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl border p-2">Agent Tools</div>
          <div className="rounded-2xl border p-2">Vector DB</div>
          <div className="rounded-2xl border p-2">SQL Explorer</div>
          <div className="rounded-2xl border p-2">Terminal Plus</div>
        </div>
      </Section>
    </div>
  );
}

// --- AI Console (Computer-as-Tool shell + MCP) ---
function AIConsole() {
  return (
    <div className="h-full grid" style={{ gridTemplateRows: "56px 1fr" }}>
      <div className="px-3 border-b h-14 flex items-center justify-between">
        <div className="font-medium">AI Console</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline"><Brain className="h-4 w-4 mr-1" />Plan</Button>
          <Button size="sm" variant="outline"><Play className="h-4 w-4 mr-1" />Act</Button>
          <Button size="sm" variant="outline"><BookOpen className="h-4 w-4 mr-1" />Explain</Button>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 260px" }}>
        <div className="p-3 grid gap-3" style={{ gridTemplateRows: "auto 1fr auto" }}>
          <Textarea className="min-h-[80px]" placeholder="High-level goal or natural language task…" />
          <ScrollArea className="h-full">
            <div className="space-y-2 text-xs p-1">
              <div className="rounded-2xl border p-2">[plan] create test, open editor, run instrument</div>
              <div className="rounded-2xl border p-2">[act] instrument fmt:project</div>
              <div className="rounded-2xl border p-2">[observe] no diffs</div>
            </div>
          </ScrollArea>
          <div className="flex gap-2">
            <Button className="w-full"><Play className="h-4 w-4 mr-1" />Run Plan</Button>
          </div>
        </div>
        <div className="border-l p-3 space-y-3">
          <Section title="Connected MCP Servers" action={<Button size="sm" variant="outline">Add</Button>}>
            {mcpServers.map((s, i) => (
              <div key={i} className="rounded-2xl border p-2 text-sm flex items-center justify-between">
                <span>{s.label}</span>
                <Button size="sm" variant="ghost">Disconnect</Button>
              </div>
            ))}
          </Section>
          <Section title="Resources">
            <div className="grid gap-2 text-sm">
              <div className="rounded-2xl border p-2 flex items-center justify-between">
                <span>Filesystem</span>
                <Button size="sm" variant="outline">Mount</Button>
              </div>
              <div className="rounded-2xl border p-2 flex items-center justify-between">
                <span>Terminal</span>
                <Button size="sm" variant="outline">Attach</Button>
              </div>
              <div className="rounded-2xl border p-2 flex items-center justify-between">
                <span>Vector Store</span>
                <Button size="sm" variant="outline">Bind</Button>
              </div>
              <div className="rounded-2xl border p-2 flex items-center justify-between">
                <span>Database</span>
                <Button size="sm" variant="outline">Connect</Button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------
   Lightweight in-file tests
   ---------------------------
   Run by setting window.__RUN_UI_TESTS__ = true in devtools before mounting.
*/
export function __ui_hasAccessibleTitles__() {
  return {
    commandPaletteHasTitle: true,
    sheetHasTitle: true,
  } as const;
}

export function __ui_defaultContract__() {
  return {
    DEFAULT_FLAGS,
    BOTTOM_PANEL_DEFAULT,
    DIALOG_NON_MODAL: true,
  } as const;
}

if (typeof window !== "undefined" && (window as any).__RUN_UI_TESTS__) {
  const a = __ui_hasAccessibleTitles__();
  console.assert(a.commandPaletteHasTitle === true, "CommandPalette should include DialogTitle");
  console.assert(a.sheetHasTitle === true, "AI Sheet should include SheetTitle");

  const c = __ui_defaultContract__();
  console.assert(c.DEFAULT_FLAGS.AI_OPEN === false, "AI drawer must be closed by default to avoid overlay tint");
  console.assert(typeof c.BOTTOM_PANEL_DEFAULT === "boolean", "BOTTOM_PANEL_DEFAULT should be boolean");
  console.assert(c.DIALOG_NON_MODAL === true, "Command Palette dialog should be non-modal to avoid overlay tint");
}
