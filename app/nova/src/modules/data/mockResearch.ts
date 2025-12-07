/**
 * @license INTERNAL ONLY - Research dashboard mock data
 *
 * Why: Provide deterministic data while the legacy research dashboard is ported into Nova without backend wiring.
 * What: Exposes summary, progress, thoughts, suggestions, reports, and GitHub activity mirrors used by the Research surface.
 * How: Returns plain objects that mimic the output shape from app/public/research/*.js so components can render UI scaffolding.
 */

export interface ResearchSummary {
  readonly title: string;
  readonly description: string;
  readonly lead: string;
  readonly lastUpdated: string;
}

export interface ResearchProgress {
  readonly stage: string;
  readonly status: "Idle" | "Running" | "Complete" | "Error";
  readonly percent: number;
  readonly depth: number;
  readonly breadth: number;
  readonly tokenUsage: {
    readonly total: number;
    readonly prompt: number;
    readonly completion: number;
  };
  readonly eta: string;
}

export interface ResearchThought {
  readonly id: string;
  readonly category: string;
  readonly content: string;
  readonly timestamp: string;
}

export interface ResearchSuggestion {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly command: string;
}

export interface ResearchReport {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly authoredAt: string;
  readonly lastEditedAt: string;
  readonly status: "draft" | "published";
}

export interface ResearchGitHubStat {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export const researchSummary: ResearchSummary = {
  title: "Atlas provider performance audit",
  description: "Evaluate multi-provider LLM readiness across reliability, latency, and compliance.",
  lead: "Blends benchmark telemetry, support escalations, and spend data to rank provider fitness.",
  lastUpdated: "18 seconds ago",
};

export const researchProgress: ResearchProgress = {
  stage: "Synthesizing",
  status: "Running",
  percent: 64,
  depth: 3,
  breadth: 4,
  tokenUsage: {
    total: 4860,
    prompt: 3150,
    completion: 1710,
  },
  eta: "01:12 remaining",
};

export const researchThoughts: readonly ResearchThought[] = [
  {
    id: "thought-1",
    category: "Observation",
    content: "Atlas latency spike correlates with traffic failover tests captured in benchmark run 482.",
    timestamp: "just now",
  },
  {
    id: "thought-2",
    category: "Insight",
    content: "Contractual uptime penalties kick in after 4 consecutive misses of the 99.5% SLA within 30 days.",
    timestamp: "12s ago",
  },
  {
    id: "thought-3",
    category: "Signal",
    content: "Provider roadmap mentions Triton inference pods rolling out to parity with on-prem compliance zones.",
    timestamp: "32s ago",
  },
];

export const researchSuggestions: readonly ResearchSuggestion[] = [
  {
    id: "suggestion-expand-policy",
    label: "Expand policy corpus",
    detail: "Pull regulator briefings covering cross-border AI service requirements.",
    command: "mission enqueue policy:provider-compliance",
  },
  {
    id: "suggestion-run-simulation",
    label: "Stress test debt",
    detail: "Simulate contract exposure under 20% throughput degradation scenarios.",
    command: "mission enqueue finance:provider-contingency",
  },
  {
    id: "suggestion-export",
    label: "Export current report",
    detail: "Snapshot the synthesis deck and stage to /research/outputs/provider-audit.md",
    command: "research export provider-audit",
  },
];

export const researchReports: readonly ResearchReport[] = [
  {
    id: "report-provider-highlights",
    title: "Provider resilience highlights",
    summary: "Executive-ready digest of reliability wins and open mitigation items.",
    authoredAt: "2025-11-04T22:13:00.000Z",
    lastEditedAt: "2025-11-05T12:30:00.000Z",
    status: "draft",
  },
  {
    id: "report-risk-register",
    title: "Risk register update",
    summary: "Catalogues top-10 coastal exposure items with mitigation owners and timelines.",
    authoredAt: "2025-11-03T19:02:00.000Z",
    lastEditedAt: "2025-11-04T09:48:00.000Z",
    status: "published",
  },
  {
    id: "report-github-sync",
    title: "Synced GitHub issues",
    summary: "Pending PRs and automation steps tied to provider audit mission templates.",
    authoredAt: "2025-11-02T15:41:00.000Z",
    lastEditedAt: "2025-11-05T08:22:00.000Z",
    status: "draft",
  },
];

export const researchGithubStats: readonly ResearchGitHubStat[] = [
  {
    id: "stat-open-prs",
    label: "Open PRs",
    value: "5",
    hint: "3 awaiting review, 2 draft",
  },
  {
    id: "stat-latest-commit",
    label: "Latest commit",
    value: "9a2f3c1",
    hint: "Staged telemetry panel wiring",
  },
  {
    id: "stat-sync-status",
    label: "Sync status",
    value: "Clean",
    hint: "Workspace staging matches remote",
  },
];
