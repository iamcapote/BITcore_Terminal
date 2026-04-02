/**
 * Why: Isolates pre-chat session configuration from the main ChatSurface.
 * What: Persona/model selection, memory toggles, workbench bootstrap card, and quick-prompt buttons.
 * How: Receives draft state + workbench snapshot via props; fires onStart when the operator launches a session.
 *      Mirrors chatbot-ui's QuickSettings pattern — focused, self-contained, no conversation logic.
 */

import type { FormEvent } from "react";
import { Bot, Brain, Cpu, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MEMORY_DEPTH_OPTIONS } from "@/modules/chat/chatPresets";
import type { ChatMemoryDepth } from "@/modules/chat/chatTypes";
import type { ChatWorkbenchSnapshot } from "@/modules/chat/chatWorkbenchClient";

/* ── Props contract ────────────────────────────────────────────────── */

export interface ChatSessionFormProps {
	/** Workbench bootstrap data (models, personas, quick prompts). */
	workbenchSnapshot: ChatWorkbenchSnapshot;
	/** Whether a chat operation is in flight. */
	pending: boolean;
	/** Form-level error to display. */
	formError: string | null;

	/* ── Draft state (lifted from parent) ── */
	draftPersona: string;
	draftModel: string;
	draftMemoryEnabled: boolean;
	draftMemoryDepth: ChatMemoryDepth;
	draftGithubEnabled: boolean;

	/* ── Draft setters ── */
	onPersonaChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onMemoryEnabledChange: (value: boolean) => void;
	onMemoryDepthChange: (value: ChatMemoryDepth) => void;
	onGithubEnabledChange: (value: boolean) => void;

	/** Populate message input with a quick-prompt string. */
	onQuickPrompt: (prompt: string) => void;
	/** Start the chat session. */
	onStart: (event: FormEvent<HTMLFormElement>) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ChatSessionForm({
	workbenchSnapshot,
	pending,
	formError,
	draftPersona,
	draftModel,
	draftMemoryEnabled,
	draftMemoryDepth,
	draftGithubEnabled,
	onPersonaChange,
	onModelChange,
	onMemoryEnabledChange,
	onMemoryDepthChange,
	onGithubEnabledChange,
	onQuickPrompt,
	onStart,
}: ChatSessionFormProps): JSX.Element {
	return (
		<>
			<form className="space-y-3" onSubmit={onStart}>
				{/* ── Memory toggle ── */}
				<div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
					<div className="flex items-center gap-2">
						<Brain className="h-4 w-4 text-violet-500" />
						<div>
							<p className="text-xs font-medium text-foreground">Memory</p>
							<p className="text-[10px] text-muted-foreground">Store and recall context</p>
						</div>
					</div>
					<Switch checked={draftMemoryEnabled} onCheckedChange={onMemoryEnabledChange} />
				</div>

				{/* ── Model selection ── */}
				<div className="space-y-1.5">
					<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						<Cpu className="h-3 w-3" /> Model
					</div>
					<Select value={draftModel} onValueChange={onModelChange}>
						<SelectTrigger className="h-9 text-xs">
							<SelectValue placeholder="Select model" />
						</SelectTrigger>
						<SelectContent>
							{workbenchSnapshot.models.map((m) => (
								<SelectItem key={m.id} value={m.id}>
									{m.label} · {m.provider}
								</SelectItem>
							))}
							{draftModel && !workbenchSnapshot.models.some((m) => m.id === draftModel) && (
								<SelectItem value={draftModel}>{draftModel} (custom)</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>

				{/* ── Persona selection ── */}
				<div className="space-y-1.5">
					<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						<Bot className="h-3 w-3" /> Persona
					</div>
					<Select value={draftPersona} onValueChange={onPersonaChange}>
						<SelectTrigger className="h-9 text-xs">
							<SelectValue placeholder="Select persona" />
						</SelectTrigger>
						<SelectContent>
							{workbenchSnapshot.personas.map((p) => (
								<SelectItem key={p.slug} value={p.slug}>
									{p.label}
								</SelectItem>
							))}
							{draftPersona && !workbenchSnapshot.personas.some((p) => p.slug === draftPersona) && (
								<SelectItem value={draftPersona}>{draftPersona} (custom)</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>

				{/* ── Quick prompts ── */}
				{workbenchSnapshot.quickPrompts.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
							<Zap className="h-3 w-3 text-amber-500" /> Suggestions
						</div>
						<div className="grid gap-1.5">
							{workbenchSnapshot.quickPrompts.map((qp) => (
								<button
									key={qp.id}
									type="button"
									onClick={() => onQuickPrompt(qp.prompt)}
									className="group flex items-start gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
								>
									<Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
									<div className="min-w-0">
										<p className="text-xs font-medium text-foreground">{qp.title}</p>
										<p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/60">{qp.prompt}</p>
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{/* ── Memory options (conditional) ── */}
				{draftMemoryEnabled ? (
					<div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
						<div className="space-y-1.5">
							<span className="text-[11px] font-medium text-muted-foreground">Depth</span>
							<Select value={draftMemoryDepth} onValueChange={(value) => onMemoryDepthChange(value as ChatMemoryDepth)}>
								<SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
								<SelectContent>
									{MEMORY_DEPTH_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between pt-1">
							<span className="text-[11px] text-muted-foreground">GitHub sync on exit</span>
							<Switch checked={draftGithubEnabled} onCheckedChange={onGithubEnabledChange} />
						</div>
					</div>
				) : null}

				<Button type="submit" className="w-full font-medium" size="lg" disabled={pending}>
					{pending ? "Starting…" : "Start conversation"}
				</Button>
			</form>
			{formError ? <p className="text-xs text-destructive">{formError}</p> : null}
		</>
	);
}
