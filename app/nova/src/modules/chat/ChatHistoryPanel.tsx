/**
 * @license INTERNAL ONLY — Chat history panel
 *
 * Why: Allow operators to inspect, export, and purge stored chat transcripts without leaving Nova.
 * What: Fetches chat conversation summaries, renders searchable lists, and exposes detail actions in a responsive layout.
 * How: Drive client fetches through the chat history API helpers, maintain observable async state, and stream results into scrollable cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownToLine, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
	deleteChatConversation,
	exportChatConversation,
	getChatConversation,
	linkConversationWorkspaceBranch,
	listConversationWorkspaceSnapshots,
	listChatConversations,
	type AsyncStatus,
	type ChatConversationDetail,
	type ChatConversationSummary,
	type ChatWorkspaceSnapshot,
} from "@/modules/chat/chatHistoryClient";

interface ChatHistoryPanelProps {
	readonly active: boolean;
}

export function ChatHistoryPanel({ active }: ChatHistoryPanelProps): JSX.Element {
	const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
	const [retentionDays, setRetentionDays] = useState<number | null>(null);
	const [maxMessages, setMaxMessages] = useState<number | null>(null);
	const [listStatus, setListStatus] = useState<AsyncStatus>("idle");
	const [listError, setListError] = useState<string | null>(null);
	const [filter, setFilter] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detail, setDetail] = useState<ChatConversationDetail | null>(null);
	const [detailStatus, setDetailStatus] = useState<AsyncStatus>("idle");
	const [detailError, setDetailError] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [workspaceBranchName, setWorkspaceBranchName] = useState("");
	const [workspaceBaseBranch, setWorkspaceBaseBranch] = useState("");
	const [snapshots, setSnapshots] = useState<ChatWorkspaceSnapshot[]>([]);
	const [snapshotStatus, setSnapshotStatus] = useState<AsyncStatus>("idle");
	const [snapshotError, setSnapshotError] = useState<string | null>(null);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const filteredConversations = useMemo(() => {
		const query = filter.trim().toLowerCase();
		if (!query) {
			return conversations;
		}
		return conversations.filter((conversation) => {
			const haystack = [
				conversation.id,
				conversation.origin ?? "",
				conversation.user?.username ?? "",
				conversation.user?.id ?? "",
				conversation.tags.join(" "),
			].join(" ").toLowerCase();
			return haystack.includes(query);
		});
	}, [conversations, filter]);

	const refreshList = useCallback(async () => {
		setListStatus("loading");
		setListError(null);
		try {
			const payload = await listChatConversations();
			if (!isMountedRef.current) {
				return;
			}
			setConversations([...payload.conversations]);
			setRetentionDays(payload.retentionDays ?? null);
			setMaxMessages(payload.maxMessagesPerConversation ?? null);
			setListStatus("success");
			if ((payload.conversations.length ?? 0) > 0) {
				const preferred = payload.conversations.find((conversation) => conversation.id === selectedId);
				const first = preferred ?? payload.conversations[0];
				setSelectedId(first.id);
			}
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to load chat history.";
			setListError(message);
			setListStatus("error");
			setConversations([]);
		}
	}, [selectedId]);

	const loadConversation = useCallback(async (conversationId: string) => {
		setDetailStatus("loading");
		setDetailError(null);
		try {
			const payload = await getChatConversation(conversationId);
			if (!isMountedRef.current) {
				return;
			}
			setDetail(payload);
			setWorkspaceBranchName(payload.workspace?.branchName ?? "");
			setWorkspaceBaseBranch(payload.workspace?.baseBranch ?? "");
			setDetailStatus("success");
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to load conversation.";
			setDetailStatus("error");
			setDetailError(message);
		}
	}, []);

	const refreshSnapshots = useCallback(async (conversationId: string) => {
		setSnapshotStatus("loading");
		setSnapshotError(null);
		try {
			const payload = await listConversationWorkspaceSnapshots(conversationId);
			if (!isMountedRef.current) {
				return;
			}
			setSnapshots([...payload]);
			setSnapshotStatus("success");
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to load workspace snapshots.";
			setSnapshotError(message);
			setSnapshotStatus("error");
			setSnapshots([]);
		}
	}, []);

	useEffect(() => {
		if (!active || listStatus !== "idle") {
			return;
		}
		void refreshList();
	}, [active, listStatus, refreshList]);

	useEffect(() => {
		if (!active || !selectedId) {
			return;
		}
		void loadConversation(selectedId);
		void refreshSnapshots(selectedId);
	}, [active, selectedId, loadConversation, refreshSnapshots]);

	const handleSelect = useCallback((conversation: ChatConversationSummary) => {
		setSelectedId(conversation.id);
		setDetail(null);
	}, []);

	const handleExport = useCallback(async () => {
		if (!selectedId) {
			return;
		}
		setActionMessage(null);
		try {
			const payload = await exportChatConversation(selectedId);
			if (!isMountedRef.current) {
				return;
			}
			const blob = new Blob([payload], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			link.download = `chat-${selectedId}-${timestamp}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			setActionMessage("Conversation export started.");
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to export conversation.";
			setActionMessage(message);
		}
	}, [selectedId]);

	const handleDelete = useCallback(async () => {
		if (!selectedId) {
			return;
		}
		setActionMessage(null);
		const confirmed = window.confirm("Delete this conversation permanently?");
		if (!confirmed) {
			return;
		}
		try {
			await deleteChatConversation(selectedId);
			if (!isMountedRef.current) {
				return;
			}
			setActionMessage("Conversation deleted.");
			setConversations((previous) => previous.filter((entry) => entry.id !== selectedId));
			setDetail(null);
			setSelectedId(null);
			setDetailStatus("idle");
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to delete conversation.";
			setActionMessage(message);
		}
	}, [selectedId]);

	const handleLinkWorkspace = useCallback(async () => {
		if (!selectedId) {
			return;
		}
		const branchName = workspaceBranchName.trim();
		if (!branchName) {
			setActionMessage("Workspace branch name is required.");
			return;
		}
		setActionMessage(null);
		try {
			await linkConversationWorkspaceBranch(selectedId, {
				branchName,
				baseBranch: workspaceBaseBranch.trim() || null,
				createBranch: true,
				checkout: true,
			});
			if (!isMountedRef.current) {
				return;
			}
			await Promise.all([loadConversation(selectedId), refreshSnapshots(selectedId)]);
			setActionMessage(`Conversation linked to workspace branch '${branchName}'.`);
		} catch (error) {
			if (!isMountedRef.current) {
				return;
			}
			const message = error instanceof Error ? error.message : "Failed to link workspace branch.";
			setActionMessage(message);
		}
	}, [loadConversation, refreshSnapshots, selectedId, workspaceBaseBranch, workspaceBranchName]);

	const listEmpty = listStatus === "success" && filteredConversations.length === 0;
	const detailReady = detailStatus === "success" && detail;

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
			<Card className="border-border/60 bg-background/70">
				<CardHeader className="space-y-2">
					<CardTitle className="text-sm">Chat transcripts</CardTitle>
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<span>Total conversations: <strong>{conversations.length}</strong></span>
						{retentionDays != null ? <span>Retention policy: {retentionDays} day{retentionDays === 1 ? "" : "s"}</span> : null}
						{maxMessages != null ? <span>Max stored messages: {maxMessages}</span> : null}
					</div>
				</CardHeader>
				<CardFooter className="flex items-center gap-2 border-t border-border/60 py-2">
					<Button variant="secondary" size="sm" onClick={() => void refreshList()} disabled={listStatus === "loading"}>
						{listStatus === "loading" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
						Refresh
					</Button>
					<div className="ml-auto text-xs text-muted-foreground">
						{listStatus === "error" && listError ? (
							<span className="flex items-center gap-1 text-destructive">
								<AlertCircle className="h-3 w-3" />
								{listError}
							</span>
						) : null}
						{listStatus === "success" && actionMessage ? <span>{actionMessage}</span> : null}
					</div>
				</CardFooter>
			</Card>
			<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
				<Card className="flex min-h-0 flex-col border-border/60 bg-background/70">
					<CardHeader className="space-y-3 border-b border-border/60 pb-3">
						<div className="flex items-center justify-between gap-2">
							<CardTitle className="text-sm">Conversations</CardTitle>
						</div>
						<Input
							value={filter}
							placeholder="Search conversations"
							onChange={(event) => setFilter(event.target.value)}
							className="h-9 text-sm"
						/>
					</CardHeader>
					<CardContent className="flex-1 overflow-hidden p-0">
						{listStatus === "loading" ? (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading conversations…
							</div>
						) : listEmpty ? (
							<div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
								No conversations match the current filter.
							</div>
						) : (
							<ScrollArea className="h-full">
								<ul className="divide-y divide-border/60">
									{filteredConversations.map((conversation) => (
										<li key={conversation.id}>
											<button
												type="button"
												onClick={() => handleSelect(conversation)}
												className={cn(
													"flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-muted/40",
													conversation.id === selectedId ? "bg-muted/50" : undefined,
												)}
											>
												<span className="font-medium leading-tight">{conversation.id}</span>
												<span className="text-xs text-muted-foreground">
													{formatUpdated(conversation.updatedAt ?? conversation.startedAt)}
												</span>
												<div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
													{conversation.user?.username ? <Badge variant="outline">{conversation.user.username}</Badge> : null}
													{conversation.origin ? <Badge variant="secondary">{conversation.origin}</Badge> : null}
													<Badge variant="outline">{conversation.messageCount} msg</Badge>
													{conversation.tags.slice(0, 3).map((tag) => (
														<Badge key={tag} variant="ghost" className="uppercase tracking-[0.2em]">
															{tag}
														</Badge>
													))}
												</div>
											</button>
										</li>
									))}
								</ul>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
				<Card className="flex min-h-0 flex-col border-border/60 bg-background/90">
					<CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
						<CardTitle className="text-sm">Conversation detail</CardTitle>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={!selectedId || detailStatus === "loading"}>
								<ArrowDownToLine className="mr-1.5 h-4 w-4" /> Export
							</Button>
							<Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={!selectedId || detailStatus === "loading"}>
								<Trash2 className="mr-1.5 h-4 w-4" /> Delete
							</Button>
						</div>
					</CardHeader>
					<CardContent className="flex-1 overflow-hidden p-0">
						{detailStatus === "loading" ? (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading conversation…
							</div>
						) : detailStatus === "error" ? (
							<div className="flex h-full items-center justify-center px-6 text-center text-xs text-destructive">
								{detailError ?? "Failed to load conversation."}
							</div>
						) : detailReady ? (
							<ScrollArea className="h-full">
								<div className="space-y-4 p-4 text-sm">
									<section className="space-y-2">
										<h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Metadata</h3>
										<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
											<MetadataItem label="Conversation ID" value={detail.id} />
											<MetadataItem label="User" value={detail.user?.username ?? detail.user?.id ?? "anonymous"} />
											<MetadataItem label="Origin" value={detail.origin ?? "unknown"} />
											<MetadataItem label="Started" value={formatTimestamp(detail.startedAt)} />
											<MetadataItem label="Updated" value={formatTimestamp(detail.updatedAt)} />
											<MetadataItem label="Ended" value={formatTimestamp(detail.endedAt)} />
											<MetadataItem label="Messages" value={String(detail.messages.length)} />
											<MetadataItem label="Tags" value={detail.tags.length ? detail.tags.join(", ") : "none"} />
											<MetadataItem label="Workspace branch" value={detail.workspace?.branchName ?? "unlinked"} />
										</div>
									</section>
									<Separator className="my-4" />
									<section className="space-y-3">
										<h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Workspace branching</h3>
										<div className="grid gap-2 sm:grid-cols-2">
											<Input
												value={workspaceBranchName}
												placeholder="conversation/my-branch"
												onChange={(event) => setWorkspaceBranchName(event.target.value)}
												className="h-9 text-sm"
											/>
											<Input
												value={workspaceBaseBranch}
												placeholder="base branch (optional)"
												onChange={(event) => setWorkspaceBaseBranch(event.target.value)}
												className="h-9 text-sm"
											/>
										</div>
										<div className="flex flex-wrap items-center gap-2">
											<Button variant="secondary" size="sm" onClick={() => void handleLinkWorkspace()} disabled={!selectedId}>
												Link + checkout branch
											</Button>
											<span className="text-[11px] text-muted-foreground">Creates the branch if needed and binds this chat to it.</span>
										</div>
										{snapshotStatus === "error" && snapshotError ? (
											<p className="text-xs text-destructive">{snapshotError}</p>
										) : null}
										{snapshots.length > 0 ? (
											<ul className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-3">
												{snapshots.slice(0, 8).map((snapshot) => (
													<li key={snapshot.id} className="text-xs text-muted-foreground">
														<span className="font-medium text-foreground">{snapshot.type}</span>
														{snapshot.branchName ? ` • ${snapshot.branchName}` : ""}
														{snapshot.createdAt ? ` • ${formatTimestamp(snapshot.createdAt)}` : ""}
													</li>
												))}
											</ul>
										) : (
											<p className="text-xs text-muted-foreground">No workspace snapshots recorded yet.</p>
										)}
									</section>
									<Separator className="my-4" />
									<section className="space-y-3">
										<h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Messages</h3>
										{detail.messages.length === 0 ? (
											<p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
												No messages stored for this conversation.
											</p>
										) : (
											<ul className="space-y-3">
												{detail.messages.map((message) => (
													<li key={message.id ?? `${message.role}-${message.createdAt ?? Math.random()}`} className="rounded-lg border border-border/60 bg-background/70 p-3">
														<header className="mb-1 flex flex-wrap items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
															<span>{message.role}</span>
															<span>{formatTimestamp(message.createdAt)}</span>
														</header>
														<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{message.content}</p>
													</li>
												))}
											</ul>
										)}
									</section>
								</div>
							</ScrollArea>
						) : (
							<div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
								Select a conversation to inspect messages.
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function MetadataItem({ label, value }: { label: string; value: string }): JSX.Element {
	return (
		<div>
			<p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground/70">{label}</p>
			<p className="mt-0.5 text-sm text-foreground">{value}</p>
		</div>
	);
}

function formatTimestamp(value: string | null): string {
	if (!value) {
		return "—";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	})
		.format(date)
		.replace(",", " •");
}

function formatUpdated(value: string | null): string {
	if (!value) {
		return "Updated —";
	}
	return `Updated ${formatTimestamp(value)}`;
}
