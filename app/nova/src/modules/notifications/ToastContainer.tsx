/**
 * Why: Render toast notifications as a floating stack so users see async events without interrupting workflow.
 * What: ToastContainer reads the notification queue and renders animated toast cards with auto-dismiss timers.
 * How: Maps queue entries to positioned cards, sets timeouts for auto-dismiss, and animates entry/exit via CSS transitions.
 */

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, type NotificationSeverity } from "@/modules/notifications/NotificationProvider";

const SEVERITY_STYLES: Record<NotificationSeverity, { icon: typeof Info; border: string; text: string }> = {
  info: { icon: Info, border: "border-blue-500/40", text: "text-blue-400" },
  success: { icon: CheckCircle2, border: "border-emerald-500/40", text: "text-emerald-400" },
  warning: { icon: AlertCircle, border: "border-amber-500/40", text: "text-amber-400" },
  error: { icon: XCircle, border: "border-red-500/40", text: "text-red-400" },
};

export function ToastContainer(): JSX.Element {
  const { queue, dismiss } = useNotifications();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-96 max-w-[calc(100vw-2rem)] flex-col-reverse gap-2">
      {queue.map((notification) => (
        <ToastCard
          key={notification.id}
          id={notification.id}
          severity={notification.severity}
          title={notification.title}
          description={notification.description}
          autoDismissMs={notification.autoDismissMs}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}

function ToastCard({
  id,
  severity,
  title,
  description,
  autoDismissMs,
  onDismiss,
}: {
  id: string;
  severity: NotificationSeverity;
  title: string;
  description?: string;
  autoDismissMs?: number;
  onDismiss: (id: string) => void;
}): JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = SEVERITY_STYLES[severity];
  const Icon = style.icon;

  useEffect(() => {
    if (autoDismissMs && autoDismissMs > 0) {
      timerRef.current = setTimeout(() => onDismiss(id), autoDismissMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, autoDismissMs, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm",
        "animate-in slide-in-from-right-5 fade-in-0 duration-200",
        style.border,
      )}
      role="alert"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.text)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss"
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
