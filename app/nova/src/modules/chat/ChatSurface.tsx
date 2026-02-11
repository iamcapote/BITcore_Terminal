/**
 * @license INTERNAL ONLY — Chat surface
 *
 * Why: Recreate the legacy chat console inside Nova without diverging from the shared terminal command bus.
 * What: Wraps the chat provider, renders conversation history, memory context, and session controls in a single-column layout.
 * How: Consume chat context hooks, stream history into scrollable content, and surface the same command semantics as the CLI.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Copy, GitBranch, Loader2, Pencil, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChatProvider, useChat } from "@/modules/chat/ChatProvider";
import type { ChatMessage, ChatMemoryDepth } from "@/modules/chat/chatTypes";
import { ChatHistoryPanel } from "@/modules/chat/ChatHistoryPanel";
import { cn } from "@/lib/utils";

const MEMORY_DEPTH_OPTIONS = [
	{ value: "short", label: "Short" },
	{ value: "medium", label: "Medium" },
	{ value: "long", label: "Long" },
];

type ChatPreset = {
	readonly id: string;
	readonly name: string;
	readonly model: string | null;
	readonly persona: string | null;
	readonly memoryEnabled: boolean;
	readonly memoryDepth: ChatMemoryDepth;
	readonly memoryGithubEnabled: boolean;
	readonly systemPrompt: string;
	readonly temperature: number;
};

type ChatBranch = {
	readonly id: string;
	readonly name: string;
	readonly createdAt: number;
	readonly messages: readonly ChatMessage[];
};

const PRESET_STORAGE_KEY = "nova.chat.presets";

const DEFAULT_TEMPERATURE = 0.7;

function loadPresets(): ChatPreset[] {
	if (typeof window === "undefined") {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as ChatPreset[];
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((preset) => Boolean(preset?.id && preset?.name));
	} catch {
		return [];
	}
}

function savePresets(presets: ChatPreset[]): void {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

export function ChatSurface(): JSX.Element {
	return (
		<ChatProvider>
			<ChatConsole />
		</ChatProvider>
	);
}

function ChatConsole(): JSX.Element {
	const {
		active,
		prompt,
		history,
		memoryContext,
		memoryEnabled,
		memoryDepth,
		memoryGithubEnabled,
		persona,
		model,
		pending,
		pendingResponseId,
		lastError,
		lastConfig,
		startChat,
		sendMessage,
		sendCommand,
		cancelResponse,
		exitChat,
	} = useChat();
	const [draftMemoryEnabled, setDraftMemoryEnabled] = useState(lastConfig.memoryEnabled);
	const [draftMemoryDepth, setDraftMemoryDepth] = useState<ChatMemoryDepth>(lastConfig.memoryDepth);
	const [draftGithubEnabled, setDraftGithubEnabled] = useState(lastConfig.memoryGithubEnabled);
	const [draftPersona, setDraftPersona] = useState(lastConfig.character ?? "");
	const [draftModel, setDraftModel] = useState(lastConfig.model ?? "");
	const [draftSystemPrompt, setDraftSystemPrompt] = useState("");
	const [draftTemperature, setDraftTemperature] = useState(DEFAULT_TEMPERATURE);
	const [message, setMessage] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const [activeTab, setActiveTab] = useState<"live" | "history">("live");
	const [sideTab, setSideTab] = useState<"session" | "presets" | "branches">("session");
	const isStreaming = Boolean(pendingResponseId);
	const [presets, setPresets] = useState<ChatPreset[]>(() => loadPresets());
	const [presetName, setPresetName] = useState("");
	const [branches, setBranches] = useState<ChatBranch[]>([]);
	const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
	const activeBranch = useMemo(
		() => branches.find((branch) => branch.id === activeBranchId) ?? null,
		[branches, activeBranchId],
	);
	const displayHistory = activeBranch ? activeBranch.messages : history;
	const isBranchView = Boolean(activeBranch);

	useEffect(() => {
		setDraftMemoryEnabled(lastConfig.memoryEnabled);
		setDraftMemoryDepth(lastConfig.memoryDepth);
		setDraftGithubEnabled(lastConfig.memoryGithubEnabled);
		setDraftPersona(lastConfig.character ?? "");
		setDraftModel(lastConfig.model ?? "");
	}, [lastConfig]);

	useEffect(() => {
		savePresets(presets);
	}, [presets]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [displayHistory.length]);

	const sessionMeta = useMemo(() => {
		const personaLabel = persona ? `${persona.name} (${persona.slug})` : "Default persona";
		const memoryLabel = memoryEnabled ? `${memoryDepth} depth${memoryGithubEnabled ? " • GitHub" : ""}` : "Disabled";
		return { personaLabel, memoryLabel };
	}, [persona, memoryEnabled, memoryDepth, memoryGithubEnabled]);

	const handleStart = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(null);
		try {
			await startChat({
				memoryEnabled: draftMemoryEnabled,
				memoryDepth: draftMemoryDepth,
				memoryGithubEnabled: draftGithubEnabled,
				character: draftPersona || null,
				model: draftModel || null,
			});
		} catch (error) {
			const messageText = error instanceof Error ? error.message : String(error);
			setFormError(messageText);
		}
	};

	const handleSend = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(null);
		if (isBranchView) {
			setFormError("Exit branch view before sending new messages.");
			return;
		}
		const trimmed = message.trim();
		if (!trimmed) {
			return;
		}
		if (!active) {
			setFormError("Start a chat session before sending messages.");
			return;
		}
		try {
			if (trimmed.startsWith("/")) {
				await sendCommand(trimmed);
			} else {
				await sendMessage(trimmed);
			}
			setMessage("");
		} catch (error) {
			const messageText = error instanceof Error ? error.message : String(error);
			setFormError(messageText);
		}
	};

	const handleCopy = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			const messageText = error instanceof Error ? error.message : "Failed to copy message.";
			setFormError(messageText);
		}
	};

	const handleEdit = (content: string) => {
		setMessage(content);
		inputRef.current?.focus();
	};

	const handleRegenerate = async (messageId: string) => {
		if (!active) {
			setFormError("Start a chat session before regenerating messages.");
			return;
		}
		if (isBranchView) {
			setFormError("Exit branch view before regenerating messages.");
			return;
		}
		if (isStreaming) {
			setFormError("Wait for the current response to finish.");
			return;
		}
		const index = history.findIndex((entry) => entry.id === messageId);
		if (index <= 0) {
			setFormError("No prior user message found to regenerate.");
			return;
		}
		const previousUser = [...history]
			.slice(0, index)
			.reverse()
			.find((entry) => entry.role === "user");
		if (!previousUser) {
			setFormError("No prior user message found to regenerate.");
			return;
		}
		try {
			await sendMessage(previousUser.content);
		} catch (error) {
			const messageText = error instanceof Error ? error.message : String(error);
			setFormError(messageText);
		}
	};

	const handleCancel = () => {
		cancelResponse();
	};

	const handleTemperatureChange = (value: string) => {
		const next = Number(value);
		if (Number.isNaN(next)) {
			setDraftTemperature(DEFAULT_TEMPERATURE);
			return;
		}
		const clamped = Math.min(1, Math.max(0, next));
		setDraftTemperature(clamped);
	};

	const handleSavePreset = () => {
		const trimmed = presetName.trim();
		if (!trimmed) {
			setFormError("Preset name is required.");
			return;
		}
		const preset: ChatPreset = {
			id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
			name: trimmed,
			model: draftModel || null,
			persona: draftPersona || null,
			memoryEnabled: draftMemoryEnabled,
			memoryDepth: draftMemoryDepth,
			memoryGithubEnabled: draftGithubEnabled,
			systemPrompt: draftSystemPrompt,
			temperature: draftTemperature,
		};
		setPresets((previous) => [preset, ...previous]);
		setPresetName("");
	};

	const handleApplyPreset = (preset: ChatPreset) => {
		setDraftModel(preset.model ?? "");
		setDraftPersona(preset.persona ?? "");
		setDraftMemoryEnabled(preset.memoryEnabled);
		setDraftMemoryDepth(preset.memoryDepth);
		setDraftGithubEnabled(preset.memoryGithubEnabled);
		setDraftSystemPrompt(preset.systemPrompt);
		setDraftTemperature(preset.temperature);
	};

	const handleDeletePreset = (presetId: string) => {
		setPresets((previous) => previous.filter((preset) => preset.id !== presetId));
	};

	const handleForkFromMessage = (messageId: string) => {
		const index = history.findIndex((entry) => entry.id === messageId);
		if (index < 0) {
			return;
		}
		const snapshot = history.slice(0, index + 1);
		const now = Date.now();
		const branch: ChatBranch = {
			id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
			name: `Branch from #${index + 1}`,
			createdAt: now,
			messages: snapshot,
		};
		setBranches((previous) => [branch, ...previous]);
		setActiveBranchId(branch.id);
	};

	const handleClearBranchView = () => {
		setActiveBranchId(null);
	};

	return (
		<div className="flex h-full w-full flex-col gap-4 p-3 lg:flex-row lg:items-stretch">
			<aside className="order-1 flex w-full flex-col gap-4 lg:order-2 lg:max-w-sm">
				<Card className="border-border/60 bg-background/80">
					<Tabs value={sideTab} onValueChange={(value) => setSideTab(value as "session" | "presets" | "branches")}
						className="space-y-3">
						<CardHeader className="space-y-3 pb-2">
							<CardTitle className="text-sm">Chat controls</CardTitle>
							<TabsList className="w-full justify-start">
								<TabsTrigger value="session">Session</TabsTrigger>
								<TabsTrigger value="presets">Presets</TabsTrigger>
								<TabsTrigger value="branches">Branches</TabsTrigger>
							</TabsList>
						</CardHeader>
						<CardContent className="space-y-4 text-sm">
							<TabsContent value="session" className="m-0 space-y-3">
								{active ? (
									<div className="space-y-3 text-xs text-muted-foreground">
										<div className="rounded-lg border border-border/60 bg-background/70 p-3">
											<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Session</p>
											<ul className="mt-2 list-none space-y-1 p-0">
												<li>Persona: <span className="font-medium text-foreground">{sessionMeta.personaLabel}</span></li>
												<li>Model: <span className="font-medium text-foreground">{model ?? "default"}</span></li>
												<li>Memory: <span className="font-medium text-foreground">{sessionMeta.memoryLabel}</span></li>
											</ul>
										</div>
										<Button variant="outline" size="sm" onClick={() => void exitChat()} disabled={pending}>
											End chat
										</Button>
										<p className="text-xs">Adjust persona or model when you start the next session.</p>
									</div>
								) : (
									<form className="space-y-3" onSubmit={handleStart}>
										<div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2">
											<div>
												<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Memory mode</p>
												<p className="text-xs text-muted-foreground/80">Enable store and recall during this chat.</p>
											</div>
											<Switch checked={draftMemoryEnabled} onCheckedChange={setDraftMemoryEnabled} />
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-1 text-xs">
												<p className="font-semibold uppercase tracking-[0.22em] text-muted-foreground">Persona slug</p>
												<Input value={draftPersona} placeholder="bitcore" onChange={(event) => setDraftPersona(event.target.value)} />
											</div>
											<div className="space-y-1 text-xs">
												<p className="font-semibold uppercase tracking-[0.22em] text-muted-foreground">Model override</p>
												<Input value={draftModel} placeholder="qwen3-235b" onChange={(event) => setDraftModel(event.target.value)} />
											</div>
										</div>
										{draftMemoryEnabled ? (
											<div className="space-y-3">
												<div className="space-y-1 text-xs">
													<p className="font-semibold uppercase tracking-[0.22em] text-muted-foreground">Memory depth</p>
													<Select value={draftMemoryDepth} onValueChange={(value) => setDraftMemoryDepth(value as ChatMemoryDepth)}>
														<SelectTrigger className="h-9 text-xs">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{MEMORY_DEPTH_OPTIONS.map((option) => (
																<SelectItem key={option.value} value={option.value}>
																	{option.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs">
													<div>
														<p className="font-semibold uppercase tracking-[0.22em] text-muted-foreground">GitHub sync</p>
														<p className="text-xs text-muted-foreground/80">Commit summaries on exit.</p>
													</div>
													<Switch checked={draftGithubEnabled} onCheckedChange={setDraftGithubEnabled} />
												</div>
											</div>
										) : null}
										<Button type="submit" className="w-full" disabled={pending}>
											{pending ? "Starting chat…" : "Start chat"}
										</Button>
									</form>
								)}
								{!active && formError ? <p className="text-xs text-destructive">{formError}</p> : null}
								<p className="text-xs text-muted-foreground">
									This surfaces the same `/chat` command. Launch it from the terminal to mirror state exactly.
								</p>
								{memoryContext.length > 0 ? (
									<div className="rounded-lg border border-border/60 bg-background/70 p-3 text-xs">
										<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Memory context</p>
										<ScrollArea className="mt-2 max-h-60 pr-2">
											<div className="space-y-2">
												{memoryContext.map((memory) => (
													<div key={memory.id} className="rounded-lg border border-border/60 bg-background/80 p-3">
														<p className="font-medium text-foreground/80">{memory.content}</p>
														<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
															{memory.similarity !== undefined ? <span>Sim {memory.similarity.toFixed(2)}</span> : null}
															{memory.matchReason ? <span>{memory.matchReason}</span> : null}
															{memory.role ? <span>Role {memory.role}</span> : null}
														</div>
													</div>
												))}
											</div>
										</ScrollArea>
									</div>
								) : null}
							</TabsContent>
							<TabsContent value="presets" className="m-0 space-y-3 text-xs">
								<div className="space-y-2">
									<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">System prompt</p>
									<Textarea
										value={draftSystemPrompt}
										onChange={(event) => setDraftSystemPrompt(event.target.value)}
										placeholder="Set system prompt"
										className="min-h-[90px] text-xs"
									/>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-1">
										<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Temperature</p>
										<Input
											type="number"
											step="0.1"
											min="0"
											max="1"
											value={draftTemperature}
											onChange={(event) => handleTemperatureChange(event.target.value)}
											className="h-9 text-xs"
										/>
									</div>
									<div className="space-y-1">
										<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Save preset</p>
										<div className="flex gap-2">
											<Input
												value={presetName}
												placeholder="Preset name"
												onChange={(event) => setPresetName(event.target.value)}
												className="h-9 text-xs"
											/>
											<Button variant="secondary" size="sm" onClick={handleSavePreset}>
												Save
											</Button>
										</div>
									</div>
								</div>
								<div className="space-y-2">
									<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Saved presets</p>
									{presets.length === 0 ? (
										<p className="text-xs text-muted-foreground">No presets saved yet.</p>
									) : (
										<div className="space-y-2">
											{presets.map((preset) => (
												<div key={preset.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 p-2">
													<div className="min-w-0">
														<p className="truncate text-xs font-semibold text-foreground">{preset.name}</p>
														<p className="text-[11px] text-muted-foreground">{preset.model ?? "default"} • temp {preset.temperature.toFixed(1)}</p>
													</div>
													<div className="flex items-center gap-1">
														<Button variant="outline" size="sm" onClick={() => handleApplyPreset(preset)}>
															Apply
														</Button>
														<Button variant="ghost" size="sm" onClick={() => handleDeletePreset(preset.id)}>
															Delete
														</Button>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
								<p className="text-[11px] text-muted-foreground">Presets update the session form before you start chat.</p>
							</TabsContent>
							<TabsContent value="branches" className="m-0 space-y-2 text-xs">
								{branches.length === 0 ? (
									<p className="text-xs text-muted-foreground">Fork any message to start a branch.</p>
								) : (
									<div className="space-y-2">
										{branches.map((branch) => (
											<div key={branch.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 p-2">
												<div className="min-w-0">
													<p className="truncate text-xs font-semibold text-foreground">{branch.name}</p>
													<p className="text-[11px] text-muted-foreground">{branch.messages.length} messages</p>
												</div>
												<div className="flex items-center gap-1">
													<Button variant="outline" size="sm" onClick={() => setActiveBranchId(branch.id)}>
														View
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setBranches((previous) => previous.filter((entry) => entry.id !== branch.id))}
													>
														Delete
													</Button>
												</div>
											</div>
										))}
									</div>
								)}
								<p className="text-[11px] text-muted-foreground">Branch views are read-only snapshots.</p>
							</TabsContent>
						</CardContent>
					</Tabs>
				</Card>
			</aside>
			<section className="order-2 flex min-h-0 flex-1 flex-col gap-4 lg:order-1">
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab((value as "live" | "history") ?? "live")}
					className="flex h-full flex-1 flex-col gap-4"
				>
					<div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 shadow-sm">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="space-y-2">
								<p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Chat Console</p>
								<p className="text-xs text-muted-foreground/80">Shared with the terminal dispatcher. Slash commands and personas stay in sync.</p>
								<TabsList className="bg-transparent p-0">
									<TabsTrigger value="live" className="px-3">
										Live chat
									</TabsTrigger>
									<TabsTrigger value="history" className="px-3">
										History
									</TabsTrigger>
								</TabsList>
							</div>
							<div className="grid gap-2 text-xs text-muted-foreground sm:auto-cols-fr sm:grid-flow-col sm:text-right">
								<div>
									<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Persona</p>
									<p className="font-medium text-foreground">{sessionMeta.personaLabel}</p>
								</div>
								<div>
									<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Model</p>
									<p className="font-medium text-foreground">{model ?? "default"}</p>
								</div>
								<div>
									<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Memory</p>
									<p className="font-medium text-foreground">{sessionMeta.memoryLabel}</p>
								</div>
							</div>
						</div>
					</div>
					<TabsContent value="live" className="flex min-h-0 flex-1 flex-col">
						<Card className="flex min-h-0 flex-1 flex-col border-border/70 bg-background/90 shadow-sm">
							<CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
								<CardTitle className="text-sm">Conversation</CardTitle>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span className="font-mono text-[11px]">Prompt: {prompt ?? "—"}</span>
									{active ? (
										<Button variant="ghost" size="sm" onClick={() => void exitChat()} disabled={pending}>
											End chat
										</Button>
									) : null}
								</div>
							</CardHeader>
							<CardContent className="flex h-full flex-1 flex-col gap-4">
								<ScrollArea className="flex-1 pr-2">
									<div className="space-y-3 text-sm">
										{displayHistory.length === 0 ? (
											<p className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
												{active ? "Chat output will appear here. Send a message to begin." : "Start a chat session to populate the conversation."}
											</p>
										) : (
											displayHistory.map((entry) => (
												<ChatBubble
													key={entry.id}
													message={entry}
													onCopy={handleCopy}
													onEdit={handleEdit}
													onRegenerate={handleRegenerate}
													onFork={handleForkFromMessage}
												/>
											))
										)}
										<div ref={messagesEndRef} />
									</div>
								</ScrollArea>
								<form className="flex flex-col gap-2" onSubmit={handleSend}>
									<div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-3 sm:flex-row sm:items-end">
										<Textarea
											ref={inputRef}
											value={message}
											onChange={(event) => setMessage(event.target.value)}
											placeholder="Type a message or /command"
											className="min-h-[72px] flex-1 resize-none border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
											disabled={!active || pending || isStreaming || isBranchView}
										/>
										<div className="flex w-full items-end justify-between gap-2 text-xs text-muted-foreground sm:w-44 sm:flex-col sm:items-stretch sm:text-right">
											<span>{isBranchView ? "Viewing branch snapshot." : "Slash commands route to the same dispatcher."}</span>
											<div className="flex items-center justify-end gap-2">
												{isBranchView ? (
													<Button type="button" variant="outline" size="sm" onClick={handleClearBranchView}>
														Return
													</Button>
												) : null}
												{isStreaming ? (
													<Button type="button" variant="outline" size="sm" onClick={handleCancel}>
														<Square className="mr-2 h-3.5 w-3.5" />
														Stop
													</Button>
												) : null}
												<Button type="submit" disabled={!active || pending || isStreaming || isBranchView}>
													{pending ? "Sending…" : "Send"}
												</Button>
											</div>
										</div>
									</div>
									{active && formError ? <p className="text-xs text-destructive">{formError}</p> : null}
									{lastError ? <p className="text-xs text-destructive">{lastError}</p> : null}
								</form>
							</CardContent>
						</Card>
					</TabsContent>
					<TabsContent value="history" className="flex min-h-0 flex-1 flex-col">
						<ChatHistoryPanel active={activeTab === "history"} />
					</TabsContent>
				</Tabs>
			</section>
		</div>
	);
}

function ChatBubble({
	message,
	onCopy,
	onEdit,
	onRegenerate,
	onFork,
}: {
	message: ChatMessage;
	onCopy: (content: string) => void;
	onEdit: (content: string) => void;
	onRegenerate: (messageId: string) => void;
	onFork: (messageId: string) => void;
}): JSX.Element {
	const alignment = message.role === "assistant" ? "self-start" : message.role === "system" ? "self-center" : "self-end";
	const tone =
		message.role === "assistant"
			? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
			: message.role === "system"
				? "bg-muted/40 border border-border/60 text-muted-foreground"
				: "bg-primary/10 border border-primary/40 text-primary-foreground";
	return (
		<div className={cn("group flex max-w-full flex-col", alignment)}>
			<div className={cn("rounded-2xl px-3 py-2 text-sm", tone)}>
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

