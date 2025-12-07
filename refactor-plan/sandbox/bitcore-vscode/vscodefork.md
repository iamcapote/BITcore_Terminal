import React, {useMemo, useState, useEffect, useRef} from "react";
import { motion } from "framer-motion";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarCheckboxItem, MenubarSeparator, MenubarSub, MenubarSubContent, MenubarRadioGroup, MenubarRadioItem, MenubarLabel, MenubarShortcut } from "@/components/ui/menubar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// icons
import {
  Rocket, Save, Play, Pause, Square, TerminalSquare, Bot, Workflow,
  GitBranch, Search, SlidersHorizontal, Cpu, HardDrive, Database, Box, Zap,
  FolderTree, FileCode2, FilePlus2, File, Upload, Download, Settings,
  ChevronDown, ChevronUp, ChevronRight, Plus, Trash2, RefreshCw, Share2,
  MessageSquare, MessagesSquare, MonitorCog, ShieldCheck, Cloud, Plug,
  Link2, Wrench, Command, KeySquare, LayoutTemplate, Sparkles, ScanSearch,
  PanelLeft, PanelRight, PanelBottom, PanelTop, Eye, Pencil, ClipboardList,
  AlarmClock, CalendarClock, TimerReset, Brackets, Binary, Spline, ListChecks,
  Code2, Boxes, Layers3, BrainCircuit, Castle, FileStack, Rows2, PlayCircle,
  Circle, CirclePause, CircleStop, BookOpenText, HelpCircle, Info,
} from "lucide-react";

// ---------- Utility ----------
const Kbd = ({children}:{children:React.ReactNode}) => (
  <span className="inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-wide">
    {children}
  </span>
);

// ---------- Mock data ----------
const mockFiles = [
  { id: "1", name: "app.tsx", path: "/src/app.tsx" },
  { id: "2", name: "agent.ts", path: "/src/agents/agent.ts" },
  { id: "3", name: "db.ts", path: "/src/server/db.ts" },
  { id: "4", name: "styles.css", path: "/src/styles.css" },
];

const mockInstruments = [
  { id: "i1", name: "format", desc: "Run Prettier + ESLint", cmd: "pnpm fmt" },
  { id: "i2", name: "embed", desc: "Generate vector embeddings", cmd: "pnpm embed" },
  { id: "i3", name: "migrate", desc: "DB migrate with drizzle", cmd: "pnpm db:migrate" },
];

const mockVectors = [
  { id: "vx1", index: "docs-prod", dim: 1536, backend: "Pinecone", size: 125_433, status: "Ready" },
  { id: "vx2", index: "images", dim: 1024, backend: "FAISS", size: 39_110, status: "Building" },
];

const mockDBs = [
  { id: "db1", name: "app", engine: "Postgres", url: "postgres://prod", tables: 28 },
  { id: "db2", name: "analytics", engine: "DuckDB", url: "file:analytics.duckdb", tables: 12 },
];

const mockMCP = [
  { id: "m1", name: "filesystem", status: "online", endpoints: ["ls","readFile","writeFile"] },
  { id: "m2", name: "browser", status: "online", endpoints: ["navigate","extract","screenshot"] },
  { id: "m3", name: "code-exec", status: "offline", endpoints: ["run","kill","status"] },
];

// ---------- Menubar (hidden features grouped) ----------
function AppMenubar({onCommand}:{onCommand:(cmd:string)=>void}) {
  return (
    <Menubar className="h-10 border-b rounded-none">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={()=>onCommand("new-file")}>
            New File <MenubarShortcut><Kbd>⌘</Kbd>+<Kbd>N</Kbd></MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={()=>onCommand("new-folder")}>New Folder</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem onClick={()=>onCommand("open")}>Open…</MenubarItem>
          <MenubarItem onClick={()=>onCommand("save")}>Save <MenubarShortcut><Kbd>⌘</Kbd>+<Kbd>S</Kbd></MenubarShortcut></MenubarItem>
          <MenubarItem onClick={()=>onCommand("save-all")}>Save All</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem onClick={()=>onCommand("import-instrument")}>Import Instrument</MenubarItem>
          <MenubarItem onClick={()=>onCommand("export-workspace")}>Export Workspace</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Undo <MenubarShortcut><Kbd>⌘</Kbd>+<Kbd>Z</Kbd></MenubarShortcut></MenubarItem>
          <MenubarItem>Redo <MenubarShortcut><Kbd>⇧</Kbd>+<Kbd>⌘</Kbd>+<Kbd>Z</Kbd></MenubarShortcut></MenubarItem>
          <MenubarSeparator/>
          <MenubarItem>Find <MenubarShortcut><Kbd>⌘</Kbd>+<Kbd>F</Kbd></MenubarShortcut></MenubarItem>
          <MenubarItem>Replace</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem checked>Side Bar</MenubarCheckboxItem>
          <MenubarCheckboxItem checked>Bottom Panel</MenubarCheckboxItem>
          <MenubarCheckboxItem>Right Panel</MenubarCheckboxItem>
          <MenubarSeparator/>
          <MenubarSub>
            <MenubarSubTrigger>Layouts</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Code + Chat</MenubarItem>
              <MenubarItem>Docs + Terminal</MenubarItem>
              <MenubarItem>Debugging</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Run</MenubarTrigger>
        <MenubarContent>
          <MenubarItem><PlayCircle className="mr-2 h-4 w-4"/>Run Task</MenubarItem>
          <MenubarItem><Pause className="mr-2 h-4 w-4"/>Pause</MenubarItem>
          <MenubarItem><Square className="mr-2 h-4 w-4"/>Stop</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem><TerminalSquare className="mr-2 h-4 w-4"/>Open Terminal</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>AI</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Model</MenubarLabel>
          <MenubarRadioGroup value="gpt-5">
            <MenubarRadioItem value="gpt-5">GPT‑5</MenubarRadioItem>
            <MenubarRadioItem value="o3">o3</MenubarRadioItem>
            <MenubarRadioItem value="sonnet">Claude Sonnet</MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator/>
          <MenubarItem>Open Chat</MenubarItem>
          <MenubarItem>New Agent…</MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Autonomy</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Manual</MenubarItem>
              <MenubarItem>Approve Steps</MenubarItem>
              <MenubarItem>Auto (guarded)</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator/>
          <MenubarItem>Computer‑as‑Tool Controls…</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Tools</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Instruments Library</MenubarItem>
          <MenubarItem>MCP Servers</MenubarItem>
          <MenubarItem>Vector Manager</MenubarItem>
          <MenubarItem>Database Manager</MenubarItem>
          <MenubarItem>Task Orchestrator</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem>Extensions</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Window</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Toggle Zen Mode</MenubarItem>
          <MenubarItem>Focus Chat</MenubarItem>
          <MenubarItem>Focus Code</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Documentation</MenubarItem>
          <MenubarItem>Shortcuts</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem>About</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

// ---------- Sidebar ----------
function Sidebar({section, setSection}:{section:string, setSection:(s:string)=>void}){
  const Item = ({id, icon:Icon, label, count}:{id:string, icon:any, label:string, count?:number}) => (
    <button onClick={()=>setSection(id)} className={`w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-accent ${section===id?"bg-accent": ""}`}>
      <Icon className="w-4 h-4"/>
      <span className="flex-1 text-left">{label}</span>
      {count!=null && <Badge variant="secondary">{count}</Badge>}
    </button>
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <Input placeholder="Search files, vectors, DB…" className="h-9"/>
          <Button variant="ghost" size="icon" title="Command Palette"><Command className="w-4 h-4"/></Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="mt-2 space-y-1">
          <Item id="explorer" icon={FolderTree} label="Explorer" count={mockFiles.length}/>
          <Item id="vectors" icon={Spline} label="Vectors" count={mockVectors.length}/>
          <Item id="databases" icon={Database} label="Databases" count={mockDBs.length}/>
          <Item id="agents" icon={BrainCircuit} label="Agents" />
          <Item id="instruments" icon={Wrench} label="Instruments" count={mockInstruments.length}/>
          <Item id="mcp" icon={Plug} label="MCP Servers" count={mockMCP.length}/>
          <Item id="tasks" icon={ListChecks} label="Tasks" />
          <Item id="terminal" icon={TerminalSquare} label="Terminal" />
          <Item id="chat" icon={MessagesSquare} label="Chat" />
        </div>
        <Separator className="my-3"/>
        <div className="px-1 text-xs text-muted-foreground">
          <p className="mb-2 font-medium">Workspace</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="justify-start gap-2"><GitBranch className="w-4 h-4"/>main</Button>
            <Button variant="secondary" className="justify-start gap-2"><Cloud className="w-4 h-4"/>remote</Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------- Explorer ----------
function Explorer(){
  return (
    <div className="h-full">
      <p className="text-xs uppercase tracking-widest text-muted-foreground px-2 pb-2">Files</p>
      <ScrollArea className="h-[calc(100%-1.5rem)] px-2">
        <ul className="space-y-1">
          {mockFiles.map(f=> (
            <li key={f.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent">
              <FileCode2 className="w-4 h-4"/><span>{f.name}</span>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

// ---------- Vectors Manager ----------
function VectorManager(){
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2"><Spline className="w-4 h-4"/>Vector Stores</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-2.5rem)]">
        <div className="flex items-center gap-2 mb-3">
          <Button size="sm"><Plus className="w-4 h-4 mr-1"/>New Index</Button>
          <Button size="sm" variant="secondary"><RefreshCw className="w-4 h-4 mr-1"/>Refresh</Button>
          <div className="ml-auto flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-40"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backends</SelectItem>
                <SelectItem value="pinecone">Pinecone</SelectItem>
                <SelectItem value="faiss">FAISS</SelectItem>
                <SelectItem value="chroma">Chroma</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-40"/>
          </div>
        </div>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Index</TableHead>
                <TableHead>Backend</TableHead>
                <TableHead>Dim</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockVectors.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.index}</TableCell>
                  <TableCell>{v.backend}</TableCell>
                  <TableCell>{v.dim}</TableCell>
                  <TableCell>{v.size.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={v.status==="Ready"?"default":"secondary"}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Inspect</DropdownMenuItem>
                        <DropdownMenuItem>Search Similar</DropdownMenuItem>
                        <DropdownMenuItem>Rebuild</DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Database Manager ----------
function DatabaseManager(){
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4"/>Databases</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-2.5rem)] flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Button size="sm"><Plus className="w-4 h-4 mr-1"/>Connect</Button>
          <Button size="sm" variant="secondary"><RefreshCw className="w-4 h-4 mr-1"/>Refresh</Button>
          <div className="ml-auto flex items-center gap-2">
            <Select defaultValue="postgres">
              <SelectTrigger className="h-8 w-40"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">Postgres</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="duckdb">DuckDB</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Filter" className="h-8 w-40"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <Card className="col-span-1 overflow-hidden">
            <CardHeader className="py-2"><CardTitle className="text-xs">Connections</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Tables</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDBs.map(db => (
                    <TableRow key={db.id}>
                      <TableCell className="font-medium">{db.name}</TableCell>
                      <TableCell>{db.engine}</TableCell>
                      <TableCell>{db.tables}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="py-2"><CardTitle className="text-xs">Query</CardTitle></CardHeader>
            <CardContent>
              <Textarea className="min-h-[120px]" placeholder="SELECT * FROM table LIMIT 50;"/>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm"><Play className="w-4 h-4 mr-1"/>Run</Button>
                <Button size="sm" variant="secondary"><Save className="w-4 h-4 mr-1"/>Save</Button>
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <Cpu className="w-3 h-3"/> Est. cost: 3 RU
                </div>
              </div>
              <Separator className="my-3"/>
              <div className="border rounded-md p-3 text-sm">Result preview here</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Instruments (scripts as reusable terminal commands) ----------
function Instruments(){
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4"/>Instruments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockInstruments.map(i => (
          <div key={i.id} className="flex items-center gap-2 border rounded-lg p-2">
            <div className="flex-1">
              <div className="text-sm font-medium">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.desc}</div>
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded">{i.cmd}</code>
            <Button size="sm"><Play className="w-4 h-4 mr-1"/>Run</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary"><ChevronDown className="w-4 h-4"/></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Dry‑run</DropdownMenuItem>
                <DropdownMenuItem>Open in Terminal</DropdownMenuItem>
                <DropdownMenuItem>Schedule…</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <Button variant="outline" className="w-full"><Plus className="w-4 h-4 mr-1"/>New Instrument</Button>
      </CardContent>
    </Card>
  );
}

// ---------- MCP Servers ----------
function MCPServers(){
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2"><Plug className="w-4 h-4"/>MCP Servers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Button size="sm"><Plus className="w-4 h-4 mr-1"/>Add Server</Button>
          <Button size="sm" variant="secondary"><RefreshCw className="w-4 h-4 mr-1"/>Ping All</Button>
          <div className="ml-auto text-xs text-muted-foreground">Model Context Protocol endpoints registry</div>
        </div>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Endpoints</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockMCP.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant={s.status==="online"?"default":"secondary"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.endpoints.map(e => <Badge key={e} variant="outline">{e}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Inspect</DropdownMenuItem>
                        <DropdownMenuItem>Authorize…</DropdownMenuItem>
                        <DropdownMenuItem>Attach to Agent…</DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Agents ----------
function Agents(){
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {[1,2,3].map(i => (
        <Card key={i} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4"/>Agent #{i}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Model</Label>
              <Select defaultValue="gpt-5">
                <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5">GPT‑5</SelectItem>
                  <SelectItem value="o3">o3</SelectItem>
                  <SelectItem value="sonnet">Claude Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Autonomy</Label>
              <Slider defaultValue={[40]} className="w-48"/>
              <Badge variant="outline">Guarded</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Tools</Label>
              <div className="flex flex-wrap gap-1">
                {["fs","browser","code","vectors","db"].map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">MCP</Label>
              <div className="flex gap-2 items-center">
                <Badge>filesystem</Badge><Badge variant="outline">browser</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-24">Memory</Label>
              <Switch defaultChecked/>
            </div>
            <div className="flex gap-2">
              <Button size="sm"><Play className="w-4 h-4 mr-1"/>Run Plan</Button>
              <Button size="sm" variant="secondary"><ClipboardList className="w-4 h-4 mr-1"/>Queue Task</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Terminal + Tasks ----------
function BottomDock(){
  const [tab, setTab] = useState("terminal");
  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <TabsList>
          <TabsTrigger value="terminal"><TerminalSquare className="w-4 h-4 mr-1"/>Terminal</TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks className="w-4 h-4 mr-1"/>Tasks</TabsTrigger>
          <TabsTrigger value="problems"><AlarmClock className="w-4 h-4 mr-1"/>Problems</TabsTrigger>
          <TabsTrigger value="output"><Rows2 className="w-4 h-4 mr-1"/>Output</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 pr-2">
          {mockInstruments.map(i => (
            <Button key={i.id} size="sm" variant="secondary" className="gap-2"><Wrench className="w-3 h-3"/>{i.name}</Button>
          ))}
        </div>
      </div>
      <TabsContent value="terminal" className="flex-1 m-0">
        <div className="h-full grid grid-rows-[1fr_auto]">
          <ScrollArea className="border-x border-b rounded-b-lg p-2 text-xs font-mono h-full">
            <pre>$ pnpm dev\nready - compiled in 1.2s\n➡ listening on http://localhost:5173</pre>
          </ScrollArea>
          <div className="flex items-center gap-2 p-2 border-x border-b rounded-b-md">
            <Input placeholder="Type a command…" className="h-8"/>
            <Button size="sm"><Play className="w-4 h-4"/></Button>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="tasks" className="flex-1 m-0">
        <div className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>ETA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Refactor agent planner</TableCell>
                <TableCell><Badge>Running</Badge></TableCell>
                <TableCell>Agent #1</TableCell>
                <TableCell>00:25</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Rebuild vector index</TableCell>
                <TableCell><Badge variant="secondary">Queued</Badge></TableCell>
                <TableCell>Agent #2</TableCell>
                <TableCell>–</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="problems" className="flex-1 m-0">
        <div className="p-2 text-sm">No issues.</div>
      </TabsContent>
      <TabsContent value="output" className="flex-1 m-0">
        <ScrollArea className="h-full p-2 text-xs font-mono">Build logs here…</ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

// ---------- Editor + Right Panel ----------
function EditorCenter(){
  const [tab, setTab] = useState("app.tsx");
  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <div className="flex items-center gap-2 border-b px-2 h-10 overflow-x-auto">
        {mockFiles.map(f => (
          <button key={f.id} onClick={()=>setTab(f.name)} className={`px-2 py-1 rounded-md text-sm inline-flex items-center gap-2 hover:bg-accent ${tab===f.name?"bg-accent": ""}`}>
            <File className="w-3.5 h-3.5"/>{f.name}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost"><Save className="w-4 h-4"/></Button>
          <Button size="sm" variant="ghost"><Play className="w-4 h-4"/></Button>
        </div>
      </div>
      <div className="p-2 h-full">
        <div className="h-full w-full rounded-lg border overflow-hidden">
          <div className="grid grid-cols-2 h-full">
            <Textarea defaultValue={`// ${tab}\n// lightweight editor mock\nfunction demo(){\n  return true;\n}`} className="h-full rounded-none border-0 font-mono text-sm"/>
            <div className="border-l p-3 text-sm bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Preview</div>
                <Button size="sm" variant="secondary"><Eye className="w-4 h-4 mr-1"/>Open Viewer</Button>
              </div>
              <div className="rounded-md border bg-background p-3">Rendered output placeholder</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanel(){
  const [tab, setTab] = useState("chat");
  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
      <div className="px-2 pt-2">
        <TabsList>
          <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-1"/>Chat</TabsTrigger>
          <TabsTrigger value="inspector"><ScanSearch className="w-4 h-4 mr-1"/>Inspector</TabsTrigger>
          <TabsTrigger value="computer"><MonitorCog className="w-4 h-4 mr-1"/>Computer</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="chat" className="flex-1 m-0">
        <div className="grid grid-rows-[1fr_auto] h-full">
          <ScrollArea className="p-3">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 mt-1"/>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm max-w-[85%]">How can I help?</div>
              </div>
              <div className="flex items-start gap-2 justify-end">
                <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm max-w-[85%]">Summarize the new code.</div>
              </div>
            </div>
          </ScrollArea>
          <div className="border-t p-2 grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
            <Select defaultValue="gpt-5">
              <SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5">GPT‑5</SelectItem>
                <SelectItem value="o3">o3</SelectItem>
                <SelectItem value="sonnet">Claude Sonnet</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Message…" className="h-8"/>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm"><Plug className="w-4 h-4 mr-1"/>Tools</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Attach Tools</DropdownMenuLabel>
                <DropdownMenuSeparator/>
                <DropdownMenuCheckboxItem checked>Filesystem</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>Browser</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Code Exec</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Vectors</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Database</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem>Manage MCP…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm"><Sparkles className="w-4 h-4 mr-1"/>Send</Button>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="inspector" className="m-0">
        <div className="p-3 text-sm space-y-2">
          <div className="font-medium">Selection</div>
          <div className="border rounded-md p-3">No selection.</div>
          <div className="font-medium">Metadata</div>
          <div className="border rounded-md p-3 grid grid-cols-2 gap-2">
            <div>Language: TypeScript</div>
            <div>Lines: 120</div>
            <div>Tokens est.: 450</div>
            <div>Last run: 2m ago</div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="computer" className="m-0">
        <ComputerAsToolPanel/>
      </TabsContent>
    </Tabs>
  );
}

function ComputerAsToolPanel(){
  return (
    <div className="p-3 space-y-3">
      <div className="text-sm font-medium">Computer‑as‑Tool Controls</div>
      <div className="text-xs text-muted-foreground">Grant scoped capabilities to agents. Logs and approvals enforced.</div>
      <div className="grid grid-cols-2 gap-3">
        <Capability label="Read files" defaultChecked/>
        <Capability label="Write files" defaultChecked/>
        <Capability label="Network access"/>
        <Capability label="Keyboard/Mouse"/>
        <Capability label="Open apps"/>
        <Capability label="Screenshots"/>
      </div>
      <Separator/>
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-md p-3 space-y-2">
          <div className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Guardrails</div>
          <div className="flex items-center justify-between text-sm"><span>Require step approval</span><Switch defaultChecked/></div>
          <div className="flex items-center justify-between text-sm"><span>Block external downloads</span><Switch/></div>
          <div className="flex items-center justify-between text-sm"><span>Rate limit ops</span><Switch/></div>
        </div>
        <div className="border rounded-md p-3 space-y-2">
          <div className="text-sm font-medium flex items-center gap-2"><ClipboardList className="w-4 h-4"/>Audit</div>
          <div className="text-xs text-muted-foreground">All actions logged for review and replay.</div>
          <Button size="sm" variant="secondary"><Download className="w-4 h-4 mr-1"/>Export Logs</Button>
        </div>
      </div>
    </div>
  );
}

function Capability({label, defaultChecked}:{label:string, defaultChecked?:boolean}){
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <label className="flex items-center justify-between border rounded-md p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={setChecked}/>
    </label>
  );
}

// ---------- TopBar ----------
function TopBar(){
  return (
    <div className="h-12 border-b flex items-center px-2 gap-2">
      <AppMenubar onCommand={()=>{}}/>
      <Separator orientation="vertical" className="mx-1 h-6"/>
      <Button size="sm" variant="secondary" className="gap-2"><GitBranch className="w-4 h-4"/>main</Button>
      <div className="relative ml-auto">
        <Input placeholder="Go to file, command, symbol" className="h-9 w-[420px] pl-9"/>
        <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground"/>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost"><Save className="w-4 h-4"/></Button>
          </TooltipTrigger>
          <TooltipContent>Save <Kbd>⌘</Kbd>+<Kbd>S</Kbd></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button size="icon" variant="default"><Play className="w-4 h-4"/></Button>
      <Button size="icon" variant="outline"><SlidersHorizontal className="w-4 h-4"/></Button>
    </div>
  );
}

// ---------- Status Bar ----------
function StatusBar(){
  return (
    <div className="h-8 border-t text-xs px-2 flex items-center gap-3 text-muted-foreground">
      <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3"/>Guarded</span>
      <span className="inline-flex items-center gap-1"><Cpu className="w-3 h-3"/>GPU idle</span>
      <span className="inline-flex items-center gap-1"><Bot className="w-3 h-3"/>GPT‑5</span>
      <span className="inline-flex items-center gap-1 ml-auto"><Cloud className="w-3 h-3"/>Remote OK</span>
    </div>
  );
}

// ---------- Main Shell ----------
export default function VSCodeForkGUI(){
  const [section, setSection] = useState("explorer");
  const renderLeft = () => {
    switch(section){
      case "explorer": return <Explorer/>;
      case "vectors": return <VectorManager/>;
      case "databases": return <DatabaseManager/>;
      case "instruments": return <Instruments/>;
      case "mcp": return <MCPServers/>;
      case "agents": return <Agents/>;
      default: return <Explorer/>;
    }
  };

  return (
    <div className="h-screen w-screen grid grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <TopBar/>
      <PanelGroup direction="vertical">
        <Panel defaultSize={72} minSize={40}>
          <PanelGroup direction="horizontal">
            <Panel minSize={15} defaultSize={20} className="border-r bg-muted/10">
              <Sidebar section={section} setSection={setSection}/>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border"/>
            <Panel minSize={40} defaultSize={60}>
              <EditorCenter/>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border"/>
            <Panel minSize={20} defaultSize={20} className="border-l bg-muted/10">
              <RightPanel/>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="h-1 bg-border"/>
        <Panel minSize={12} defaultSize={18} className="bg-muted/10">
          <BottomDock/>
        </Panel>
      </PanelGroup>
      <StatusBar/>
    </div>
  );
}
