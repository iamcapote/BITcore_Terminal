/**
 * @license INTERNAL ONLY — Editor surface (Step 1 mock)
 *
 * Why: Provide a primary studio view while the real code editor binds later.
 * What: Presents mock workspace metrics alongside a read-only code excerpt.
 * How: Render metrics cards from mock data and a scrollable code panel for layout parity.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { workspaceMetrics, explorerTree, quickStats } from "@/modules/data/mockWorkspace";
import { ExplorerTree } from "@/modules/navigation/ExplorerTree";
import { Copy, Save, Sparkles } from "lucide-react";

const SAMPLE_SOURCE = `import { planMission } from "@/agents/mission";
import { fetchVectorIndex } from "@/services/vector-index";

export async function bootstrapWorkspace(config) {
	const plan = await planMission(config.scope, {
		enablePlanning: true,
		guardrails: config.guardrails,
	});

	const index = await fetchVectorIndex(config.vectorStore);

	return {
		...plan,
		vectorIndex: index.summary,
	};
}
`;

export function EditorSurface(): JSX.Element {
	return (
		<div className="flex h-full flex-col gap-3 p-4">			<div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
				<Sparkles className="h-3.5 w-3.5" />
				Preview mode — read-only mock until the Monaco editor bridge lands.
			</div>			<header className="flex items-center justify-between">
				<div className="space-y-1">
					<p className="text-xs uppercase tracking-widest text-muted-foreground">/agents/planner.ts</p>
					<h1 className="text-lg font-semibold">Planner bootstrap</h1>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" variant="ghost">
						<Copy className="mr-1 h-4 w-4" /> Copy link
					</Button>
					<Button size="sm" variant="secondary">
						<Save className="mr-1 h-4 w-4" /> Save
					</Button>
					<Button size="sm">
						<Sparkles className="mr-1 h-4 w-4" /> Ask Nova
					</Button>
				</div>
			</header>
			<section className="grid grid-cols-[minmax(0,1fr)_260px] gap-4">
				<Card className="flex flex-col border-border/60 bg-background/80">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<div>
							<CardTitle className="text-sm">Source</CardTitle>
							<CardDescription className="text-xs text-muted-foreground">
								Read-only mock until the Monaco bridge lands.
							</CardDescription>
						</div>
						<Badge variant="outline" className="uppercase">Guarded</Badge>
					</CardHeader>
					<CardContent className="flex-1 overflow-hidden">
						<ScrollArea className="h-full rounded-lg border border-border/60 bg-background/90">
							<pre className="whitespace-pre text-xs leading-relaxed">
								<code>{SAMPLE_SOURCE}</code>
							</pre>
						</ScrollArea>
					</CardContent>
				</Card>
				<aside className="space-y-3">
					<Card className="border-border/60 bg-background/80">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">Quick Draft</CardTitle>
							<CardDescription className="text-xs text-muted-foreground">
								Stage edits before applying them to the workspace.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<Textarea rows={8} placeholder="Outline next refactor steps" />
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Auto-sync disabled</span>
								<Button size="sm" variant="secondary">
									Queue changes
								</Button>
							</div>
						</CardContent>
					</Card>
							<Card className="border-border/60 bg-background/60">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">Workspace Metrics</CardTitle>
									<CardDescription className="text-xs text-muted-foreground">
										Snapshot of runtime signals for the current branch.
									</CardDescription>
								</CardHeader>
								<Separator className="my-2" />
								<CardContent className="space-y-3">
									{workspaceMetrics.map((metric) => (
										<div key={metric.id} className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-sm">
												<metric.icon className="h-4 w-4 text-muted-foreground" />
												<span>{metric.label}</span>
											</div>
											<div className="text-right text-xs">
												<div className="font-semibold text-foreground">{metric.value}</div>
												<div className="text-muted-foreground">{metric.trend}</div>
											</div>
										</div>
									))}
								</CardContent>
							</Card>
							<Card className="border-border/60 bg-background/70">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">Workspace Overview</CardTitle>
									<CardDescription className="text-xs text-muted-foreground">
										Branch tag, quick guidance, and file tree context.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
										<span>AI Readiness</span>
										<Badge variant="outline" className="text-[10px] uppercase">
											{quickStats.workspaceTag}
										</Badge>
									</div>
									<div className="rounded-lg border border-dashed px-2 py-3 text-xs text-muted-foreground">
										{quickStats.terminalHint}
									</div>
									<Separator className="my-2" />
									<div className="max-h-60 overflow-auto pr-1">
										<ExplorerTree nodes={explorerTree} />
									</div>
								</CardContent>
							</Card>
				</aside>
			</section>
		</div>
	);
}

