/**
 * @license INTERNAL ONLY — Explorer tree (Step 1 mock)
 *
 * Why: Mirror the workspace file navigation for parity during the Nova migration.
 * What: Render a read-only tree of folders/files sourced from mockWorkspace data.
 * How: Recursively walk mock nodes, apply depth-based padding, and surface icons.
 */

import type { FileNode } from "@/modules/data/mockWorkspace";
import { cn } from "@/lib/utils";

export interface ExplorerTreeProps {
	readonly nodes: readonly FileNode[];
}

const INDENT_BASE = 12;

export function ExplorerTree({ nodes }: ExplorerTreeProps): JSX.Element {
	return (
		<nav aria-label="Workspace files" className="mt-2 space-y-1">
			{nodes.map((node) => (
				<ExplorerNode key={node.id} node={node} depth={0} />
			))}
		</nav>
	);
}

interface ExplorerNodeProps {
	readonly node: FileNode;
	readonly depth: number;
}

function ExplorerNode({ node, depth }: ExplorerNodeProps): JSX.Element {
	const Icon = node.icon;
	const hasChildren = Array.isArray(node.children) && node.children.length > 0;
	const padding = depth * INDENT_BASE;

	return (
		<div className="space-y-1 text-sm">
			<div
				className={cn(
					"flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-muted/30",
					node.type === "folder" ? "font-semibold" : "text-muted-foreground",
				)}
				style={{ paddingLeft: `${padding}px` }}
			>
				{Icon ? <Icon className="h-4 w-4" /> : null}
				<span>{node.name}</span>
			</div>
			{hasChildren ? (
				<div className="space-y-1">
					{node.children!.map((child) => (
						<ExplorerNode key={child.id} node={child} depth={depth + 1} />
					))}
				</div>
			) : null}
		</div>
	);
}

