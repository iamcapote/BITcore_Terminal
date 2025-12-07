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

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  agentActivity,
  agentProfiles,
  mcpServers,
  type AgentActivityEntry,
  type AgentProfile,
} from "@/modules/data/mockWorkspace";
import {
  AlertCircle,
  BookOpen,
  Bot,
  ClipboardList,
  Monitor,
  Play,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function AgentsSurface(): JSX.Element {
  const totals = useMemo(() => {
    const running = agentProfiles.filter((agent) => agent.status === "running").length;
    const idle = agentProfiles.filter((agent) => agent.status === "idle").length;
    const paused = agentProfiles.filter((agent) => agent.status === "paused").length;
    const missions = agentProfiles.reduce((count, agent) => count + agent.missionCount, 0);
    return { running, idle, paused, missions };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Agent roster</p>
            <h1 className="text-2xl font-semibold text-foreground">Automation lineup</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="px-2 text-[10px] uppercase tracking-[0.2em]">
              {agentProfiles.length} agents
            </Badge>
            <span>Running {totals.running}</span>
            <span>Idle {totals.idle}</span>
            <span>Paused {totals.paused}</span>
            <span>Active missions {totals.missions}</span>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="border-border/60 bg-background/70">
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
            <CardContent>
              {agentProfiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No agents registered. Create one from the CLI to populate this list.
                </div>
              ) : (
                <ScrollArea className="max-h-[28rem] pr-2">
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
            <Card className="border-border/60 bg-background/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Latest activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-60 pr-2">
                  <div className="space-y-2">
                    {agentActivity.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No recent events.</p>
                    ) : (
                      agentActivity.map((entry) => (
                        <AgentActivityRow key={entry.id} entry={entry} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70">
              <CardHeader className="flex items-center justify-between pb-2">
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

function AgentActivityRow({ entry }: { entry: AgentActivityEntry }) {
  const tone = resolveActivityTone(entry.status);
  const agent = agentProfiles.find((profile) => profile.id === entry.agentId);
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="font-semibold text-foreground">{agent?.name ?? entry.agentId}</span>
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
  const [network, setNetwork] = useState(false);
  const [downloads, setDownloads] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Computer-as-tool</p>
          <h1 className="text-xl font-semibold text-foreground">Guardrails & capabilities</h1>
        </header>
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Capabilities</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Toggle scoped access before dispatching an agent mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Capability label="Read files" defaultChecked />
              <Capability label="Write files" defaultChecked />
              <Capability label="Network access" checked={network} onCheckedChange={setNetwork} />
              <Capability label="Keyboard/Mouse" />
              <Capability label="Open apps" />
              <Capability label="Screenshots" />
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" /> Guardrail presets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ToggleRow label="Require step approval" defaultChecked />
              <ToggleRow label="Block external downloads" checked={downloads} onCheckedChange={setDownloads} />
              <ToggleRow label="Rate limit ops" />
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                Guarded preset enforces human-in-the-loop for risky operations. Update CLI config to change the default.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Monitor className="h-4 w-4" /> Audit trail
              </CardTitle>
              <Button size="sm" variant="secondary">
                <Sparkles className="mr-1 h-4 w-4" /> Export logs
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>All agent actions and tool invocations are logged for replay. Use `/logs` in the CLI to stream the same feed.</p>
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
                <span>Logs rotate every 24 hours; export before they expire.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plug className="h-4 w-4" /> Registered MCP servers
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                {mcpServers.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{server.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.endpoints.length} endpoints · {server.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Reconnect ${server.name}`}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reconnect</TooltipContent>
                    </Tooltip>
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
        </section>
      </div>
    </div>
  );
}

function Capability({
  label,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span>{label}</span>
      <Switch defaultChecked={defaultChecked} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function ToggleRow({
  label,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch defaultChecked={defaultChecked} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
