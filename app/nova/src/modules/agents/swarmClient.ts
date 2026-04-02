/**
 * Why: Provide a typed client for the swarm backend seam used by Nova agent surfaces.
 * What: Fetches swarm overview and capabilities snapshots from mock-first API endpoints.
 * How: Validates response shape lightly and falls back to caller-provided defaults on failure.
 */

import type { AgentActivityEntry, AgentProfile, MCPServerRow } from "@/modules/data/mockWorkspace";

export interface SwarmOverviewSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly agents: readonly AgentProfile[];
  readonly activity: readonly AgentActivityEntry[];
  readonly mcpServers: readonly MCPServerRow[];
  readonly updatedAt: string;
}

export interface SwarmCapabilities {
  readonly readFiles: boolean;
  readonly writeFiles: boolean;
  readonly networkAccess: boolean;
  readonly keyboardMouse: boolean;
  readonly openApps: boolean;
  readonly screenshots: boolean;
  readonly requireStepApproval: boolean;
  readonly blockExternalDownloads: boolean;
  readonly rateLimitOps: boolean;
}

export interface SwarmCapabilitiesSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly capabilities: SwarmCapabilities;
  readonly updatedAt: string;
}

export interface SwarmDelegationRequest {
  readonly mission: string;
  readonly targetAgentId?: string;
  readonly requireApproval?: boolean;
}

export interface SwarmDelegationRecord {
  readonly id: string;
  readonly mission: string;
  readonly targetAgentId: string;
  readonly queuedAt: string;
  readonly mode: string;
  readonly requireApproval: boolean;
  readonly status: string;
}

export interface SwarmRunStateSnapshot {
  readonly id: string;
  readonly mission: string;
  readonly targetAgentId: string;
  readonly state: string;
  readonly mode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly plan: {
    readonly todo: readonly string[];
    readonly inProgress: readonly string[];
    readonly done: readonly string[];
  };
}

export interface SwarmRunsSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly runs: readonly SwarmRunStateSnapshot[];
  readonly updatedAt: string;
}

export interface SwarmClarificationHistoryEntry {
  readonly id: string;
  readonly role: string;
  readonly action: string;
  readonly message: string;
  readonly timestamp: string;
}

export interface SwarmClarificationState {
  readonly enabled: boolean;
  readonly roundsUsed: number;
  readonly maxRounds: number;
  readonly isComplete: boolean;
  readonly pendingQuestion: string;
  readonly lastResponse: string;
  readonly updatedAt: string;
  readonly history: readonly SwarmClarificationHistoryEntry[];
}

export interface SwarmClarificationSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly clarification: SwarmClarificationState;
  readonly updatedAt: string;
}

export interface SwarmGraphChannel {
  readonly id: string;
  readonly name: string;
  readonly members: readonly string[];
  readonly roundsUsed: number;
  readonly maxRounds: number;
  readonly status: string;
  readonly lastSpeaker: string;
}

export interface SwarmGraphFunction {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly sync: boolean;
  readonly lastRunStatus: string;
}

export interface SwarmGraphEvent {
  readonly id: string;
  readonly type: string;
  readonly channelId: string;
  readonly message: string;
  readonly speaker?: string;
  readonly functionId?: string | null;
  readonly timestamp: string;
}

export interface SwarmGraphState {
  readonly maxRounds: number;
  readonly currentRound: number;
  readonly activeChannelId: string;
  readonly terminated: boolean;
  readonly lastMessage: string;
  readonly updatedAt: string;
  readonly channels: readonly SwarmGraphChannel[];
  readonly functions: readonly SwarmGraphFunction[];
  readonly events: readonly SwarmGraphEvent[];
}

export interface SwarmGraphSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly graph: SwarmGraphState;
  readonly updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOverview(payload: unknown, fallback: SwarmOverviewSnapshot): SwarmOverviewSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }
  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
      }
    : fallback.feature;

  const agents = Array.isArray(payload.agents) ? (payload.agents as AgentProfile[]) : fallback.agents;
  const activity = Array.isArray(payload.activity) ? (payload.activity as AgentActivityEntry[]) : fallback.activity;
  const mcpServers = Array.isArray(payload.mcpServers) ? (payload.mcpServers as MCPServerRow[]) : fallback.mcpServers;

  return {
    source,
    feature,
    agents,
    activity,
    mcpServers,
    updatedAt,
  };
}

function normalizeCapabilities(payload: unknown, fallback: SwarmCapabilitiesSnapshot): SwarmCapabilitiesSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }
  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
      }
    : fallback.feature;

  const capabilitiesPayload = isObject(payload.capabilities) ? payload.capabilities : fallback.capabilities;
  const capabilities: SwarmCapabilities = {
    readFiles: Boolean(capabilitiesPayload.readFiles),
    writeFiles: Boolean(capabilitiesPayload.writeFiles),
    networkAccess: Boolean(capabilitiesPayload.networkAccess),
    keyboardMouse: Boolean(capabilitiesPayload.keyboardMouse),
    openApps: Boolean(capabilitiesPayload.openApps),
    screenshots: Boolean(capabilitiesPayload.screenshots),
    requireStepApproval: Boolean(capabilitiesPayload.requireStepApproval),
    blockExternalDownloads: Boolean(capabilitiesPayload.blockExternalDownloads),
    rateLimitOps: Boolean(capabilitiesPayload.rateLimitOps),
  };

  return {
    source,
    feature,
    capabilities,
    updatedAt,
  };
}

function normalizeDelegationRecord(payload: unknown): SwarmDelegationRecord | null {
  if (!isObject(payload)) {
    return null;
  }
  const id = typeof payload.id === "string" ? payload.id : "";
  const mission = typeof payload.mission === "string" ? payload.mission : "";
  const targetAgentId = typeof payload.targetAgentId === "string" ? payload.targetAgentId : "";
  const queuedAt = typeof payload.queuedAt === "string" ? payload.queuedAt : new Date().toISOString();
  const mode = typeof payload.mode === "string" ? payload.mode : "mock";
  const requireApproval = Boolean(payload.requireApproval);
  const status = typeof payload.status === "string" ? payload.status : "queued";
  if (!id || !mission || !targetAgentId) {
    return null;
  }
  return {
    id,
    mission,
    targetAgentId,
    queuedAt,
    mode,
    requireApproval,
    status,
  };
}

function normalizeRuns(payload: unknown, fallback: SwarmRunsSnapshot): SwarmRunsSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }

  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
      }
    : fallback.feature;

  const runs = Array.isArray(payload.runs)
    ? payload.runs
        .map((entry) => {
          if (!isObject(entry)) {
            return null;
          }
          const id = typeof entry.id === "string" ? entry.id : "";
          const mission = typeof entry.mission === "string" ? entry.mission : "";
          const targetAgentId = typeof entry.targetAgentId === "string" ? entry.targetAgentId : "";
          if (!id || !mission || !targetAgentId) {
            return null;
          }
          const plan = isObject(entry.plan) ? entry.plan : {};
          return {
            id,
            mission,
            targetAgentId,
            state: typeof entry.state === "string" ? entry.state : "queued",
            mode: typeof entry.mode === "string" ? entry.mode : "mock",
            createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
            updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
            plan: {
              todo: Array.isArray(plan.todo) ? (plan.todo as string[]) : [],
              inProgress: Array.isArray(plan.inProgress) ? (plan.inProgress as string[]) : [],
              done: Array.isArray(plan.done) ? (plan.done as string[]) : [],
            },
          } as SwarmRunStateSnapshot;
        })
        .filter((entry): entry is SwarmRunStateSnapshot => entry !== null)
    : fallback.runs;

  return {
    source,
    feature,
    runs,
    updatedAt,
  };
}

function normalizeClarification(payload: unknown, fallback: SwarmClarificationSnapshot): SwarmClarificationSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }
  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
      }
    : fallback.feature;

  const clarificationPayload = isObject(payload.clarification) ? payload.clarification : fallback.clarification;
  const history = Array.isArray(clarificationPayload.history)
    ? clarificationPayload.history
        .map((entry) => {
          if (!isObject(entry)) {
            return null;
          }
          const id = typeof entry.id === "string" ? entry.id : "";
          if (!id) {
            return null;
          }
          return {
            id,
            role: typeof entry.role === "string" ? entry.role : "unknown",
            action: typeof entry.action === "string" ? entry.action : "unknown",
            message: typeof entry.message === "string" ? entry.message : "",
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
          } as SwarmClarificationHistoryEntry;
        })
        .filter((entry): entry is SwarmClarificationHistoryEntry => entry !== null)
    : fallback.clarification.history;

  return {
    source,
    feature,
    clarification: {
      enabled: Boolean(clarificationPayload.enabled),
      roundsUsed: Number.isFinite(Number(clarificationPayload.roundsUsed)) ? Number(clarificationPayload.roundsUsed) : fallback.clarification.roundsUsed,
      maxRounds: Number.isFinite(Number(clarificationPayload.maxRounds)) ? Number(clarificationPayload.maxRounds) : fallback.clarification.maxRounds,
      isComplete: Boolean(clarificationPayload.isComplete),
      pendingQuestion: typeof clarificationPayload.pendingQuestion === "string" ? clarificationPayload.pendingQuestion : fallback.clarification.pendingQuestion,
      lastResponse: typeof clarificationPayload.lastResponse === "string" ? clarificationPayload.lastResponse : fallback.clarification.lastResponse,
      updatedAt: typeof clarificationPayload.updatedAt === "string" ? clarificationPayload.updatedAt : new Date().toISOString(),
      history,
    },
    updatedAt,
  };
}

function normalizeGraph(payload: unknown, fallback: SwarmGraphSnapshot): SwarmGraphSnapshot {
  if (!isObject(payload)) {
    return fallback;
  }
  const source = typeof payload.source === "string" ? payload.source : fallback.source;
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : fallback.updatedAt;
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
      }
    : fallback.feature;

  const graphPayload = isObject(payload.graph) ? payload.graph : fallback.graph;
  const channels = Array.isArray(graphPayload.channels)
    ? graphPayload.channels
        .map((entry) => {
          if (!isObject(entry)) {
            return null;
          }
          const id = typeof entry.id === "string" ? entry.id : "";
          if (!id) {
            return null;
          }
          return {
            id,
            name: typeof entry.name === "string" ? entry.name : id,
            members: Array.isArray(entry.members) ? (entry.members as string[]) : [],
            roundsUsed: Number.isFinite(Number(entry.roundsUsed)) ? Number(entry.roundsUsed) : 0,
            maxRounds: Number.isFinite(Number(entry.maxRounds)) ? Number(entry.maxRounds) : 0,
            status: typeof entry.status === "string" ? entry.status : "idle",
            lastSpeaker: typeof entry.lastSpeaker === "string" ? entry.lastSpeaker : "",
          } as SwarmGraphChannel;
        })
        .filter((entry): entry is SwarmGraphChannel => entry !== null)
    : fallback.graph.channels;

  const functions = Array.isArray(graphPayload.functions)
    ? graphPayload.functions
        .map((entry) => {
          if (!isObject(entry)) {
            return null;
          }
          const id = typeof entry.id === "string" ? entry.id : "";
          if (!id) {
            return null;
          }
          return {
            id,
            name: typeof entry.name === "string" ? entry.name : id,
            enabled: Boolean(entry.enabled),
            sync: Boolean(entry.sync),
            lastRunStatus: typeof entry.lastRunStatus === "string" ? entry.lastRunStatus : "unknown",
          } as SwarmGraphFunction;
        })
        .filter((entry): entry is SwarmGraphFunction => entry !== null)
    : fallback.graph.functions;

  const events = Array.isArray(graphPayload.events)
    ? graphPayload.events
        .map((entry) => {
          if (!isObject(entry)) {
            return null;
          }
          const id = typeof entry.id === "string" ? entry.id : "";
          if (!id) {
            return null;
          }
          return {
            id,
            type: typeof entry.type === "string" ? entry.type : "onMessage",
            channelId: typeof entry.channelId === "string" ? entry.channelId : "",
            message: typeof entry.message === "string" ? entry.message : "",
            speaker: typeof entry.speaker === "string" ? entry.speaker : undefined,
            functionId: typeof entry.functionId === "string" || entry.functionId === null ? entry.functionId : undefined,
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
          } as SwarmGraphEvent;
        })
        .filter((entry): entry is SwarmGraphEvent => entry !== null)
    : fallback.graph.events;

  return {
    source,
    feature,
    graph: {
      maxRounds: Number.isFinite(Number(graphPayload.maxRounds)) ? Number(graphPayload.maxRounds) : fallback.graph.maxRounds,
      currentRound: Number.isFinite(Number(graphPayload.currentRound)) ? Number(graphPayload.currentRound) : fallback.graph.currentRound,
      activeChannelId: typeof graphPayload.activeChannelId === "string" ? graphPayload.activeChannelId : fallback.graph.activeChannelId,
      terminated: Boolean(graphPayload.terminated),
      lastMessage: typeof graphPayload.lastMessage === "string" ? graphPayload.lastMessage : fallback.graph.lastMessage,
      updatedAt: typeof graphPayload.updatedAt === "string" ? graphPayload.updatedAt : new Date().toISOString(),
      channels,
      functions,
      events,
    },
    updatedAt,
  };
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const payload = await response.json();
    if (isObject(payload) && typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // keep generic message
  }
  throw new Error(message);
}

export async function fetchSwarmOverview(fallback: SwarmOverviewSnapshot): Promise<SwarmOverviewSnapshot> {
  try {
    const response = await fetch("/api/ai/swarm/overview", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeOverview(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function fetchSwarmCapabilities(fallback: SwarmCapabilitiesSnapshot): Promise<SwarmCapabilitiesSnapshot> {
  try {
    const response = await fetch("/api/ai/swarm/capabilities", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeCapabilities(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function patchSwarmCapabilities(
  patch: Partial<SwarmCapabilities>,
  fallback: SwarmCapabilitiesSnapshot,
): Promise<SwarmCapabilitiesSnapshot> {
  const response = await fetch("/api/ai/swarm/capabilities", {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const payload = await response.json();
  return normalizeCapabilities(payload, fallback);
}

export async function queueSwarmDelegation(request: SwarmDelegationRequest): Promise<SwarmDelegationRecord> {
  const response = await fetch("/api/ai/swarm/delegate", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const payload = await response.json();
  const record = normalizeDelegationRecord(payload);
  if (!record) {
    throw new Error("Invalid delegation response payload.");
  }
  return record;
}

export async function fetchSwarmRuns(fallback: SwarmRunsSnapshot): Promise<SwarmRunsSnapshot> {
  try {
    const response = await fetch("/api/ai/swarm/runs", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeRuns(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function fetchSwarmClarification(fallback: SwarmClarificationSnapshot): Promise<SwarmClarificationSnapshot> {
  try {
    const response = await fetch("/api/ai/swarm/clarification", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeClarification(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function patchSwarmClarification(
  patch: { enabled?: boolean; maxRounds?: number; question?: string },
  fallback: SwarmClarificationSnapshot,
): Promise<SwarmClarificationSnapshot> {
  const response = await fetch("/api/ai/swarm/clarification", {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const payload = await response.json();
  return normalizeClarification(payload, fallback);
}

export async function respondSwarmClarification(
  payload: { action: "answer" | "approve" | "reject" | "skip"; response?: string },
  fallback: SwarmClarificationSnapshot,
): Promise<SwarmClarificationSnapshot> {
  const response = await fetch("/api/ai/swarm/clarification/respond", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const body = await response.json();
  return normalizeClarification(body, fallback);
}

export async function fetchSwarmGraph(fallback: SwarmGraphSnapshot): Promise<SwarmGraphSnapshot> {
  try {
    const response = await fetch("/api/ai/swarm/graph", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeGraph(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function patchSwarmGraph(
  patch: { maxRounds?: number; activeChannelId?: string; terminate?: boolean },
  fallback: SwarmGraphSnapshot,
): Promise<SwarmGraphSnapshot> {
  const response = await fetch("/api/ai/swarm/graph", {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const payload = await response.json();
  return normalizeGraph(payload, fallback);
}

export async function appendSwarmGraphMessage(
  payload: { channelId: string; speaker: string; message: string; functionId?: string; skipHandleExecution?: boolean },
  fallback: SwarmGraphSnapshot,
): Promise<SwarmGraphSnapshot> {
  const response = await fetch("/api/ai/swarm/graph/message", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const body = await response.json();
  return normalizeGraph(body, fallback);
}
