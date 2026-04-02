/**
 * @license INTERNAL ONLY — Agent surfaces
 *
 * Contract
 * Inputs:
 *   - Mock agentProfiles, agentActivity, and mcpServers datasets (read-only)
 * Outputs:
 *   - JSX layouts for the agent roster dashboard and computer-as-tool controls
 * Error modes:
 *   - None; components render defensive fallbacks when datasets are empty
 * Performance:
 *   - time: render-only; memory: bounded by mock array lengths
 * Side effects:
 *   - None; pure presentational surfaces
 *
 * Why: Mirror the legacy organizer dashboard inside Nova before wiring live data.
 * What: Render agent roster summaries, recent activity, and MCP control panels using mock data.
 * How: Compose responsive cards with scrollable sections and badge status cues that align with the shell layout.
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  agentActivity as mockAgentActivity,
  agentProfiles as mockAgentProfiles,
  mcpServers as mockMcpServers,
  type AgentActivityEntry,
  type AgentProfile,
  type MCPServerRow,
} from "@/modules/data/mockWorkspace";
import {
  appendSwarmGraphMessage,
  fetchSwarmClarification,
  fetchSwarmGraph,
  fetchSwarmRuns,
  fetchSwarmOverview,
  patchSwarmClarification,
  patchSwarmGraph,
  respondSwarmClarification,
  queueSwarmDelegation,
  type SwarmClarificationSnapshot,
  type SwarmDelegationRecord,
  type SwarmGraphSnapshot,
  type SwarmOverviewSnapshot,
  type SwarmRunsSnapshot,
} from "@/modules/agents/swarmClient";
import {
  fetchComputerRuntime,
  patchComputerRuntime,
  type ComputerRuntime,
  type ComputerRuntimeSnapshot,
} from "@/modules/agents/computerRuntimeClient";
import {
  completeMcpOAuth,
  disconnectMcpOAuth,
  fetchMcpServers,
  fetchMcpOAuthState,
  initiateMcpOAuth,
  reconnectMcpServer,
  toggleMcpServer,
  type McpOAuthState,
} from "@/modules/agents/mcpRegistryClient";
import {
  BookOpen,
  Bot,
  ClipboardList,
  KeyRound,
  Play,
  Plug,
  RefreshCw,
  ShieldCheck,
  MessageCircleQuestion,
} from "lucide-react";

function getOverviewFallback(): SwarmOverviewSnapshot {
  return {
    source: "fallback",
    feature: { enabled: true, mode: "mock", wiring: "fallback" },
    agents: mockAgentProfiles,
    activity: mockAgentActivity,
    mcpServers: mockMcpServers,
    updatedAt: new Date().toISOString(),
  };
}

function getRunsFallback(): SwarmRunsSnapshot {
  return {
    source: "fallback",
    feature: { enabled: true, mode: "mock", wiring: "fallback" },
    runs: [],
    updatedAt: new Date().toISOString(),
  };
}

function getClarificationFallback(): SwarmClarificationSnapshot {
  return {
    source: "fallback",
    feature: { enabled: true, mode: "mock", wiring: "fallback" },
    clarification: {
      enabled: true,
      roundsUsed: 0,
      maxRounds: 3,
      isComplete: false,
      pendingQuestion: "",
      lastResponse: "",
      updatedAt: new Date().toISOString(),
      history: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function getGraphFallback(): SwarmGraphSnapshot {
  return {
    source: "fallback",
    feature: { enabled: true, mode: "mock", wiring: "fallback" },
    graph: {
      maxRounds: 8,
      currentRound: 0,
      activeChannelId: "",
      terminated: false,
      lastMessage: "",
      updatedAt: new Date().toISOString(),
      channels: [],
      functions: [],
      events: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function getComputerRuntimeFallback(): ComputerRuntimeSnapshot {
  return {
    source: "fallback",
    feature: { enabled: true, mode: "mock", wiring: "fallback" },
    runtime: {
      shellInterface: "local",
      codeExecSshEnabled: false,
      codeExecSshAddr: "localhost",
      codeExecSshPort: 55022,
      codeExecSshUser: "root",
      codeExecSshHasPassword: false,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

function copyRuntime(runtime: ComputerRuntime): ComputerRuntime {
  return { ...runtime };
}

export function AgentsSurface(): JSX.Element {
  const [overview, setOverview] = useState<SwarmOverviewSnapshot>(() => getOverviewFallback());
  const [runsSnapshot, setRunsSnapshot] = useState<SwarmRunsSnapshot>(() => getRunsFallback());
  const [clarificationSnapshot, setClarificationSnapshot] = useState<SwarmClarificationSnapshot>(() => getClarificationFallback());
  const [graphSnapshot, setGraphSnapshot] = useState<SwarmGraphSnapshot>(() => getGraphFallback());
  const [loading, setLoading] = useState(true);
  const [delegateMission, setDelegateMission] = useState("");
  const [delegateTargetAgentId, setDelegateTargetAgentId] = useState("agent-manager");
  const [delegateRequireApproval, setDelegateRequireApproval] = useState(true);
  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [lastDelegation, setLastDelegation] = useState<SwarmDelegationRecord | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [clarificationPending, setClarificationPending] = useState(false);
  const [clarificationError, setClarificationError] = useState<string | null>(null);
  const [graphMessage, setGraphMessage] = useState("");
  const [graphChannelId, setGraphChannelId] = useState("");
  const [graphSpeaker, setGraphSpeaker] = useState("agent-manager");
  const [graphPending, setGraphPending] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  async function reloadOverview() {
    const [snapshot, runs, clarification, graph] = await Promise.all([
      fetchSwarmOverview(getOverviewFallback()),
      fetchSwarmRuns(getRunsFallback()),
      fetchSwarmClarification(getClarificationFallback()),
      fetchSwarmGraph(getGraphFallback()),
    ]);
    setOverview(snapshot);
    setRunsSnapshot(runs);
    setClarificationSnapshot(clarification);
    setGraphSnapshot(graph);
    setGraphChannelId((current) => current || graph.graph.activeChannelId || graph.graph.channels[0]?.id || "");
    setLoading(false);
    return snapshot;
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [snapshot, runs, clarification, graph] = await Promise.all([
        fetchSwarmOverview(getOverviewFallback()),
        fetchSwarmRuns(getRunsFallback()),
        fetchSwarmClarification(getClarificationFallback()),
        fetchSwarmGraph(getGraphFallback()),
      ]);
      if (!mounted) {
        return;
      }
      setOverview(snapshot);
      setRunsSnapshot(runs);
      setClarificationSnapshot(clarification);
      setGraphSnapshot(graph);
      setGraphChannelId(graph.graph.activeChannelId || graph.graph.channels[0]?.id || "");
      const preferredAgent = snapshot.agents[0]?.id ?? "agent-manager";
      setDelegateTargetAgentId((current) => current || preferredAgent);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const agentProfiles = overview.agents;
  const agentActivity = overview.activity;
  const swarmRuns = runsSnapshot.runs;
  const clarification = clarificationSnapshot.clarification;
  const graph = graphSnapshot.graph;
  const sourceLabel = overview.source === "fallback" ? "Fallback mock" : `Backend ${overview.source}`;

  const totals = useMemo(() => {
    const running = agentProfiles.filter((agent) => agent.status === "running").length;
    const idle = agentProfiles.filter((agent) => agent.status === "idle").length;
    const paused = agentProfiles.filter((agent) => agent.status === "paused").length;
    const missions = agentProfiles.reduce((count, agent) => count + agent.missionCount, 0);
    return { running, idle, paused, missions };
  }, [agentProfiles]);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    agentProfiles.forEach((agent) => map.set(agent.id, agent.name));
    return map;
  }, [agentProfiles]);

  async function handleDelegateSubmit() {
    const mission = delegateMission.trim();
    if (!mission) {
      setDelegateError("Mission text is required.");
      return;
    }
    setDelegating(true);
    setDelegateError(null);
    try {
      const record = await queueSwarmDelegation({
        mission,
        targetAgentId: delegateTargetAgentId,
        requireApproval: delegateRequireApproval,
      });
      setLastDelegation(record);
      setDelegateMission("");
      const snapshot = await reloadOverview();
      if (snapshot.agents.length > 0 && !snapshot.agents.some((agent) => agent.id === delegateTargetAgentId)) {
        setDelegateTargetAgentId(snapshot.agents[0]?.id ?? "agent-manager");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to queue delegation.";
      setDelegateError(message);
    } finally {
      setDelegating(false);
    }
  }

  async function handleClarificationResponse(action: "answer" | "approve" | "reject" | "skip") {
    setClarificationPending(true);
    setClarificationError(null);
    try {
      const next = await respondSwarmClarification(
        { action, response: clarificationResponse },
        getClarificationFallback(),
      );
      setClarificationSnapshot(next);
      if (action === "answer") {
        setClarificationResponse("");
      }
      await reloadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to respond to clarification.";
      setClarificationError(message);
    } finally {
      setClarificationPending(false);
    }
  }

  async function handleClarificationToggle(enabled: boolean) {
    setClarificationPending(true);
    setClarificationError(null);
    try {
      const next = await patchSwarmClarification({ enabled }, getClarificationFallback());
      setClarificationSnapshot(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update clarification settings.";
      setClarificationError(message);
    } finally {
      setClarificationPending(false);
    }
  }

  async function handleClarificationRounds(maxRounds: number) {
    setClarificationPending(true);
    setClarificationError(null);
    try {
      const next = await patchSwarmClarification({ maxRounds }, getClarificationFallback());
      setClarificationSnapshot(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update clarification rounds.";
      setClarificationError(message);
    } finally {
      setClarificationPending(false);
    }
  }

  async function handleGraphRounds(maxRounds: number) {
    setGraphPending(true);
    setGraphError(null);
    try {
      const next = await patchSwarmGraph({ maxRounds }, getGraphFallback());
      setGraphSnapshot(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update graph rounds.";
      setGraphError(message);
    } finally {
      setGraphPending(false);
    }
  }

  async function handleGraphTerminate() {
    setGraphPending(true);
    setGraphError(null);
    try {
      const next = await patchSwarmGraph({ terminate: true }, getGraphFallback());
      setGraphSnapshot(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to terminate graph.";
      setGraphError(message);
    } finally {
      setGraphPending(false);
    }
  }

  async function handleGraphMessage() {
    const message = graphMessage.trim();
    if (!message || !graphChannelId.trim() || !graphSpeaker.trim()) {
      setGraphError("Channel, speaker, and message are required.");
      return;
    }
    setGraphPending(true);
    setGraphError(null);
    try {
      const next = await appendSwarmGraphMessage(
        { channelId: graphChannelId.trim(), speaker: graphSpeaker.trim(), message },
        getGraphFallback(),
      );
      setGraphSnapshot(next);
      setGraphMessage("");
      await reloadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to append graph message.";
      setGraphError(message);
    } finally {
      setGraphPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Agent roster</p>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Automation lineup</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="px-2 text-[10px] uppercase tracking-[0.2em]">
              {agentProfiles.length} agents
            </Badge>
            <Badge variant="secondary" className="px-2 text-[10px] uppercase tracking-[0.2em]">
              {sourceLabel}
            </Badge>
            <span>Running {totals.running}</span>
            <span>Idle {totals.idle}</span>
            <span className="hidden sm:inline">Paused {totals.paused}</span>
            <span className="hidden sm:inline">Active missions {totals.missions}</span>
            <span className="hidden sm:inline">{loading ? "Syncing…" : "Synced"}</span>
          </div>
        </header>

        <section className="grid gap-4 grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="flex min-h-0 flex-col border-border/60 bg-background/70">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4" /> Agent roster
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Review autonomy, tooling, and current mission load.
                </CardDescription>
              </div>
              <Button size="sm" variant="secondary">
                <ClipboardList className="mr-1 h-4 w-4" /> Queue mission
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              {agentProfiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No agents registered. Create one from the CLI to populate this list.
                </div>
              ) : (
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-3">
                    {agentProfiles.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="flex min-h-0 flex-col border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Latest activity</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-2">
                    {agentActivity.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No recent events.</p>
                    ) : (
                      agentActivity.map((entry) => (
                        <AgentActivityRow
                          key={entry.id}
                          entry={entry}
                          agentName={agentNameById.get(entry.agentId) ?? entry.agentId}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">Guardrail summary</CardTitle>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.18em]">
                  Guarded
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>All agents operate under guarded autonomy. Approvals required for network and Git operations.</p>
                <p className="text-xs text-muted-foreground/90">Adjust guardrails from the computer-as-tool surface.</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageCircleQuestion className="h-4 w-4" /> Clarification loop
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Deerflow-style clarification rounds before execution handoff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs">
                  <span>Enabled</span>
                  <Switch
                    checked={clarification.enabled}
                    disabled={clarificationPending}
                    onCheckedChange={(value) => {
                      void handleClarificationToggle(value);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Max rounds</p>
                  <Select
                    value={String(clarification.maxRounds)}
                    onValueChange={(value) => {
                      void handleClarificationRounds(Number(value));
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rounds used {clarification.roundsUsed}/{clarification.maxRounds}
                </p>
                {clarification.pendingQuestion ? (
                  <div className="rounded-md border border-border/60 bg-background/60 px-2 py-2 text-xs text-foreground">
                    {clarification.pendingQuestion}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No pending clarification question.</p>
                )}
                <Textarea
                  value={clarificationResponse}
                  onChange={(event) => setClarificationResponse(event.target.value)}
                  placeholder="Answer clarification question"
                  className="min-h-[72px] text-xs"
                  disabled={clarificationPending || !clarification.pendingQuestion}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={clarificationPending || !clarification.pendingQuestion}
                    onClick={() => {
                      void handleClarificationResponse("answer");
                    }}
                  >
                    Submit answer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={clarificationPending || !clarification.pendingQuestion}
                    onClick={() => {
                      void handleClarificationResponse("approve");
                    }}
                  >
                    Approve
                  </Button>
                </div>
                {clarificationError ? <p className="text-xs text-destructive">{clarificationError}</p> : null}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Delegation workbench</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Queue a mission into the swarm manager contract and refresh activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={delegateMission}
                  onChange={(event) => setDelegateMission(event.target.value)}
                  placeholder="e.g. Draft implementation notes for MCP retry policy"
                  className="min-h-[88px] text-xs"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Target agent</p>
                    <Select value={delegateTargetAgentId} onValueChange={setDelegateTargetAgentId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentProfiles.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end rounded-md border border-border/60 px-3 py-2">
                    <label className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Require approval</span>
                      <Switch checked={delegateRequireApproval} onCheckedChange={setDelegateRequireApproval} />
                    </label>
                  </div>
                </div>
                {delegateError ? <p className="text-xs text-destructive">{delegateError}</p> : null}
                {lastDelegation ? (
                  <p className="text-[11px] text-muted-foreground">
                    Last queue: <span className="font-medium text-foreground">{lastDelegation.status}</span> • {lastDelegation.targetAgentId}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={delegating}
                  onClick={() => {
                    void handleDelegateSubmit();
                  }}
                >
                  <Play className="mr-1 h-4 w-4" /> {delegating ? "Queueing…" : "Queue delegation"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Run state machine</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Mock-first swarm run snapshots to verify orchestration semantics before live wiring.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {swarmRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No run snapshots yet.</p>
                ) : (
                  <div className="space-y-2">
                    {swarmRuns.slice(0, 4).map((run) => (
                      <div key={run.id} className="rounded-md border border-border/60 px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-foreground">{run.mission}</p>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                            {run.state}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{run.targetAgentId}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          todo {run.plan.todo.length} · active {run.plan.inProgress.length} · done {run.plan.done.length}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Channel/function graph</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Anything-LLM style channel and function orchestration with max-round guardrail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Rounds {graph.currentRound}/{graph.maxRounds} · channel {graph.activeChannelId || "none"} · terminated {String(graph.terminated)}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Max rounds</p>
                    <Select
                      value={String(graph.maxRounds)}
                      onValueChange={(value) => {
                        void handleGraphRounds(Number(value));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 6, 8, 10, 12].map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Channel</p>
                    <Select value={graphChannelId} onValueChange={setGraphChannelId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {graph.channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input
                  value={graphSpeaker}
                  onChange={(event) => setGraphSpeaker(event.target.value)}
                  placeholder="Speaker id"
                  className="h-8 text-xs"
                  disabled={graphPending}
                />
                <Textarea
                  value={graphMessage}
                  onChange={(event) => setGraphMessage(event.target.value)}
                  placeholder="Channel message"
                  className="min-h-[72px] text-xs"
                  disabled={graphPending}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={graphPending}
                    onClick={() => {
                      void handleGraphMessage();
                    }}
                  >
                    Append message
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={graphPending || graph.terminated}
                    onClick={() => {
                      void handleGraphTerminate();
                    }}
                  >
                    Terminate graph
                  </Button>
                </div>
                <div className="space-y-1">
                  {graph.channels.slice(0, 2).map((channel) => (
                    <p key={channel.id} className="text-[11px] text-muted-foreground">
                      {channel.name}: {channel.roundsUsed}/{channel.maxRounds} · {channel.status}
                    </p>
                  ))}
                </div>
                {graphError ? <p className="text-xs text-destructive">{graphError}</p> : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentProfile }) {
  const statusTone = resolveStatusTone(agent.status);
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{agent.name}</p>
          <p className="text-xs text-muted-foreground">Persona {agent.persona}</p>
        </div>
        <Badge variant={statusTone.variant} className={statusTone.className}>
          {statusTone.label}
        </Badge>
      </div>
      <Separator className="my-3" />
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Model <span className="font-medium text-foreground">{agent.model}</span></span>
        <span>Missions <span className="font-medium text-foreground">{agent.missionCount}</span></span>
        <span>Autonomy <span className="font-medium text-foreground">{agent.autonomy}</span></span>
        <span>Last run <span className="font-medium text-foreground">{agent.lastRunAgo}</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {agent.tools.map((tool) => (
          <Badge key={tool} variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
            {tool}
          </Badge>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 text-xs">
        <Button size="sm" variant="secondary">
          <Play className="mr-1 h-3.5 w-3.5" /> Run plan
        </Button>
        <Button size="sm" variant="ghost">
          <ClipboardList className="mr-1 h-3.5 w-3.5" /> Queue task
        </Button>
      </div>
    </div>
  );
}

function AgentActivityRow({ entry, agentName }: { entry: AgentActivityEntry; agentName: string }) {
  const tone = resolveActivityTone(entry.status);
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="font-semibold text-foreground">{agentName}</span>
        <span>{entry.timestampAgo}</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{entry.summary}</p>
      <Badge variant={tone.variant} className={`mt-2 text-[10px] uppercase tracking-[0.2em] ${tone.className ?? ""}`}>
        {tone.label}
      </Badge>
    </div>
  );
}

function resolveStatusTone(status: AgentProfile["status"]): { readonly label: string; readonly variant: "secondary" | "outline" | "destructive"; readonly className?: string } {
  if (status === "running") {
    return { label: "Running", variant: "secondary", className: "text-emerald-300" };
  }
  if (status === "paused") {
    return { label: "Paused", variant: "outline", className: "text-amber-300" };
  }
  return { label: "Idle", variant: "outline" };
}

function resolveActivityTone(status: AgentActivityEntry["status"]): { readonly label: string; readonly variant: "secondary" | "outline" | "destructive"; readonly className?: string } {
  switch (status) {
    case "success":
      return { label: "Success", variant: "secondary", className: "text-emerald-300" };
    case "warning":
      return { label: "Pending", variant: "outline", className: "text-amber-300" };
    case "error":
      return { label: "Issue", variant: "destructive" };
    default:
      return { label: status, variant: "outline" };
  }
}

export function ComputerAsToolSurface(): JSX.Element {
  const [runtimeSource, setRuntimeSource] = useState("fallback");
  const [runtime, setRuntime] = useState<ComputerRuntime>(() =>
    copyRuntime(getComputerRuntimeFallback().runtime),
  );
  const [savedRuntime, setSavedRuntime] = useState<ComputerRuntime>(() =>
    copyRuntime(getComputerRuntimeFallback().runtime),
  );
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeNote, setRuntimeNote] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const snapshot = await fetchComputerRuntime(getComputerRuntimeFallback());
      if (!mounted) {
        return;
      }
      setRuntimeSource(snapshot.source === "fallback" ? "Fallback mock" : `Backend ${snapshot.source}`);
      setRuntime(copyRuntime(snapshot.runtime));
      setSavedRuntime(copyRuntime(snapshot.runtime));
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const hasRuntimeChanges = useMemo(
    () =>
      runtime.shellInterface !== savedRuntime.shellInterface ||
      runtime.codeExecSshEnabled !== savedRuntime.codeExecSshEnabled ||
      runtime.codeExecSshAddr !== savedRuntime.codeExecSshAddr ||
      runtime.codeExecSshPort !== savedRuntime.codeExecSshPort ||
      runtime.codeExecSshUser !== savedRuntime.codeExecSshUser,
    [runtime, savedRuntime],
  );

  async function handleSaveRuntime() {
    setSavingRuntime(true);
    setRuntimeError(null);
    setRuntimeNote(null);
    try {
      const snapshot = await patchComputerRuntime(
        {
          shellInterface: runtime.shellInterface,
          codeExecSshEnabled: runtime.codeExecSshEnabled,
          codeExecSshAddr: runtime.codeExecSshAddr,
          codeExecSshPort: runtime.codeExecSshPort,
          codeExecSshUser: runtime.codeExecSshUser,
        },
        getComputerRuntimeFallback(),
      );
      const next = copyRuntime(snapshot.runtime);
      setRuntime(next);
      setSavedRuntime(next);
      setRuntimeSource(snapshot.source === "fallback" ? "Fallback mock" : `Backend ${snapshot.source}`);
      setRuntimeNote("Runtime settings saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save capabilities.";
      setRuntimeError(message);
    } finally {
      setSavingRuntime(false);
    }
  }

  function handleResetRuntime() {
    setRuntime(copyRuntime(savedRuntime));
    setRuntimeError(null);
    setRuntimeNote(null);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Computer machine</p>
          <h1 className="text-xl font-semibold text-foreground">Execution runtime</h1>
        </header>
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Machine runtime</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Agent Zero-aligned shell execution settings (`shell_interface` + `code_exec_ssh_*`).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Shell interface</label>
                <Select
                  value={runtime.shellInterface}
                  onValueChange={(value: "local" | "ssh") =>
                    setRuntime((current) => ({
                      ...current,
                      shellInterface: value,
                      codeExecSshEnabled: value === "ssh",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Python TTY</SelectItem>
                    <SelectItem value="ssh">SSH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ToggleRow
                label="SSH execution enabled"
                checked={runtime.codeExecSshEnabled}
                onCheckedChange={(value) =>
                  setRuntime((current) => ({
                    ...current,
                    codeExecSshEnabled: value,
                    shellInterface: value ? "ssh" : "local",
                  }))
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SSH host</p>
                  <Input
                    value={runtime.codeExecSshAddr}
                    onChange={(event) => setRuntime((current) => ({ ...current, codeExecSshAddr: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SSH port</p>
                  <Input
                    type="number"
                    value={String(runtime.codeExecSshPort)}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setRuntime((current) => ({
                        ...current,
                        codeExecSshPort: Number.isInteger(parsed) ? parsed : current.codeExecSshPort,
                      }));
                    }}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SSH user</p>
                  <Input
                    value={runtime.codeExecSshUser}
                    onChange={(event) => setRuntime((current) => ({ ...current, codeExecSshUser: event.target.value }))}
                  />
                </div>
              </div>

              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Runtime source: {runtimeSource}</p>
              {runtimeError ? <p className="text-xs text-destructive">{runtimeError}</p> : null}
              {runtimeNote ? <p className="text-xs text-emerald-300">{runtimeNote}</p> : null}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" disabled={!hasRuntimeChanges || savingRuntime} onClick={handleResetRuntime}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!hasRuntimeChanges || savingRuntime}
                  onClick={() => {
                    void handleSaveRuntime();
                  }}
                >
                  {savingRuntime ? "Saving…" : "Save runtime"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Surface boundary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                Computer machine settings only manage execution transport and SSH runtime.
              </div>
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                Browser automation remains in Browser surfaces/tools. Code execution remains in terminal/code tools. MCP remains in MCP registry.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export function McpRegistrySurface(): JSX.Element {
  const [mcpServers, setMcpServers] = useState<readonly MCPServerRow[]>(mockMcpServers);
  const [mcpSource, setMcpSource] = useState("Fallback mock");
  const [oauthStates, setOauthStates] = useState<Record<string, McpOAuthState>>({});
  const [mcpBusyId, setMcpBusyId] = useState<string | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpNote, setMcpNote] = useState<string | null>(null);

  const resolveOauthState = useMemo(() => {
    return (serverId: string): McpOAuthState => {
      const state = oauthStates[serverId];
      if (state) {
        return state;
      }
      return {
        required: false,
        status: "not_required",
        hasRefreshToken: false,
        state: null,
        authorizationUrl: null,
        expiresAt: null,
        lastConnectedAt: null,
        updatedAt: new Date().toISOString(),
      };
    };
  }, [oauthStates]);

  function updateOauthState(serverId: string, oauth: McpOAuthState) {
    setOauthStates((current) => ({ ...current, [serverId]: oauth }));
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const snapshot = await fetchMcpServers(mockMcpServers);
      if (!mounted) {
        return;
      }
      const nextServers = snapshot.servers.length > 0 ? snapshot.servers : mockMcpServers;
      setMcpServers(nextServers);
      setMcpSource(snapshot.source === "fallback" ? "Fallback mock" : `Backend ${snapshot.source}`);
      const entries = await Promise.all(
        nextServers.map(async (server) => {
          try {
            const oauthPayload = await fetchMcpOAuthState(server.id);
            return [server.id, oauthPayload.oauth];
          } catch {
            return [
              server.id,
              {
                required: false,
                status: "not_required",
                hasRefreshToken: false,
                state: null,
                authorizationUrl: null,
                expiresAt: null,
                lastConnectedAt: null,
                updatedAt: new Date().toISOString(),
              },
            ];
          }
        }),
      );
      if (!mounted) {
        return;
      }
      setOauthStates(Object.fromEntries(entries));
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleToggleServer(serverId: string, enabled: boolean) {
    setMcpBusyId(serverId);
    setMcpError(null);
    setMcpNote(null);
    try {
      const payload = await toggleMcpServer(serverId, enabled);
      setMcpServers((current) => current.map((server) => (server.id === payload.server.id ? payload.server : server)));
      setMcpSource(payload.source === "fallback" ? "Fallback mock" : `Backend ${payload.source}`);
      setMcpNote(`${payload.server.name} set to ${payload.server.status}.`);
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : "Failed to update MCP server.");
    } finally {
      setMcpBusyId(null);
    }
  }

  async function handleReconnectServer(serverId: string) {
    setMcpBusyId(serverId);
    setMcpError(null);
    setMcpNote(null);
    try {
      const payload = await reconnectMcpServer(serverId);
      setMcpServers((current) => current.map((server) => (server.id === payload.server.id ? payload.server : server)));
      setMcpSource(payload.source === "fallback" ? "Fallback mock" : `Backend ${payload.source}`);
      setMcpNote(`${payload.server.name} reconnected.`);
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : "Failed to reconnect MCP server.");
    } finally {
      setMcpBusyId(null);
    }
  }

  async function handleInitiateOAuth(serverId: string) {
    setMcpBusyId(serverId);
    setMcpError(null);
    setMcpNote(null);
    try {
      const payload = await initiateMcpOAuth(serverId);
      updateOauthState(payload.serverId, payload.oauth);
      setMcpSource(payload.source === "fallback" ? "Fallback mock" : `Backend ${payload.source}`);
      setMcpNote(`OAuth flow started for ${serverId}.`);
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : "Failed to initiate MCP OAuth.");
    } finally {
      setMcpBusyId(null);
    }
  }

  async function handleCompleteOAuth(serverId: string) {
    const oauth = resolveOauthState(serverId);
    if (!oauth.state) {
      setMcpError('OAuth state is missing. Initiate OAuth first.');
      return;
    }
    setMcpBusyId(serverId);
    setMcpError(null);
    setMcpNote(null);
    try {
      const payload = await completeMcpOAuth(serverId, 'mock-oauth-code', oauth.state);
      updateOauthState(payload.serverId, payload.oauth);
      setMcpSource(payload.source === "fallback" ? "Fallback mock" : `Backend ${payload.source}`);
      setMcpNote(`OAuth connected for ${serverId}.`);
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : "Failed to complete MCP OAuth callback.");
    } finally {
      setMcpBusyId(null);
    }
  }

  async function handleDisconnectOAuth(serverId: string) {
    setMcpBusyId(serverId);
    setMcpError(null);
    setMcpNote(null);
    try {
      const payload = await disconnectMcpOAuth(serverId);
      updateOauthState(payload.serverId, payload.oauth);
      setMcpSource(payload.source === "fallback" ? "Fallback mock" : `Backend ${payload.source}`);
      setMcpNote(`OAuth disconnected for ${serverId}.`);
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : "Failed to disconnect MCP OAuth.");
    } finally {
      setMcpBusyId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">MCP</p>
          <h1 className="text-xl font-semibold text-foreground">Registry & connectivity</h1>
        </header>

        <Card className="border-border/60 bg-background/70">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plug className="h-4 w-4" /> Registered MCP servers
            </CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
              {mcpServers.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Registry source: {mcpSource}</p>
            {mcpError ? <p className="text-xs text-destructive">{mcpError}</p> : null}
            {mcpNote ? <p className="text-xs text-emerald-300">{mcpNote}</p> : null}
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{server.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {server.endpoints.length} endpoints · {server.status}
                  </p>
                  {resolveOauthState(server.id).required ? (
                    <p className="text-xs text-muted-foreground">
                      OAuth {resolveOauthState(server.id).status}
                      {resolveOauthState(server.id).hasRefreshToken ? " · refresh token" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase tracking-[0.16em]">Online</span>
                    <Switch
                      checked={server.status === "online"}
                      disabled={mcpBusyId === server.id}
                      onCheckedChange={(value) => {
                        void handleToggleServer(server.id, value);
                      }}
                    />
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Reconnect ${server.name}`}
                        disabled={mcpBusyId === server.id}
                        onClick={() => {
                          void handleReconnectServer(server.id);
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reconnect</TooltipContent>
                  </Tooltip>
                  {resolveOauthState(server.id).required ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`OAuth action for ${server.name}`}
                          disabled={mcpBusyId === server.id}
                          onClick={() => {
                            const oauth = resolveOauthState(server.id);
                            if (oauth.status === "connected") {
                              void handleDisconnectOAuth(server.id);
                              return;
                            }
                            if (oauth.status === "pending") {
                              void handleCompleteOAuth(server.id);
                              return;
                            }
                            void handleInitiateOAuth(server.id);
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {resolveOauthState(server.id).status === "connected"
                          ? "Disconnect OAuth"
                          : resolveOauthState(server.id).status === "pending"
                            ? "Complete OAuth callback"
                            : "Initiate OAuth flow"}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={`View ${server.name} docs`}>
                        <BookOpen className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View docs</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="pr-3 text-xs sm:text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
