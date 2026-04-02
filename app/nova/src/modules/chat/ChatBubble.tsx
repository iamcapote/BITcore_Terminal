/**
 * Why: Isolated chat message bubble — single responsibility for message rendering, actions, and status.
 * What: Renders a single chat message with role-based alignment, copy/edit/fork/regenerate affordances.
 * How: Accepts ChatMessage + callbacks; composes action buttons with hover reveal; handles streaming state.
 */

import { Copy, GitBranch, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/modules/chat/chatTypes";
import { cn } from "@/lib/utils";

/* ── Props ─────────────────────────────────────────────────────────── */

export interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly onCopy: (content: string) => void;
  readonly onEdit: (content: string) => void;
  readonly onRegenerate: (messageId: string) => void;
  readonly onFork: (messageId: string) => void;
}

/* ── Role-based visual mapping ─────────────────────────────────────── */

function roleTone(role: ChatMessage["role"]): string {
  if (role === "assistant") return "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200";
  if (role === "system") return "bg-muted/40 border border-border/60 text-muted-foreground";
  return "bg-primary/10 border border-primary/40 text-primary-foreground";
}

function roleAlignment(role: ChatMessage["role"]): string {
  if (role === "assistant") return "self-start";
  if (role === "system") return "self-center";
  return "self-end";
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ChatBubble({ message, onCopy, onEdit, onRegenerate, onFork }: ChatBubbleProps): JSX.Element {
  return (
    <div className={cn("group flex max-w-full flex-col", roleAlignment(message.role))}>
      <div className={cn("rounded-2xl px-3 py-2 text-sm", roleTone(message.role))}>
        <div className="flex items-center gap-2">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          {message.status === "streaming" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(message.content)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {message.role === "user" ? (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(message.content)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFork(message.id)}>
          <GitBranch className="h-3.5 w-3.5" />
        </Button>
        {message.role === "assistant" ? (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRegenerate(message.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {message.status === "failed" && message.error ? (
        <p className="mt-1 text-[11px] text-destructive">{message.error}</p>
      ) : null}
    </div>
  );
}
