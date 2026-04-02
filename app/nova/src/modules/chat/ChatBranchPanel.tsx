/**
 * Why: Isolates branch management from the main ChatSurface.
 * What: Lists conversation branches (forked snapshots), allows viewing and deleting.
 * How: Pure presentational component; branch state lives in parent. Mirrors chatbot-ui's sidebar item pattern.
 */

import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatBranch } from "@/modules/chat/chatPresets";

/* ── Props contract ────────────────────────────────────────────────── */

export interface ChatBranchPanelProps {
	branches: ChatBranch[];
	onViewBranch: (branchId: string) => void;
	onDeleteBranch: (branchId: string) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function ChatBranchPanel({ branches, onViewBranch, onDeleteBranch }: ChatBranchPanelProps): JSX.Element {
	return (
		<div className="space-y-2 text-xs">
			{branches.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-6 text-center">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
						<GitBranch className="h-5 w-5 text-muted-foreground/40" />
					</div>
					<div className="space-y-0.5">
						<p className="text-xs font-medium text-muted-foreground">No branches yet</p>
						<p className="text-[11px] text-muted-foreground/60">Fork any message to create a branch.</p>
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{branches.map((branch) => (
						<div key={branch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 p-2">
							<div className="min-w-0">
								<p className="truncate text-xs font-semibold text-foreground">{branch.name}</p>
								<p className="text-[11px] text-muted-foreground">{branch.messages.length} messages</p>
							</div>
							<div className="flex flex-wrap items-center gap-1">
								<Button variant="outline" size="sm" onClick={() => onViewBranch(branch.id)}>
									View
								</Button>
								<Button variant="ghost" size="sm" onClick={() => onDeleteBranch(branch.id)}>
									Delete
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
			{branches.length > 0 && <p className="text-center text-[10px] text-muted-foreground/60">Branches are read-only snapshots.</p>}
		</div>
	);
}
