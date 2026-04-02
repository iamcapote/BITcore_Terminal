/**
 * Why: Chat console surface — wraps the shared terminal command bus with GUI controls.
 * What: Thin composition shell for session form, advanced settings, branch management, and live conversation.
 * How: Keeps conversation logic local while delegating setup panels to focused child components.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, GitFork, MessageSquare, Send, Settings2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChatProvider, useChat } from "@/modules/chat/ChatProvider";
import {
	injectWorkflowIntoMessage,
	type WorkflowSelectionMode,
} from "@/modules/chat/workflowContext";
import type { ChatMemoryDepth } from "@/modules/chat/chatTypes";
import { ChatHistoryPanel } from "@/modules/chat/ChatHistoryPanel";
import { ChatBubble } from "@/modules/chat/ChatBubble";
import {
	DEFAULT_TEMPERATURE,
	loadPresets,
	savePresets,
	generateId,
	type ChatPreset,
	type ChatBranch,
} from "@/modules/chat/chatPresets";
import {
	fetchChatWorkbenchSnapshot,
	type ChatWorkbenchSnapshot,
} from "@/modules/chat/chatWorkbenchClient";
import { ChatSessionForm } from "@/modules/chat/ChatSessionForm";
import { ChatSettingsPanel } from "@/modules/chat/ChatSettingsPanel";
import { ChatBranchPanel } from "@/modules/chat/ChatBranchPanel";
import { loadChatDefaults } from "@/modules/chat/chatDefaults";

const FALLBACK_CHAT_WORKBENCH: ChatWorkbenchSnapshot = {
	source: "mock",
	feature: { enabled: true, mode: "mock", wiring: "fallback" },
	models: [
		{ id: "qwen3-235b", label: "Qwen 3 235B", provider: "venice", capability: "reasoning" },
		{ id: "deepseek-r1-671b", label: "DeepSeek R1 671B", provider: "venice", capability: "analysis" },
	],
	personas: [
		{ slug: "bitcore", label: "BITcore Operator", summary: "General operations assistant." },
		{ slug: "researcher", label: "Research Analyst", summary: "Investigation and synthesis." },
	],
	quickPrompts: [
		{ id: "incident-triage", title: "Incident triage", prompt: "Summarize incident scope, impact, and first containment actions." },
		{ id: "research-plan", title: "Research plan", prompt: "Create a bounded research plan with milestones and risks." },
	],
	defaults: { persona: "bitcore", model: "qwen3-235b" },
	updatedAt: new Date(0).toISOString(),
};

export function ChatSurface(): JSX.Element {
	return (
		<ChatProvider>
			<ChatConsole />
		</ChatProvider>
	);
}

function ChatConsole(): JSX.Element {
	const defaults = useMemo(() => loadChatDefaults(), []);
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
	const [draftMemoryEnabled, setDraftMemoryEnabled] = useState(defaults.memoryEnabled);
	const [draftMemoryDepth, setDraftMemoryDepth] = useState<ChatMemoryDepth>(defaults.memoryDepth as ChatMemoryDepth);
	const [draftGithubEnabled, setDraftGithubEnabled] = useState(defaults.githubSync);
	const [draftPersona, setDraftPersona] = useState(defaults.persona);
	const [draftModel, setDraftModel] = useState(defaults.model);
	const [draftSystemPrompt, setDraftSystemPrompt] = useState("");
	const [draftTemperature, setDraftTemperature] = useState(defaults.temperature || DEFAULT_TEMPERATURE);
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
	const [workbenchSnapshot, setWorkbenchSnapshot] = useState<ChatWorkbenchSnapshot>(FALLBACK_CHAT_WORKBENCH);
	/* ── Workflow injection (ported from semantic_flow ChatPage) ──── */
	const [workflowInjection, setWorkflowInjection] = useState<"none" | "system" | "first">("none");
	const [workflowSelectionMode, setWorkflowSelectionMode] = useState<WorkflowSelectionMode>("stripped");
	const [workflowJson, setWorkflowJson] = useState("");
	const activeBranch = useMemo(
		() => branches.find((branch) => branch.id === activeBranchId) ?? null,
		[branches, activeBranchId],
	);
	const displayHistory = activeBranch ? activeBranch.messages : history;
	const isBranchView = Boolean(activeBranch);

	useEffect(() => {
		if (active) {
			return;
		}
		setDraftMemoryEnabled(lastConfig.memoryEnabled ?? defaults.memoryEnabled);
		setDraftMemoryDepth(lastConfig.memoryDepth ?? (defaults.memoryDepth as ChatMemoryDepth));
		setDraftGithubEnabled(lastConfig.memoryGithubEnabled ?? defaults.githubSync);
		setDraftPersona(lastConfig.character ?? defaults.persona);
		setDraftModel(lastConfig.model ?? defaults.model);
	}, [active, defaults, lastConfig]);

	useEffect(() => {
		savePresets(presets);
	}, [presets]);

	useEffect(() => {
		let mounted = true;
		void fetchChatWorkbenchSnapshot(FALLBACK_CHAT_WORKBENCH).then((snapshot) => {
			if (mounted) {
				setWorkbenchSnapshot(snapshot);
			}
		});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!lastConfig.character && !draftPersona && workbenchSnapshot.defaults.persona) {
			setDraftPersona(workbenchSnapshot.defaults.persona);
		}
		if (!lastConfig.model && !draftModel && workbenchSnapshot.defaults.model) {
			setDraftModel(workbenchSnapshot.defaults.model);
		}
	}, [workbenchSnapshot.defaults.persona, workbenchSnapshot.defaults.model, lastConfig.character, lastConfig.model, draftPersona, draftModel]);

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
				const injected = injectWorkflowIntoMessage(trimmed, workflowJson, workflowInjection, workflowSelectionMode);
				if (injected.error) {
					setFormError(injected.error);
					return;
				}
				await sendMessage(injected.content);
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
			id: generateId(),
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
			id: generateId(),
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

	const handleViewBranch = (branchId: string) => {
		setActiveBranchId(branchId);
	};

	const handleDeleteBranch = (branchId: string) => {
		setBranches((previous) => previous.filter((entry) => entry.id !== branchId));
		setActiveBranchId((current) => (current === branchId ? null : current));
	};

	return (
		<div className="flex h-full min-h-0 min-w-0 w-full flex-col gap-3 p-2 sm:gap-4 sm:p-3 lg:flex-row lg:items-stretch">
			<aside className="order-1 flex w-full min-w-0 flex-col gap-3 sm:gap-4 lg:order-2 lg:w-80 lg:min-w-0">
				<Card className="border-border/40">
					<Tabs value={sideTab} onValueChange={(value) => setSideTab(value as "session" | "presets" | "branches")}
						className="space-y-2">
						<CardHeader className="space-y-2 pb-1">
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger value="session" className="text-xs gap-1">
									<Bot className="h-3 w-3" /> Session
								</TabsTrigger>
								<TabsTrigger value="presets" className="text-xs gap-1">
									<Settings2 className="h-3 w-3" /> Settings
								</TabsTrigger>
								<TabsTrigger value="branches" className="text-xs gap-1">
									<GitFork className="h-3 w-3" /> Branches
								</TabsTrigger>
							</TabsList>
						</CardHeader>
						<CardContent className="space-y-4 text-sm">
							<TabsContent value="session" className="m-0 space-y-3">
								{active ? (
									<div className="space-y-3 text-xs">
										<div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
											<div className="flex items-center gap-2">
												<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
												<span className="text-[11px] font-medium text-foreground">Active session</span>
											</div>
											<div className="space-y-1.5 text-[11px]">
												<div className="flex justify-between">
													<span className="text-muted-foreground">Persona</span>
													<span className="font-medium text-foreground">{sessionMeta.personaLabel}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Model</span>
													<span className="font-medium text-foreground">{model ?? "default"}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Memory</span>
													<span className="font-medium text-foreground">{sessionMeta.memoryLabel}</span>
												</div>
											</div>
										</div>
										<Button variant="outline" size="sm" className="w-full" onClick={() => void exitChat()} disabled={pending}>
											End session
										</Button>
									</div>
								) : (
									<ChatSessionForm
										workbenchSnapshot={workbenchSnapshot}
										pending={pending}
										formError={formError}
										draftPersona={draftPersona}
										draftModel={draftModel}
										draftMemoryEnabled={draftMemoryEnabled}
										draftMemoryDepth={draftMemoryDepth}
										draftGithubEnabled={draftGithubEnabled}
										onPersonaChange={setDraftPersona}
										onModelChange={setDraftModel}
										onMemoryEnabledChange={setDraftMemoryEnabled}
										onMemoryDepthChange={setDraftMemoryDepth}
										onGithubEnabledChange={setDraftGithubEnabled}
										onQuickPrompt={setMessage}
										onStart={handleStart}
									/>
								)}
								{memoryContext.length > 0 ? (
									<div className="rounded-lg border border-border/60 bg-background/70 p-3 text-xs">
										<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Memory context</p>
										<ScrollArea className="mt-2 h-full max-h-[40vh] pr-2">
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
								<ChatSettingsPanel
									draftSystemPrompt={draftSystemPrompt}
									draftTemperature={draftTemperature}
									onSystemPromptChange={setDraftSystemPrompt}
									onTemperatureChange={handleTemperatureChange}
									workflowInjection={workflowInjection}
									workflowSelectionMode={workflowSelectionMode}
									workflowJson={workflowJson}
									onWorkflowInjectionChange={setWorkflowInjection}
									onWorkflowSelectionModeChange={setWorkflowSelectionMode}
									onWorkflowJsonChange={setWorkflowJson}
									presets={presets}
									presetName={presetName}
									onPresetNameChange={setPresetName}
									onSavePreset={handleSavePreset}
									onApplyPreset={handleApplyPreset}
									onDeletePreset={handleDeletePreset}
								/>
							</TabsContent>
							<TabsContent value="branches" className="m-0 space-y-2 text-xs">
								<ChatBranchPanel
									branches={branches}
									onViewBranch={handleViewBranch}
									onDeleteBranch={handleDeleteBranch}
								/>
							</TabsContent>
						</CardContent>
					</Tabs>
				</Card>
			</aside>
			<section className="order-2 flex min-h-0 flex-1 flex-col gap-4 lg:order-1">
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab((value as "live" | "history") ?? "live")}
					className="flex h-full min-h-0 flex-1 flex-col gap-4"
				>
					<div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-gradient-to-r from-background to-muted/30 px-4 py-2.5">
						<div className="flex items-center gap-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
								<MessageSquare className="h-4 w-4 text-primary" />
							</div>
							<div>
								<p className="text-sm font-semibold text-foreground">Chat</p>
								<p className="text-[10px] text-muted-foreground">Terminal-synced console</p>
							</div>
							<TabsList className="ml-2 bg-transparent p-0">
								<TabsTrigger value="live" className="h-7 px-3 text-xs">Live</TabsTrigger>
								<TabsTrigger value="history" className="h-7 px-3 text-xs">History</TabsTrigger>
							</TabsList>
						</div>
						<div className="hidden items-center gap-2 sm:flex">
							<div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-[11px]">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								<span className="text-muted-foreground">{sessionMeta.personaLabel}</span>
							</div>
							<div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-[11px]">
								<span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
								<span className="text-muted-foreground">{model ?? "default"}</span>
							</div>
							<div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-[11px]">
								<span className={`h-1.5 w-1.5 rounded-full ${memoryEnabled ? "bg-violet-500" : "bg-zinc-400"}`} />
								<span className="text-muted-foreground">{sessionMeta.memoryLabel}</span>
							</div>
						</div>
					</div>
					<TabsContent value="live" className="flex min-h-0 flex-1 flex-col">
							<Card className="flex min-h-0 flex-1 flex-col border-border/40 bg-background shadow-sm">
								<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/40 py-2.5">
									<div className="flex items-center gap-2">
										<Bot className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm">Conversation</CardTitle>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										{prompt && <span className="max-w-[200px] truncate rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[10px]">{prompt}</span>}
										{active && (
											<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void exitChat()} disabled={pending}>
												End
											</Button>
										)}
								</div>
							</CardHeader>
							<CardContent className="flex min-h-0 flex-1 flex-col gap-4">
								<ScrollArea className="flex-1 pr-2">
									<div className="space-y-3 text-sm">
										{displayHistory.length === 0 ? (
												<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
													<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
														<MessageSquare className="h-7 w-7 text-primary/40" />
													</div>
													<div className="max-w-sm space-y-1.5">
														<p className="text-sm font-medium text-foreground/70">{active ? "Ready to chat" : "Start a session"}</p>
														<p className="text-xs text-muted-foreground">{active ? "Send a message to start the conversation." : "Pick a model and persona, then click Start. Try the Settings tab for workflow injection and presets."}</p>
													</div>
												</div>
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
									<div className="flex items-end gap-2 rounded-xl border border-border/40 bg-background p-2 shadow-sm transition-colors focus-within:border-primary/30 focus-within:shadow-md">
										<Textarea
											ref={inputRef}
											value={message}
											onChange={(event) => setMessage(event.target.value)}
											placeholder={active ? "Type a message or /command…" : "Start a session to chat…"}
											className="min-h-[56px] max-h-[160px] flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
											disabled={!active || pending || isStreaming || isBranchView}
										/>
										<div className="flex shrink-0 items-center gap-1.5 pb-1">
											{isBranchView && (
												<Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={handleClearBranchView}>
													Return
												</Button>
											)}
											{isStreaming && (
												<Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={handleCancel}>
													<Square className="h-3.5 w-3.5" />
												</Button>
											)}
											<Button type="submit" size="icon" className="h-8 w-8" disabled={!active || pending || isStreaming || isBranchView || !message.trim()}>
												<Send className="h-4 w-4" />
											</Button>
										</div>
									</div>
									{active && formError ? <p className="px-1 text-xs text-destructive">{formError}</p> : null}
									{lastError ? <p className="px-1 text-xs text-destructive">{lastError}</p> : null}
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

