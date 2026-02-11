/**
 * Why: Workspace health dashboard displaying key operational metrics.
 * What: Card grid with metric value, trend badge, and decorative icon.
 * How: Reads mock workspaceMetrics data; purely presentational until metrics backend wires in.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { workspaceMetrics } from "@/modules/data/mockWorkspace";

export function MetricsBoardSurface() {
  return (
    <div className="grid h-full grid-cols-2 gap-4">
      <div className="col-span-2 flex items-center gap-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="M14 6l7.7 7.7"/><path d="M8 6l8 8"/></svg>
        Preview mode — metrics backend not yet wired. Showing sample data.
      </div>
      {workspaceMetrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.id}
            className="relative overflow-hidden border-border/60 bg-gradient-to-br from-background/80 via-background to-background/40"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10" />
            <CardContent className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                {metric.label}
                <Badge variant="secondary">{metric.trend}</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between">
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
