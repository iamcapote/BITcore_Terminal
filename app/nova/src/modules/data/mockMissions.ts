/**
 * @license INTERNAL ONLY - Mission and organizer mock data
 *
 * Why: Mirror the legacy organizer scheduler and mission board while Nova UI ports are completed.
 * What: Provides scheduler state, mission backlog columns, prompt quick picks, and activity feed entries.
 * How: Structures match the objects emitted by app/public/organizer/*.js to keep the React surface simple.
 */

export interface SchedulerState {
  readonly status: "idle" | "running" | "paused";
  readonly nextTickAt: string;
  readonly cadence: string;
}

export interface MissionCard {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly assignee: string;
  readonly priority: "low" | "medium" | "high";
  readonly updatedAgo: string;
}

export interface MissionColumn {
  readonly id: string;
  readonly title: string;
  readonly missions: readonly MissionCard[];
}

export interface MissionActivityEntry {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly timestamp: string;
}

export interface PromptQuickPick {
  readonly id: string;
  readonly label: string;
  readonly command: string;
}

export const schedulerState: SchedulerState = {
  status: "running",
  nextTickAt: "2025-11-05T13:15:00.000Z",
  cadence: "Every 15 minutes",
};

export const missionColumns: readonly MissionColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    missions: [
      {
        id: "mission-model-refresh",
        title: "Refresh model catalog",
        summary: "Review latest provider capabilities and update defaults.",
        assignee: "ops-bot",
        priority: "medium",
        updatedAgo: "2h ago",
      },
      {
        id: "mission-github-sync",
        title: "Audit GitHub staging",
        summary: "Clear out stale staged files before weekly cadence.",
        assignee: "analyst-jay",
        priority: "low",
        updatedAgo: "6h ago",
      },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    missions: [
      {
        id: "mission-provider-dashboard",
        title: "Wire provider dashboard",
        summary: "Port telemetry cards into Nova operations view.",
        assignee: "mission-control",
        priority: "high",
        updatedAgo: "18m ago",
      },
      {
        id: "mission-memory-tests",
        title: "Memory smoke tests",
        summary: "Add determinism checks for store and recall flows.",
        assignee: "qa-dina",
        priority: "medium",
        updatedAgo: "44m ago",
      },
    ],
  },
  {
    id: "review",
    title: "In Review",
    missions: [
      {
        id: "mission-cli-help",
        title: "CLI help improvements",
        summary: "Document new mission scheduler flags.",
        assignee: "support-lane",
        priority: "low",
        updatedAgo: "1h ago",
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    missions: [
      {
        id: "mission-status-bar",
        title: "Status bar refresh",
        summary: "Converted status chips to Nova footer widgets.",
        assignee: "ops-bot",
        priority: "medium",
        updatedAgo: "1d ago",
      },
    ],
  },
];

export const missionActivity: readonly MissionActivityEntry[] = [
  {
    id: "activity-1",
    label: "mission-control",
    detail: "Queued migration: research dashboard parity",
    timestamp: "2025-11-05T12:48:00.000Z",
  },
  {
    id: "activity-2",
    label: "ops-bot",
    detail: "Scheduler tick executed 4 missions",
    timestamp: "2025-11-05T12:30:00.000Z",
  },
  {
    id: "activity-3",
    label: "analyst-jay",
    detail: "Staged GitHub sync docs for review",
    timestamp: "2025-11-05T11:55:00.000Z",
  },
];

export const promptQuickPicks: readonly PromptQuickPick[] = [
  { id: "pick-resume", label: "Resume scheduler", command: "mission scheduler resume" },
  { id: "pick-pause", label: "Pause scheduler", command: "mission scheduler pause" },
  { id: "pick-run-once", label: "Run tick", command: "mission scheduler tick" },
  { id: "pick-new", label: "Create mission", command: "mission new" },
];
