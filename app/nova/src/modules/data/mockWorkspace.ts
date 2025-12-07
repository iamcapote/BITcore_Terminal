/**
 * @license INTERNAL ONLY — Mock workspace state (Step 1)
 *
 * The mock data mirrors the VS-code fork prototypes. Real data sources will plug
 * in during Step 3 once Nova integrates with the Bitcore runtime.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Bot,
  BrainCircuit,
  ClipboardList,
  FileCode2,
  FileText,
  FolderTree,
  Gauge,
  Layers,
  TerminalSquare,
  Wrench,
} from "lucide-react";

export interface FileNode {
  readonly id: string;
  readonly name: string;
  readonly type: "file" | "folder";
  readonly icon?: LucideIcon;
  readonly children?: FileNode[];
}

export interface InstrumentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly command: string;
}

export interface VectorStoreRow {
  readonly id: string;
  readonly index: string;
  readonly backend: string;
  readonly dimension: number;
  readonly size: number;
  readonly status: "Ready" | "Building" | "Syncing";
}

export interface DatabaseConnectionRow {
  readonly id: string;
  readonly name: string;
  readonly engine: "Postgres" | "SQLite" | "DuckDB";
  readonly tables: number;
}

export interface MCPServerRow {
  readonly id: string;
  readonly name: string;
  readonly status: "online" | "offline";
  readonly endpoints: string[];
}

export interface MemorySpaceRow {
  readonly id: string;
  readonly scope: string;
  readonly description: string;
  readonly retention: string;
  readonly size: string;
  readonly status: "Active" | "Syncing" | "Archived";
}

export interface WorkspaceMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly trend: string;
  readonly icon: LucideIcon;
}

export interface AgentProfile {
  readonly id: string;
  readonly name: string;
  readonly status: "idle" | "running" | "paused";
  readonly autonomy: "Guarded" | "Full" | "Manual";
  readonly model: string;
  readonly persona: string;
  readonly missionCount: number;
  readonly tools: readonly string[];
  readonly lastRunAgo: string;
}

export interface AgentActivityEntry {
  readonly id: string;
  readonly agentId: string;
  readonly summary: string;
  readonly timestampAgo: string;
  readonly status: "success" | "warning" | "error";
}

export const explorerTree: FileNode[] = [
  {
    id: "dir-src",
    name: "src",
    type: "folder",
    icon: FolderTree,
    children: [
      { id: "file-app", name: "App.tsx", type: "file", icon: FileCode2 },
      { id: "file-main", name: "main.tsx", type: "file", icon: FileCode2 },
      {
        id: "dir-agents",
        name: "agents",
        type: "folder",
        icon: FolderTree,
        children: [
          { id: "file-planner", name: "planner.ts", type: "file", icon: FileCode2 },
          { id: "file-runtime", name: "runtime.ts", type: "file", icon: FileCode2 },
        ],
      },
      {
        id: "dir-ui",
        name: "ui",
        type: "folder",
        icon: FolderTree,
        children: [
          { id: "file-button", name: "button.tsx", type: "file", icon: FileCode2 },
          { id: "file-table", name: "table.tsx", type: "file", icon: FileCode2 },
        ],
      },
    ],
  },
  {
    id: "dir-config",
    name: "config",
    type: "folder",
    icon: FolderTree,
    children: [
      { id: "file-env", name: "env.mjs", type: "file", icon: FileText },
      { id: "file-vectors", name: "vectors.json", type: "file", icon: FileText },
    ],
  },
  { id: "file-readme", name: "README.md", type: "file", icon: FileText },
];

export const instruments: InstrumentDefinition[] = [
  { id: "inst-format", name: "format", description: "Run Prettier + ESLint", command: "pnpm fmt" },
  { id: "inst-embed", name: "embed", description: "Generate vector embeddings", command: "pnpm embed" },
  { id: "inst-migrate", name: "migrate", description: "DB migrate with drizzle", command: "pnpm db:migrate" },
];

export const vectorStores: VectorStoreRow[] = [
  { id: "vec-docs", index: "docs-prod", backend: "Pinecone", dimension: 1536, size: 182_441, status: "Ready" },
  { id: "vec-images", index: "images", backend: "FAISS", dimension: 1024, size: 39_210, status: "Building" },
];

export const databaseConnections: DatabaseConnectionRow[] = [
  { id: "db-app", name: "app", engine: "Postgres", tables: 28 },
  { id: "db-analytics", name: "analytics", engine: "DuckDB", tables: 12 },
];

export const mcpServers: MCPServerRow[] = [
  { id: "mcp-fs", name: "filesystem", status: "online", endpoints: ["ls", "readFile", "writeFile"] },
  { id: "mcp-browser", name: "browser", status: "online", endpoints: ["navigate", "extract", "screenshot"] },
  { id: "mcp-exec", name: "code-exec", status: "offline", endpoints: ["run", "kill", "status"] },
];

export const memorySpaces: MemorySpaceRow[] = [
  {
    id: "mem-workspace",
    scope: "Workspace",
    description: "Project design decisions",
    retention: "30 days",
    size: "12.3 MB",
    status: "Active",
  },
  {
    id: "mem-agent",
    scope: "Agent #2",
    description: "Vector summaries for docs/",
    retention: "14 days",
    size: "4.8 MB",
    status: "Syncing",
  },
  {
    id: "mem-global",
    scope: "Global",
    description: "CLI command history",
    retention: "7 days",
    size: "1.6 MB",
    status: "Archived",
  },
];

export const workspaceMetrics: WorkspaceMetric[] = [
  { id: "metric-agents", label: "Active Agents", value: "3", trend: "+1", icon: Bot },
  { id: "metric-vectors", label: "Vectors", value: "164k", trend: "+3%", icon: Layers },
  { id: "metric-memory", label: "Memory Footprint", value: "18 MB", trend: "-5%", icon: BrainCircuit },
  { id: "metric-latency", label: "Tool Latency", value: "320 ms", trend: "-12%", icon: Gauge },
];

export const agentProfiles: AgentProfile[] = [
  {
    id: "agent-planner",
    name: "Planner",
    status: "running",
    autonomy: "Guarded",
    model: "gpt-5",
    persona: "planner.core",
    missionCount: 4,
    tools: ["fs", "vectors", "db"],
    lastRunAgo: "2m",
  },
  {
    id: "agent-researcher",
    name: "Researcher",
    status: "idle",
    autonomy: "Manual",
    model: "qwen3-235b",
    persona: "research.focus",
    missionCount: 6,
    tools: ["browser", "fs", "memory"],
    lastRunAgo: "14m",
  },
  {
    id: "agent-shipper",
    name: "Shipper",
    status: "paused",
    autonomy: "Guarded",
    model: "claude-sonnet",
    persona: "shipper.ops",
    missionCount: 2,
    tools: ["github", "terminal"],
    lastRunAgo: "42m",
  },
];

export const agentActivity: AgentActivityEntry[] = [
  {
    id: "agent-activity-1",
    agentId: "agent-planner",
    summary: "Queued refactor-missions plan",
    timestampAgo: "3m ago",
    status: "success",
  },
  {
    id: "agent-activity-2",
    agentId: "agent-researcher",
    summary: "Awaiting approval for web scrape",
    timestampAgo: "9m ago",
    status: "warning",
  },
  {
    id: "agent-activity-3",
    agentId: "agent-shipper",
    summary: "Push pipeline paused by guardrail",
    timestampAgo: "27m ago",
    status: "error",
  },
];

export const taskBoardColumns = [
  {
    id: "col-backlog",
    title: "Backlog",
    items: [
      "Spec UI for agents",
      "Audit MCP connectors",
      "Design vector panel",
    ],
  },
  {
    id: "col-progress",
    title: "In Progress",
    items: [
      "Refactor agent planner",
      "Rebuild vector index",
    ],
  },
  {
    id: "col-done",
    title: "Done",
    items: [
      "Align typography",
      "Sync Nova assets",
    ],
  },
];

export const terminalShortcuts = [
  { id: "term-fmt", label: "format", icon: Wrench, command: "pnpm fmt" },
  { id: "term-tests", label: "tests", icon: AlarmClock, command: "pnpm test" },
  { id: "term-ship", label: "build", icon: ClipboardList, command: "pnpm build" },
];

export const timeline = {
  lastCommandAgo: "12s",
  guardrail: "Guarded",
  gpuStatus: "GPU idle",
  primaryModel: "GPT‑5",
  branch: "main",
  remote: "synced",
};

export interface ResearchTelemetrySummary {
  readonly status: "Idle" | "Running" | "Complete" | "Error";
  readonly stage: "Planning" | "Executing" | "Synthesizing" | "Complete";
  readonly progress: number;
  readonly depth: number;
  readonly breadth: number;
  readonly totalTokens: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly updatedAgo: string;
  readonly message?: string;
}

export interface LogSummary {
  readonly total: number;
  readonly info: number;
  readonly warn: number;
  readonly error: number;
}

export const researchTelemetry: ResearchTelemetrySummary = {
  status: "Running",
  stage: "Synthesizing",
  progress: 64,
  depth: 2,
  breadth: 2,
  totalTokens: 4860,
  promptTokens: 3150,
  completionTokens: 1710,
  updatedAgo: "8s ago",
  message: "Synthesizing insights from 7 sources",
};

export const logSummary: LogSummary = {
  total: 128,
  info: 102,
  warn: 18,
  error: 8,
};

export const quickStats = {
  terminalHint: "Drop tasks to queue for agents",
  workspaceTag: "AI Ready",
};

export const terminalPrefill = [
  "$ pnpm dev",
  "ready - compiled in 1.2s",
  "➡ listening on http://localhost:5173",
  "",
  "$ node scripts/check-nova.mjs",
  "✔ Nova assets synced",
];

export const leftGroups = [
  {
    id: "workspace",
    title: "Workspace",
    icon: FolderTree,
    countIcon: FolderTree,
  },
  {
    id: "knowledge",
    title: "Knowledge",
    icon: Layers,
  },
  {
    id: "operations",
    title: "Operations",
    icon: Wrench,
  },
  {
    id: "communication",
    title: "Communication",
    icon: TerminalSquare,
  },
];
