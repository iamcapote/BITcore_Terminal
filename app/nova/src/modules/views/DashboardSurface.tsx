/**
 * Why: Landing page that gives operators an at-a-glance view of system health, recent activity, and quick actions.
 * What: Dashboard surface with status cards, onboarding checklist, quick-action buttons, and system vitals.
 * How: Fetches /api/status, /api/config, /api/commands on mount; renders cards with live data; links to other surfaces.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Command,
  GitPullRequest,
  MessageSquare,
  Rocket,
  Search,
  Settings,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import { fetchStatusSummary, fetchConfig, type FeatureFlag } from "@/modules/admin/adminClient";

/* ── Types ─────────────────────────────────────────────────────────── */

interface SystemVital {
  label: string;
  value: string;
  status: "ok" | "warn" | "error" | "unknown";
}

interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  surfaceId?: string;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function DashboardSurface(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState<SystemVital[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results = await Promise.allSettled([fetchStatusSummary(), fetchConfig()]);
      if (cancelled) return;

      let statusData: Record<string, unknown> = {};
      let configData: { featureFlags: FeatureFlag[]; config: Record<string, unknown> } | null = null;

      if (results[0].status === "fulfilled") statusData = results[0].value;
      if (results[1].status === "fulfilled") configData = results[1].value;

      /* Derive vitals from whatever we got */
      const newVitals: SystemVital[] = [];
      const cfg = configData?.config ?? {};
      newVitals.push({ label: "Venice AI", value: (cfg as Record<string, Record<string, unknown>>)?.venice?.apiKey ? "Connected" : "Not configured", status: (cfg as Record<string, Record<string, unknown>>)?.venice?.apiKey ? "ok" : "warn" });
      newVitals.push({ label: "Brave Search", value: (cfg as Record<string, Record<string, unknown>>)?.brave?.apiKey ? "Connected" : "Not configured", status: (cfg as Record<string, Record<string, unknown>>)?.brave?.apiKey ? "ok" : "warn" });
      newVitals.push({ label: "Server", value: statusData?.uptime ? `Up ${Math.round(Number(statusData.uptime) / 60)}m` : "Running", status: "ok" });
      newVitals.push({ label: "Memory", value: statusData?.memoryMB ? `${statusData.memoryMB} MB` : "N/A", status: "ok" });
      setVitals(newVitals);

      if (configData) setFlags(configData.featureFlags);

      /* Onboarding checklist derived from config */
      const hasVenice = Boolean((cfg as Record<string, Record<string, unknown>>)?.venice?.apiKey);
      const hasBrave = Boolean((cfg as Record<string, Record<string, unknown>>)?.brave?.apiKey);
      setSteps([
        { id: "venice", label: "Configure Venice AI API key", done: hasVenice, surfaceId: "settings" },
        { id: "brave", label: "Configure Brave Search API key", done: hasBrave, surfaceId: "settings" },
        { id: "chat", label: "Send your first message", done: false, surfaceId: "chat" },
        { id: "research", label: "Run a research query", done: false, surfaceId: "research" },
        { id: "missions", label: "Create a mission", done: false, surfaceId: "missions" },
      ]);

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const doneCount = steps.filter((s) => s.done).length;

  if (loading) {
    return (
      <div className="flex h-full w-full justify-center p-6">
        <div className="w-full max-w-5xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-28" />))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full justify-center overflow-auto p-4">
      <ScrollArea className="h-full w-full max-w-5xl">
        <div className="space-y-6">

          {/* ── Header ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold">Welcome to BITcore Terminal</h2>
            <p className="text-sm text-muted-foreground">System dashboard — quick status, actions, and onboarding.</p>
          </div>

          {/* ── System vitals ────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {vitals.map((v) => (
              <Card key={v.label}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{v.label}</p>
                    <p className="text-sm font-semibold">{v.value}</p>
                  </div>
                  <Badge variant={v.status === "ok" ? "default" : v.status === "warn" ? "secondary" : "destructive"} className="text-[9px]">
                    {v.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Quick actions ────────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-400" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <QuickAction icon={MessageSquare} label="New Chat" surface="chat" />
                <QuickAction icon={Search} label="Research" surface="research" />
                <QuickAction icon={Rocket} label="Missions" surface="missions" />
                <QuickAction icon={BookOpenCheck} label="Prompts" surface="prompts" />
                <QuickAction icon={BrainCircuit} label="Memory" surface="memory" />
                <QuickAction icon={GitPullRequest} label="GitHub Sync" surface="githubSync" />
                <QuickAction icon={Terminal} label="Terminal" surface="terminal" />
                <QuickAction icon={Settings} label="Settings" surface="settings" />
              </div>
            </CardContent>
          </Card>

          {/* ── Onboarding ───────────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-emerald-400" /> Getting Started
                <Badge variant="outline" className="ml-auto text-[10px]">{doneCount}/{steps.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/40">
                  {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                  {!step.done && step.surfaceId ? (
                    <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs"><ArrowRight className="h-3 w-3" /></Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Feature flags overview ───────────────────────────── */}
          {flags.length > 0 ? (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-blue-400" /> Active Feature Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {flags.filter((f) => f.enabled).map((f) => (
                    <Badge key={f.id} variant="default" className="text-[10px]">{f.label}</Badge>
                  ))}
                  {flags.filter((f) => !f.enabled).map((f) => (
                    <Badge key={f.id} variant="secondary" className="text-[10px]">{f.label}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ── Keyboard tip ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            Use Settings to configure CLI, providers, and surface visibility.
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function QuickAction({ icon: Icon, label, surface: _surface }: { icon: typeof Zap; label: string; surface: string }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5">
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
