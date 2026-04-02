/**
 * Why: Workspace health dashboard displaying key operational metrics.
 * What: Card grid with live metric value and status badge per service.
 * How: Fetches /api/status/summary and /api/config on mount; renders four metric cards with real data.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Cpu, Globe, HardDrive } from "lucide-react";
import { fetchStatusSummary, fetchConfig } from "@/modules/admin/adminClient";

/* ── Types ─────────────────────────────────────────────────────────── */

interface MetricCard {
  id: string;
  label: string;
  value: string;
  status: "ok" | "warn" | "error";
  icon: typeof Activity;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function MetricsBoardSurface() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const results = await Promise.allSettled([fetchStatusSummary(), fetchConfig()]);
      if (cancelled) return;

      let statusData: Record<string, unknown> = {};
      let configData: { config: Record<string, unknown> } | null = null;
      if (results[0].status === "fulfilled") statusData = results[0].value;
      if (results[1].status === "fulfilled") configData = results[1].value;

      const cfg = (configData?.config ?? {}) as Record<string, Record<string, unknown>>;
      const hasVenice = Boolean(cfg?.venice?.apiKey);
      const hasBrave = Boolean(cfg?.brave?.apiKey);
      const uptimeMin = statusData?.uptime ? Math.round(Number(statusData.uptime) / 60) : null;
      const memMB = statusData?.memoryMB ? Number(statusData.memoryMB) : null;

      setMetrics([
        {
          id: "uptime",
          label: "Server Uptime",
          value: uptimeMin !== null ? `${uptimeMin}m` : "Running",
          status: "ok",
          icon: Activity,
        },
        {
          id: "memory",
          label: "Memory Usage",
          value: memMB !== null ? `${memMB} MB` : "N/A",
          status: memMB !== null && memMB > 800 ? "warn" : "ok",
          icon: HardDrive,
        },
        {
          id: "venice",
          label: "Venice AI",
          value: hasVenice ? "Connected" : "Not configured",
          status: hasVenice ? "ok" : "warn",
          icon: Cpu,
        },
        {
          id: "brave",
          label: "Brave Search",
          value: hasBrave ? "Connected" : "Not configured",
          status: hasBrave ? "ok" : "warn",
          icon: Globe,
        },
      ]);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.id}
            className="relative overflow-hidden border-border/60 bg-gradient-to-br from-background/80 via-background to-background/40"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10" />
            <CardContent className="relative flex h-full flex-col justify-between p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                {metric.label}
                <Badge
                  variant={metric.status === "ok" ? "default" : metric.status === "warn" ? "secondary" : "destructive"}
                  className="text-[9px]"
                >
                  {metric.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <span className="text-3xl font-semibold">{metric.value}</span>
                <Icon className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
