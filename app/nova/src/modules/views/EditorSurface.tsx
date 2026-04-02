/**
 * Why: Provide a preliminary web explorer scaffold with workspace tree + Git safety primitives.
 * What: Renders tree browsing, file preview, Git branch/status controls, and file-level revert/history.
 * How: Fetches /api/files and /api/files/git snapshots with graceful fallback to mock tree data.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { explorerTree } from "@/modules/data/mockWorkspace";
import {
	fetchExplorerTree,
	previewExplorerFile,
	searchExplorerPaths,
	type ExplorerTreeNode,
} from "@/modules/explorer/explorerClient";
import {
	checkoutGitBranch,
	createGitBranch,
	fetchFileGitHistory,
	fetchGitBranches,
	fetchGitStatus,
	revertFileViaGit,
	type GitBranch,
	type GitCommitSummary,
	type GitStatusFile,
} from "@/modules/explorer/workspaceGitClient";
import { cn } from "@/lib/utils";
import { AlertTriangle, File, Folder, GitBranch as GitBranchIcon, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface TreeNode {
	readonly name: string;
	readonly path: string;
	readonly type: "file" | "directory";
	readonly children?: readonly TreeNode[];
}

export function EditorSurface(): JSX.Element {
	const [nodes, setNodes] = useState<readonly TreeNode[]>([]);
	const [selectedPath, setSelectedPath] = useState<string>("");
	const [selectedContent, setSelectedContent] = useState<string>("Select a file to preview.");
	const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
	const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState<string>("");
	const [searchResults, setSearchResults] = useState<readonly string[]>([]);

	const [gitBranchInput, setGitBranchInput] = useState<string>("");
	const [gitBranches, setGitBranches] = useState<readonly GitBranch[]>([]);
	const [gitCurrentBranch, setGitCurrentBranch] = useState<string>("");
	const [gitFiles, setGitFiles] = useState<readonly GitStatusFile[]>([]);
	const [gitHistory, setGitHistory] = useState<readonly GitCommitSummary[]>([]);
	const [gitError, setGitError] = useState<string | null>(null);
	const [isLoadingGit, setIsLoadingGit] = useState<boolean>(false);

	const loadTree = useCallback(async () => {
		setIsLoadingTree(true);
		setLoadError(null);
		try {
			const tree = await fetchExplorerTree(".", 4);
			setNodes(tree.nodes.map(mapTreeNode));
		} catch (error) {
			setNodes(mapMockTree(explorerTree));
			setLoadError(error instanceof Error ? error.message : "Failed to load workspace tree.");
		}
		setIsLoadingTree(false);
	}, []);

	const loadGit = useCallback(async () => {
		setIsLoadingGit(true);
		setGitError(null);
		try {
			const [status, branches] = await Promise.all([fetchGitStatus(), fetchGitBranches()]);
			setGitCurrentBranch(status.branch);
			setGitFiles(status.files);
			setGitBranches(branches.branches);
		} catch (error) {
			setGitError(error instanceof Error ? error.message : "Failed to load git snapshot.");
		}
		setIsLoadingGit(false);
	}, []);

	useEffect(() => {
		void loadTree();
		void loadGit();
	}, [loadTree, loadGit]);

	const selectFile = useCallback(async (path: string) => {
		setSelectedPath(path);
		setIsLoadingFile(true);
		try {
			const file = await previewExplorerFile(path);
			setSelectedContent(file.content || "");
		} catch (error) {
			setSelectedContent(error instanceof Error ? error.message : "Failed to preview file.");
		}
		setIsLoadingFile(false);
		try {
			const history = await fetchFileGitHistory(path);
			setGitHistory(history.commits);
		} catch {
			setGitHistory([]);
		}
	}, []);

	const handleSearch = useCallback(async () => {
		if (!search.trim()) {
			setSearchResults([]);
			return;
		}
		try {
			const result = await searchExplorerPaths(search.trim());
			setSearchResults(result.results.map((entry) => entry.path));
		} catch {
			setSearchResults([]);
		}
	}, [search]);

	const handleCreateBranch = useCallback(async () => {
		if (!gitBranchInput.trim()) return;
		try {
			const snapshot = await createGitBranch(gitBranchInput.trim());
			setGitBranches(snapshot.branches);
			setGitBranchInput("");
		} catch (error) {
			setGitError(error instanceof Error ? error.message : "Failed to create branch.");
		}
	}, [gitBranchInput]);

	const handleCheckout = useCallback(async (branch: string) => {
		try {
			const status = await checkoutGitBranch(branch);
			setGitCurrentBranch(status.branch);
			setGitFiles(status.files);
			await loadTree();
		} catch (error) {
			setGitError(error instanceof Error ? error.message : "Failed to checkout branch.");
		}
	}, [loadTree]);

	const handleRevert = useCallback(async () => {
		if (!selectedPath) return;
		try {
			const status = await revertFileViaGit(selectedPath);
			setGitFiles(status.files);
			await selectFile(selectedPath);
		} catch (error) {
			setGitError(error instanceof Error ? error.message : "Failed to revert file.");
		}
	}, [selectedPath, selectFile]);

	const changedFileSet = useMemo(() => new Set(gitFiles.map((entry) => entry.path)), [gitFiles]);

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 sm:p-4">
			<header className="flex flex-wrap items-center justify-between gap-2">
				<div className="space-y-1">
					<p className="text-xs uppercase tracking-widest text-muted-foreground">Explorer / Workspace Tree</p>
					<h1 className="text-base font-semibold sm:text-lg">Branch-safe file management</h1>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="uppercase">{gitCurrentBranch || "No branch"}</Badge>
					<Button size="sm" variant="secondary" onClick={() => { void loadTree(); void loadGit(); }}>
						<RefreshCw className="mr-1 h-4 w-4" /> Refresh
					</Button>
				</div>
			</header>

			{(loadError || gitError) ? (
				<div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
					<AlertTriangle className="h-4 w-4" />
					{gitError ?? loadError}
				</div>
			) : null}

			<section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)_minmax(0,0.45fr)]">
				<Card className="border-border/60 bg-background/80">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Workspace Tree</CardTitle>
						<CardDescription className="text-xs text-muted-foreground">Click folders/files to inspect and manage revisions.</CardDescription>
						<div className="flex items-center gap-2 pt-2">
							<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files" />
							<Button size="sm" variant="secondary" onClick={() => void handleSearch()}>Find</Button>
						</div>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[52vh] rounded-md border border-border/50 p-2">
							{isLoadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <TreePanel nodes={nodes} onSelectFile={(path) => void selectFile(path)} changedFileSet={changedFileSet} />}
							{searchResults.length > 0 ? (
								<div className="mt-3 space-y-1 border-t border-border/60 pt-3">
									<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Search results</p>
									{searchResults.map((result) => (
										<button
											key={result}
											type="button"
											onClick={() => void selectFile(result)}
											className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted/40"
										>
											{result}
										</button>
									))}
								</div>
							) : null}
						</ScrollArea>
					</CardContent>
				</Card>

				<Card className="border-border/60 bg-background/80">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">File Preview</CardTitle>
						<CardDescription className="text-xs text-muted-foreground">{selectedPath || "No file selected"}</CardDescription>
						<div className="flex items-center gap-2">
							<Button size="sm" variant="outline" onClick={() => void handleRevert()} disabled={!selectedPath}>
								<Undo2 className="mr-1 h-4 w-4" /> Revert file
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[52vh] rounded-md border border-border/50 bg-background/80">
							<pre className="p-3 text-xs leading-relaxed">
								<code>{isLoadingFile ? "Loading preview..." : selectedContent}</code>
							</pre>
						</ScrollArea>
					</CardContent>
				</Card>

				<Card className="border-border/60 bg-background/80">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Git Primitives</CardTitle>
						<CardDescription className="text-xs text-muted-foreground">Branch, inspect changes, and review file history.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<Input
									value={gitBranchInput}
									onChange={(event) => setGitBranchInput(event.target.value)}
									placeholder="new branch name"
								/>
								<Button size="sm" onClick={() => void handleCreateBranch()}>Create</Button>
							</div>
							<ScrollArea className="h-28 rounded-md border border-border/50 p-2">
								{isLoadingGit ? <Loader2 className="h-4 w-4 animate-spin" /> : gitBranches.map((branch) => (
									<div key={branch.name} className="flex items-center justify-between gap-2 py-1 text-xs">
										<div className="flex items-center gap-2">
											<GitBranchIcon className="h-3.5 w-3.5 text-muted-foreground" />
											<span className={cn(branch.current ? "font-semibold" : "")}>{branch.name}</span>
										</div>
										{!branch.current ? <Button size="sm" variant="ghost" onClick={() => void handleCheckout(branch.name)}>Switch</Button> : <Badge variant="outline">current</Badge>}
									</div>
								))}
							</ScrollArea>
						</div>
						<Separator />
						<div>
							<p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Changed Files</p>
							<ScrollArea className="h-24 rounded-md border border-border/50 p-2">
								{gitFiles.length === 0 ? <p className="text-xs text-muted-foreground">Workspace clean</p> : gitFiles.map((file) => (
									<div key={file.path} className="flex items-center justify-between gap-2 py-1 text-xs">
										<span className="truncate">{file.path}</span>
										<Badge variant="outline">{file.code}</Badge>
									</div>
								))}
							</ScrollArea>
						</div>
						<div>
							<p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">File History</p>
							<ScrollArea className="h-28 rounded-md border border-border/50 p-2">
								{gitHistory.length === 0 ? <p className="text-xs text-muted-foreground">Select a file to load commits.</p> : gitHistory.map((commit) => (
									<div key={commit.hash} className="space-y-0.5 py-1 text-xs">
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium">{commit.shortHash}</span>
											<span className="text-muted-foreground">{commit.author}</span>
										</div>
										<p className="text-muted-foreground">{commit.subject}</p>
									</div>
								))}
							</ScrollArea>
						</div>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}

function TreePanel({
	nodes,
	onSelectFile,
	changedFileSet,
}: {
	nodes: readonly TreeNode[];
	onSelectFile: (path: string) => void;
	changedFileSet: ReadonlySet<string>;
}): JSX.Element {
	return (
		<nav className="space-y-0.5" aria-label="Workspace tree">
			{nodes.map((node) => (
				<TreeItem key={node.path} node={node} depth={0} onSelectFile={onSelectFile} changedFileSet={changedFileSet} />
			))}
		</nav>
	);
}

function TreeItem({
	node,
	depth,
	onSelectFile,
	changedFileSet,
}: {
	node: TreeNode;
	depth: number;
	onSelectFile: (path: string) => void;
	changedFileSet: ReadonlySet<string>;
}): JSX.Element {
	const [expanded, setExpanded] = useState<boolean>(depth < 2);
	const hasChildren = node.type === "directory" && Array.isArray(node.children) && node.children.length > 0;
	const isChanged = changedFileSet.has(node.path);

	if (node.type === "directory") {
		return (
			<div className="space-y-0.5">
				<button
					type="button"
					onClick={() => setExpanded((prev) => !prev)}
					className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted/40"
					style={{ paddingLeft: `${depth * 12 + 8}px` }}
				>
					<Folder className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="truncate">{node.name}</span>
				</button>
				{expanded && hasChildren ? node.children!.map((child) => (
					<TreeItem key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} changedFileSet={changedFileSet} />
				)) : null}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => onSelectFile(node.path)}
			className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted/40"
			style={{ paddingLeft: `${depth * 12 + 8}px` }}
		>
			<File className="h-3.5 w-3.5 text-muted-foreground" />
			<span className="truncate">{node.name}</span>
			{isChanged ? <Badge variant="outline" className="ml-auto h-5 text-[9px]">changed</Badge> : null}
		</button>
	);
}

function mapTreeNode(node: ExplorerTreeNode): TreeNode {
	return {
		name: node.name,
		path: node.path,
		type: node.type,
		children: node.children?.map(mapTreeNode),
	};
}

function mapMockTree(nodes: typeof explorerTree): readonly TreeNode[] {
	const mapNode = (node: any, parentPath = ""): TreeNode => {
		const path = parentPath ? `${parentPath}/${node.name}` : node.name;
		return {
			name: node.name,
			path,
			type: node.type === "folder" ? "directory" : "file",
			children: Array.isArray(node.children) ? node.children.map((child: any) => mapNode(child, path)) : undefined,
		};
	};
	return nodes.map((node) => mapNode(node));
}

