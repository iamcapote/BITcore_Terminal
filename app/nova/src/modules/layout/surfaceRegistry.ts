/**
 * Why: Surface registry maps surface IDs to their React components and definitions.
 * What: SURFACES array (surface configs) and SURFACE_COMPONENTS map consumed by the shell.
 * How: Core surfaces loaded eagerly; hidden-by-default surfaces loaded with React.lazy for code splitting.
 */

import { lazy, type ComponentType } from "react";
import type { SurfaceDefinition, SurfaceId } from "@/modules/layout/layoutTypes";

/* ── Eager imports (initially visible) ─────────────────────────────── */

import { ChatSurface } from "@/modules/chat/ChatSurface";
import { DashboardSurface } from "@/modules/views/DashboardSurface";
import { SchemaSurface, WorkflowsSurface } from "@/modules/views/WorkflowCoreSurfaces";

/* ── Lazy imports (hidden by default, code-split) ──────────────────── */

const AgentsSurface = lazy(() => import("@/modules/views/AgentSurfaces").then(m => ({ default: m.AgentsSurface })));
const ComputerAsToolSurface = lazy(() => import("@/modules/views/AgentSurfaces").then(m => ({ default: m.ComputerAsToolSurface })));
const McpRegistrySurface = lazy(() => import("@/modules/views/AgentSurfaces").then(m => ({ default: m.McpRegistrySurface })));
const BrowserSurface = lazy(() => import("@/modules/views/BrowserSurface").then(m => ({ default: m.BrowserSurface })));
const EditorSurface = lazy(() => import("@/modules/views/EditorSurface").then(m => ({ default: m.EditorSurface })));
const DatabaseManagerSurface = lazy(() => import("@/modules/views/KnowledgeSurfaces").then(m => ({ default: m.DatabaseManagerSurface })));
const MemoryManagerSurface = lazy(() => import("@/modules/views/KnowledgeSurfaces").then(m => ({ default: m.MemoryManagerSurface })));
const VectorManagerSurface = lazy(() => import("@/modules/views/KnowledgeSurfaces").then(m => ({ default: m.VectorManagerSurface })));
const SkillsSurface = lazy(() => import("@/modules/views/OperationsSurfaces").then(m => ({ default: m.InstrumentsSurface })));
const TerminalSurface = lazy(() => import("@/modules/views/OperationsSurfaces").then(m => ({ default: m.TerminalSurface })));
const ResearchSurface = lazy(() => import("@/modules/research/ResearchSurface").then(m => ({ default: m.ResearchSurface })));
const PromptLibrarySurface = lazy(() => import("@/modules/prompts/PromptLibrarySurface").then(m => ({ default: m.PromptLibrarySurface })));
const MissionsSurface = lazy(() => import("@/modules/missions/MissionsSurface").then(m => ({ default: m.MissionsSurface })));
const GithubSyncSurface = lazy(() => import("@/modules/github/GithubSyncSurface").then(m => ({ default: m.GithubSyncSurface })));
const LogsSurface = lazy(() => import("@/modules/logs/LogsSurface").then(m => ({ default: m.LogsSurface })));
const SettingsSurface = lazy(() => import("@/modules/views/SettingsSurface").then(m => ({ default: m.SettingsSurface })));
import {
  Bot,
  BookOpenCheck,
  BrainCircuit,
  Chrome,
  Database,
  FolderTree,
  GitPullRequest,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Monitor,
  Plug,
  Rocket,
  ScrollText,
  Search,
  Settings,
  TerminalSquare,
  Workflow,
  Wrench,
} from "lucide-react";

/* ── Surface definitions ───────────────────────────────────────────── */

export const SURFACES: SurfaceDefinition[] = [
  /* core — surfaces you open every session */
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "core", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "wired" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "core", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "wired" },
  { id: "schema", label: "Schema", icon: Workflow, group: "core", defaultPlacement: "primary", initialPlacement: "primary", wiringStatus: "partial" },
  { id: "workflows", label: "Workflows", icon: Workflow, group: "core", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "partial" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, group: "core", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "research", label: "Research", icon: Search, group: "core", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "explorer", label: "Explorer", icon: FolderTree, group: "core", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "browser", label: "Browser", icon: Chrome, group: "core", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  /* agents — mission orchestration, skills, and knowledge primitives */
  { id: "missions", label: "Missions", icon: Rocket, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "agents", label: "Agents", icon: Bot, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "partial" },
  { id: "computer", label: "Computer", icon: Monitor, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "skills", label: "Skills", icon: Wrench, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "memory", label: "Memory", icon: BrainCircuit, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "prompts", label: "Prompts", icon: BookOpenCheck, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "vectors", label: "Vector Stores", icon: Layers, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "partial" },
  { id: "mcp", label: "MCP", icon: Plug, group: "agents", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  /* tools — utilities and integrations */
  { id: "logs", label: "Logs", icon: ScrollText, group: "tools", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "githubSync", label: "GitHub Sync", icon: GitPullRequest, group: "tools", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
  { id: "databases", label: "Databases", icon: Database, group: "tools", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "unwired" },
  { id: "settings", label: "Settings", icon: Settings, group: "tools", defaultPlacement: "primary", initialPlacement: "hidden", wiringStatus: "wired" },
];

/* ── Component map ─────────────────────────────────────────────────── */

export const SURFACE_COMPONENTS: Record<SurfaceId, ComponentType> = {
  dashboard: DashboardSurface,
  schema: SchemaSurface,
  explorer: EditorSurface,
  vectors: VectorManagerSurface,
  databases: DatabaseManagerSurface,
  memory: MemoryManagerSurface,
  research: ResearchSurface,
  prompts: PromptLibrarySurface,
  agents: AgentsSurface,
  computer: ComputerAsToolSurface,
  skills: SkillsSurface,
  missions: MissionsSurface,
  githubSync: GithubSyncSurface,
  logs: LogsSurface,
  terminal: TerminalSurface,
  workflows: WorkflowsSurface,
  mcp: McpRegistrySurface,
  browser: BrowserSurface,
  settings: SettingsSurface,
  chat: ChatSurface,
};
