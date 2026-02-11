/**
 * Why: Unwired surfaces need clear, helpful placeholders instead of invisible dead-ends.
 * What: Reusable empty-state card with icon, title, description, and optional CTA.
 * How: Renders a centered card; consumers pass context-specific messaging and action handlers.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Construction, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  cta?: string;
  onAction?: () => void;
  badge?: string;
}

export function EmptyState({
  icon: Icon = Construction,
  title,
  description,
  cta,
  onAction,
  badge = "coming soon",
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Card className="max-w-md border-dashed border-border/60 bg-background/60">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-xl bg-muted/40 p-4">
            <Icon className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {badge ? (
            <Badge variant="outline" className="border-amber-500/40 text-[10px] uppercase text-amber-400">
              {badge}
            </Badge>
          ) : null}
          {cta && onAction ? (
            <Button size="sm" variant="secondary" onClick={onAction}>
              {cta}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
