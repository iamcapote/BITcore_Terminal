/**
 * Why: Surface registry maps surface IDs to their React components and definitions.
 * What: SURFACES array (surface configs) and SURFACE_COMPONENTS map consumed by the shell.
 * How: Import each surface component and pair it with its SurfaceDefinition metadata.
 */

import type { SurfaceDefinition, SurfaceId } from "@/modules/layout/layoutTypes";
import {
  AgentsSurface,
  ComputerAsToolSurface,
} from "@/modules/views/AgentSurfaces";
import { ChatSurface } from "@/modules/chat/ChatSurface";
import { EditorSurface } from "@/modules/views/EditorSurface";
import {
  DatabaseManagerSurface,
  MemoryManagerSurface,
  MetricsBoardSurface,
  VectorManagerSurface,
} from "@/modules/views/KnowledgeSurfaces";
import {
  InstrumentsSurface,
  TasksSurface,
  TerminalSurface,
} from "@/modules/views/OperationsSurfaces";
import { ResearchSurface } from "@/modules/research/ResearchSurface";
import { PromptLibrarySurface } from "@/modules/prompts/PromptLibrarySurface";
import { MissionsSurface } from "@/modules/missions/MissionsSurface";
import { GithubSyncSurface } from "@/modules/github/GithubSyncSurface";
import { LogsSurface } from "@/modules/logs/LogsSurface";
import { SettingsSurface } from "@/modules/views/SettingsSurface";
import { DashboardSurface } from "@/modules/views/DashboardSurface";
import { BrowserSurface } from "@/modules/views/BrowserSurface";
import {
  Bot,
  BookOpenCheck,
  BrainCircuit,
  Chrome,
  Database,
  FolderTree,
  Gauge,
  GitPullRequest,
  LayoutDashboard,
  Layers,
  ListChecks,
  MessageSquare,
  Plug,
  Rocket,
  ScrollText,
  Search,
  Settings,
  TerminalSquare,
  Wrench,
} from "lucide-react";

/* ── Surface definitions ───────────────────────────────────────────── */

export const SURFACES: SurfaceDefinition[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "workspace", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "wired" },
  { id: "explorer", label: "Explorer", icon: FolderTree, group: "workspace", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "vectors", label: "Vector Stores", icon: Layers, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "databases", label: "Databases", icon: Database, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "memory", label: "Memory", icon: BrainCircuit, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "metrics", label: "Metrics", icon: Gauge, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "research", label: "Research", icon: Search, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "prompts", label: "Prompts", icon: BookOpenCheck, group: "knowledge", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "agents", label: "Agents", icon: Bot, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "instruments", label: "Instruments", icon: Wrench, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "missions", label: "Missions", icon: Rocket, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "tasks", label: "Tasks", icon: ListChecks, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "githubSync", label: "GitHub Sync", icon: GitPullRequest, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "logs", label: "Logs", icon: ScrollText, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "mcp", label: "MCP", icon: Plug, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "browser", label: "Browser", icon: Chrome, group: "operations", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "settings", label: "Settings", icon: Settings, group: "workspace", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "communication", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "wired" },
];

/* ── Component map ─────────────────────────────────────────────────── */

export const SURFACE_COMPONENTS: Record<SurfaceId, () => JSX.Element> = {
  dashboard: DashboardSurface,
  explorer: EditorSurface,
  vectors: VectorManagerSurface,
  databases: DatabaseManagerSurface,
  memory: MemoryManagerSurface,
  metrics: MetricsBoardSurface,
  research: ResearchSurface,
  prompts: PromptLibrarySurface,
  agents: AgentsSurface,
  instruments: InstrumentsSurface,
  missions: MissionsSurface,
  tasks: TasksSurface,
  githubSync: GithubSyncSurface,
  logs: LogsSurface,
  terminal: TerminalSurface,
  mcp: ComputerAsToolSurface,
  browser: BrowserSurface,
  settings: SettingsSurface,
  chat: ChatSurface,
};
