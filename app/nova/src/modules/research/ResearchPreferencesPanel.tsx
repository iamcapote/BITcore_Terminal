/**
 * Research Preferences Panel
 * Why: Offer in-shell controls for research defaults so operators can tune depth, breadth, and visibility without leaving Nova.
 * What: Card surface that binds form inputs to the research preferences provider and dispatches updates, refreshes, and resets.
 * How: Mirrors CLI semantics by diffing against the current snapshot, issuing REST mutations, and surfacing status feedback.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useResearchPreferences } from "@/modules/research/ResearchPreferencesProvider";

interface PreferencesFormState {
	readonly depth: number;
	readonly breadth: number;
	readonly isPublic: boolean;
}

interface FeedbackState {
	readonly message: string;
	readonly tone: "info" | "success" | "error" | "muted";
}

export function ResearchPreferencesPanel(): JSX.Element {
	const { preferences, status, error, refresh, update, reset, dismissError } = useResearchPreferences();
	const [form, setForm] = useState<PreferencesFormState>(preferences.defaults);
	const [feedback, setFeedback] = useState<FeedbackState | null>(null);

	useEffect(() => {
		setForm(preferences.defaults);
	}, [preferences.defaults]);

	useEffect(() => {
		if (!error) {
			return;
		}
		setFeedback({ message: error, tone: "error" });
		dismissError();
	}, [dismissError, error]);

	useEffect(() => {
		if (!feedback || feedback.tone === "error" || typeof window === "undefined") {
			return;
		}
		const timeout = window.setTimeout(() => setFeedback(null), 3500);
		return () => {
			window.clearTimeout(timeout);
		};
	}, [feedback]);

	const depthOptions = useMemo(() => createNumericOptions(1, 6), []);
	const breadthOptions = depthOptions;

	const busy = status === "loading" || status === "saving";
	const saving = status === "saving";
	const loading = status === "loading";

	const isDirty =
		form.depth !== preferences.defaults.depth ||
		form.breadth !== preferences.defaults.breadth ||
		form.isPublic !== preferences.defaults.isPublic;

	const statusLabel = saving
		? "Saving research defaults…"
		: loading
			? "Loading research defaults…"
			: preferences.updatedAt
				? `Updated ${formatRelativeTime(preferences.updatedAt)}`
				: "Using default settings";

	const handleDepthChange = useCallback((value: string) => {
		const depth = Number.parseInt(value, 10);
		setForm((previous) => ({ ...previous, depth: Number.isFinite(depth) ? depth : previous.depth }));
	}, []);

	const handleBreadthChange = useCallback((value: string) => {
		const breadth = Number.parseInt(value, 10);
		setForm((previous) => ({ ...previous, breadth: Number.isFinite(breadth) ? breadth : previous.breadth }));
	}, []);

	const handleVisibilityChange = useCallback((checked: boolean) => {
		setForm((previous) => ({ ...previous, isPublic: checked }));
	}, []);

	const saveChanges = useCallback(async () => {
		dismissError();
		setFeedback(null);
		const patch = buildPatch(form, preferences.defaults);
		if (!patch) {
			setFeedback({ message: "No changes to save.", tone: "muted" });
			return;
		}
		try {
			await update(patch);
			setFeedback({ message: "Research defaults saved.", tone: "success" });
		} catch (updateError) {
			const message = updateError instanceof Error ? updateError.message : String(updateError);
			setFeedback({ message, tone: "error" });
		}
	}, [dismissError, form, preferences.defaults, update]);

	const resetDefaults = useCallback(async () => {
		dismissError();
		setFeedback(null);
		try {
			await reset();
			setFeedback({ message: "Research defaults reset.", tone: "success" });
		} catch (resetError) {
			const message = resetError instanceof Error ? resetError.message : String(resetError);
			setFeedback({ message, tone: "error" });
		}
	}, [dismissError, reset]);

	const refreshDefaults = useCallback(async () => {
		dismissError();
		setFeedback(null);
		try {
			await refresh({ force: true });
			setFeedback({ message: "Research defaults refreshed.", tone: "info" });
		} catch (refreshError) {
			const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
			setFeedback({ message, tone: "error" });
		}
	}, [dismissError, refresh]);

	return (
		<Card className="border-border/60 bg-background/70">
			<CardHeader className="gap-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-sm font-semibold uppercase tracking-[0.3em]">Research Defaults</CardTitle>
					<Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
						{statusLabel}
					</Badge>
				</div>
				<CardDescription className="text-xs text-muted-foreground/90">
					Depth controls investigation stages, breadth governs source fan-out, and visibility toggles public reporting across CLI and GUI.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid gap-4 sm:grid-cols-3">
					<FieldGroup label="Depth" description="Choose investigation intensity.">
						<Select value={String(form.depth)} onValueChange={handleDepthChange} disabled={busy}>
							<SelectTrigger className="h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{depthOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FieldGroup>
					<FieldGroup label="Breadth" description="Set concurrent source fan-out.">
						<Select value={String(form.breadth)} onValueChange={handleBreadthChange} disabled={busy}>
							<SelectTrigger className="h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{breadthOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FieldGroup>
					<FieldGroup label="Public visibility" description="Default to publishable reports.">
						<div className="flex items-center gap-3">
							<Switch checked={form.isPublic} onCheckedChange={handleVisibilityChange} disabled={busy} />
							<span className="text-xs text-muted-foreground">
								{form.isPublic ? "Research outputs marked public." : "Runs remain private unless overridden."}
							</span>
						</div>
					</FieldGroup>
				</div>
			</CardContent>
			<CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-background/60 sm:flex-row sm:items-center sm:justify-between">
				<div className={cn("text-xs", feedback ? toneClass(feedback.tone) : "text-muted-foreground/80")}>{
					feedback ? feedback.message : "Preferences persist across CLI and Nova."
				}</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" variant="ghost" size="sm" onClick={refreshDefaults} disabled={busy}>
						Refresh
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={resetDefaults} disabled={busy}>
						Reset
					</Button>
					<Button type="button" size="sm" onClick={saveChanges} disabled={busy || !isDirty}>
						Save changes
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

function FieldGroup({ label, description, children }: { readonly label: string; readonly description: string; readonly children: ReactNode }) {
	return (
		<div className="space-y-2">
			<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
			<div className="rounded-lg border border-border/60 bg-background/60 p-3">
				{children}
				<p className="mt-2 text-[11px] text-muted-foreground/80">{description}</p>
			</div>
		</div>
	);
}

function createNumericOptions(min: number, max: number): Array<{ readonly value: string; readonly label: string }> {
	const options: Array<{ readonly value: string; readonly label: string }> = [];
	for (let value = min; value <= max; value += 1) {
		options.push({ value: String(value), label: `Level ${value}` });
	}
	return options;
}

function buildPatch(next: PreferencesFormState, baseline: PreferencesFormState): { depth?: number; breadth?: number; isPublic?: boolean } | null {
	const patch: { depth?: number; breadth?: number; isPublic?: boolean } = {};
	let mutated = false;

	if (next.depth !== baseline.depth) {
		patch.depth = next.depth;
		mutated = true;
	}
	if (next.breadth !== baseline.breadth) {
		patch.breadth = next.breadth;
		mutated = true;
	}
	if (next.isPublic !== baseline.isPublic) {
		patch.isPublic = next.isPublic;
		mutated = true;
	}

	return mutated ? patch : null;
}

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const delta = Math.max(0, now - timestamp);
	const seconds = Math.round(delta / 1000);
	if (seconds < 60) {
		return `${seconds}s ago`;
	}
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.round(hours / 24);
	if (days < 7) {
		return `${days}d ago`;
	}
	const weeks = Math.round(days / 7);
	if (weeks < 5) {
		return `${weeks}w ago`;
	}
	const months = Math.round(days / 30);
	if (months < 12) {
		return `${months}mo ago`;
	}
	const years = Math.round(days / 365);
	return `${years}y ago`;
}

function toneClass(tone: FeedbackState["tone"]): string {
	switch (tone) {
		case "success":
			return "text-emerald-400";
		case "error":
			return "text-red-400";
		case "info":
			return "text-sky-300";
		default:
			return "text-muted-foreground/80";
	}
}
