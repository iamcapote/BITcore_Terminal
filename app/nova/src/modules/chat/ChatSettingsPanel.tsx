/**
 * Why: Isolates chat presets, system prompt, temperature, and workflow injection from the main ChatSurface.
 * What: Preset CRUD, system-prompt editor, temperature slider, workflow-injection controls, and saved-preset list.
 * How: Receives draft state via props; persists presets through chatPresets helpers.
 *      Mirrors chatbot-ui's ChatSettings popover and chatgpt-ui's ModelParameters dialog — advanced config lives here.
 */

import { Bookmark, FileCode2, Sliders, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChatPreset } from "@/modules/chat/chatPresets";
import type { WorkflowSelectionMode } from "@/modules/chat/workflowContext";

/* ── Props contract ────────────────────────────────────────────────── */

export interface ChatSettingsPanelProps {
	/* ── System prompt + temperature ── */
	draftSystemPrompt: string;
	draftTemperature: number;
	onSystemPromptChange: (value: string) => void;
	onTemperatureChange: (value: string) => void;

	/* ── Workflow injection ── */
	workflowInjection: "none" | "system" | "first";
	workflowSelectionMode: WorkflowSelectionMode;
	workflowJson: string;
	onWorkflowInjectionChange: (value: "none" | "system" | "first") => void;
	onWorkflowSelectionModeChange: (value: WorkflowSelectionMode) => void;
	onWorkflowJsonChange: (value: string) => void;

	/* ── Presets ── */
	presets: ChatPreset[];
	presetName: string;
	onPresetNameChange: (value: string) => void;
	onSavePreset: () => void;
	onApplyPreset: (preset: ChatPreset) => void;
	onDeletePreset: (presetId: string) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ChatSettingsPanel({
	draftSystemPrompt,
	draftTemperature,
	onSystemPromptChange,
	onTemperatureChange,
	workflowInjection,
	workflowSelectionMode,
	workflowJson,
	onWorkflowInjectionChange,
	onWorkflowSelectionModeChange,
	onWorkflowJsonChange,
	presets,
	presetName,
	onPresetNameChange,
	onSavePreset,
	onApplyPreset,
	onDeletePreset,
}: ChatSettingsPanelProps): JSX.Element {
	return (
		<div className="space-y-3 text-xs">
			{/* ── System prompt ── */}
			<div className="space-y-2">
				<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
					<Wand2 className="h-3 w-3" /> System prompt
				</div>
				<Textarea
					value={draftSystemPrompt}
					onChange={(event) => onSystemPromptChange(event.target.value)}
					placeholder="Set system prompt"
					className="min-h-[90px] text-xs"
				/>
			</div>

			{/* ── Temperature + Save preset ── */}
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						<Sliders className="h-3 w-3" /> Temperature
					</div>
					<Input
						type="number"
						step="0.1"
						min="0"
						max="1"
						value={draftTemperature}
						onChange={(event) => onTemperatureChange(event.target.value)}
						className="h-9 text-xs"
					/>
				</div>
				<div className="space-y-1">
					<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						<Bookmark className="h-3 w-3" /> Save preset
					</div>
					<div className="flex flex-wrap gap-2">
						<Input
							value={presetName}
							placeholder="Preset name"
							onChange={(event) => onPresetNameChange(event.target.value)}
							className="h-9 text-xs"
						/>
						<Button variant="secondary" size="sm" onClick={onSavePreset}>
							Save
						</Button>
					</div>
				</div>
			</div>

			{/* ── Workflow injection (ported from semantic_flow ChatPage) ── */}
			<div className="space-y-2">
				<div className="flex items-center gap-1.5">
					<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						<FileCode2 className="h-3 w-3" /> Workflow injection
					</div>
					<span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">New</span>
				</div>
				<p className="text-[10px] text-muted-foreground/80">Inject workflow context into the conversation.</p>
				<Select value={workflowInjection} onValueChange={(v) => onWorkflowInjectionChange(v as "none" | "system" | "first")}>
					<SelectTrigger className="h-9 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">None</SelectItem>
						<SelectItem value="system">System prompt</SelectItem>
						<SelectItem value="first">First user message</SelectItem>
					</SelectContent>
				</Select>
				{workflowInjection !== "none" && (
					<>
						<div className="space-y-1">
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Workflow payload</p>
							<Select value={workflowSelectionMode} onValueChange={(value) => onWorkflowSelectionModeChange(value as WorkflowSelectionMode)}>
								<SelectTrigger className="h-9 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="stripped">Stripped workflow</SelectItem>
									<SelectItem value="full">Full workflow</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-[10px] text-muted-foreground/80">Stripped keeps semantic essentials only; full sends complete JSON.</p>
						</div>
						<Textarea
							value={workflowJson}
							onChange={(event) => onWorkflowJsonChange(event.target.value)}
							placeholder='Paste workflow JSON context…'
							className="min-h-[60px] text-xs font-mono"
						/>
					</>
				)}
			</div>

			{/* ── Saved presets list ── */}
			<div className="space-y-2">
				<div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
					<Bookmark className="h-3 w-3" /> Saved presets
				</div>
				{presets.length === 0 ? (
					<p className="text-xs text-muted-foreground">No presets saved yet.</p>
				) : (
					<div className="space-y-2">
						{presets.map((preset) => (
							<div key={preset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 p-2">
								<div className="min-w-0">
									<p className="truncate text-xs font-semibold text-foreground">{preset.name}</p>
									<p className="text-[11px] text-muted-foreground">{preset.model ?? "default"} • temp {preset.temperature.toFixed(1)}</p>
								</div>
								<div className="flex flex-wrap items-center gap-1">
									<Button variant="outline" size="sm" onClick={() => onApplyPreset(preset)}>
										Apply
									</Button>
									<Button variant="ghost" size="sm" onClick={() => onDeletePreset(preset.id)}>
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

		</div>
	);
}
