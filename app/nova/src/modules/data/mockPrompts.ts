/**
 * @license INTERNAL ONLY - Prompt library mock data
 *
 * Why: Keep the Nova prompt library interactive while backend APIs are deferred.
 * What: Supplies prompt templates, categories, GitHub sync metadata, and audit trails for the Knowledge surfaces.
 * How: Structured literals mirror the legacy prompts modules under app/public/prompts/.
 */

export interface PromptTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly lastEditedBy: string;
  readonly lastEditedAt: string;
  readonly favorite?: boolean;
}

export interface PromptCategory {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface PromptSyncStatus {
  readonly branch: string;
  readonly remotePath: string;
  readonly lastSyncAt: string;
  readonly pendingChanges: number;
}

export interface PromptAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly timestamp: string;
  readonly detail: string;
}

export const promptCategories: readonly PromptCategory[] = [
  { id: "research", label: "Research", description: "Deep dive templates for investigations." },
  { id: "coding", label: "Coding", description: "Code generation and refactor guides." },
  { id: "ops", label: "Operations", description: "Runbook snippets for missions and deployments." },
  { id: "chat", label: "Chat", description: "Dialogue personas and moderation flows." },
];

export const promptTemplates: readonly PromptTemplate[] = [
  {
    id: "prompt-provider-analysis",
    name: "Provider resilience brief",
    category: "research",
    tags: ["provider", "reliability", "risk"],
    description: "Summarize provider reliability posture with supporting citations.",
    lastEditedBy: "ops-bot",
    lastEditedAt: "2025-11-05T09:42:00.000Z",
    favorite: true,
  },
  {
    id: "prompt-terminal-helper",
    name: "Terminal helper",
    category: "ops",
    tags: ["cli", "support"],
    description: "Suggest next CLI command based on recent terminal output.",
    lastEditedBy: "mission-control",
    lastEditedAt: "2025-11-04T18:15:00.000Z",
  },
  {
    id: "prompt-incident",
    name: "Incident triage",
    category: "ops",
    tags: ["incident", "triage"],
    description: "Collect incident context and propose next best actions with decision tree.",
    lastEditedBy: "analyst-jay",
    lastEditedAt: "2025-11-03T22:08:00.000Z",
  },
  {
    id: "prompt-agent-checkin",
    name: "Agent check-in",
    category: "chat",
    tags: ["persona", "friendly"],
    description: "Warm persona for user onboarding and mission reviews.",
    lastEditedBy: "support-lane",
    lastEditedAt: "2025-11-02T14:05:00.000Z",
  },
  {
    id: "prompt-eval-suite",
    name: "Evaluation suite",
    category: "coding",
    tags: ["tests", "qa"],
    description: "Request targeted unit and integration tests for a modified subsystem.",
    lastEditedBy: "qa-dina",
    lastEditedAt: "2025-11-01T11:50:00.000Z",
  },
];

export const promptSyncStatus: PromptSyncStatus = {
  branch: "semantic",
  remotePath: "prompts/library.json",
  lastSyncAt: "2025-11-05T07:58:00.000Z",
  pendingChanges: 2,
};

export const promptAuditTrail: readonly PromptAuditEntry[] = [
  {
    id: "audit-1",
    action: "Updated",
    actor: "ops-bot",
    timestamp: "2025-11-05T09:42:00.000Z",
    detail: "Adjusted summary tone for Provider resilience brief.",
  },
  {
    id: "audit-2",
    action: "Created",
    actor: "qa-dina",
    timestamp: "2025-11-01T11:50:00.000Z",
    detail: "Added evaluation suite template for regression runs.",
  },
  {
    id: "audit-3",
    action: "Synced",
    actor: "mission-control",
    timestamp: "2025-10-31T18:22:00.000Z",
    detail: "GitHub sync pushed 3 prompt updates to remote repository.",
  },
];
