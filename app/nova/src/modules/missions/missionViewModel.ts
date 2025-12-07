/**
 * @license INTERNAL ONLY — Mission view helpers
 *
 * Contract
 * Inputs:
 *   - Normalized missions and scheduler snapshots from missionsClient
 * Outputs:
 *   - Derived aggregates (totals, activity feed, columns) plus formatted labels
 * Error modes:
 *   - None; functions are pure and defensive around unexpected inputs
 * Performance:
 *   - Linear over mission counts (<1k expected) with simple array transforms
 * Side effects:
 *   - None
 *
 * Why: Share mission-derived presentation logic across multiple Nova surfaces without duplicating calculations.
 * What: Provide reusable helpers for totals, activity feed rows, column groupings, and relative timestamp formatting.
 * How: Consume frozen mission objects, compute aggregates with pure utilities, and emit sorted, frozen view models.
 */

import type { Mission, MissionSchedule, MissionStatus } from "@/modules/missions/missionsClient";

export interface MissionTotals {
  readonly total: number;
  readonly running: number;
  readonly idle: number;
  readonly queued: number;
  readonly disabled: number;
  readonly attention: number;
}

export interface MissionActivityView {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly timestamp: string | null;
  readonly tone: "success" | "warning" | "error";
}

export interface MissionColumnView {
  readonly id: string;
  readonly title: string;
  readonly statuses: readonly MissionStatus[];
  readonly missions: readonly Mission[];
}

const COLUMN_DEFINITIONS: readonly { id: string; title: string; statuses: readonly MissionStatus[] }[] = [
  { id: "queued", title: "Queued", statuses: ["queued"] },
  { id: "running", title: "Running", statuses: ["running"] },
  { id: "idle", title: "Ready", statuses: ["idle"] },
  { id: "attention", title: "Attention", statuses: ["failed", "paused"] },
  { id: "disabled", title: "Disabled", statuses: ["disabled"] },
  { id: "completed", title: "Completed", statuses: ["completed"] },
];

export function computeMissionTotals(missions: readonly Mission[]): MissionTotals {
  let running = 0;
  let idle = 0;
  let queued = 0;
  let disabled = 0;
  let attention = 0;

  for (const mission of missions) {
    switch (mission.status) {
      case "running":
        running += 1;
        break;
      case "queued":
        queued += 1;
        break;
      case "idle":
        idle += 1;
        break;
      case "failed":
      case "paused":
        attention += 1;
        break;
      case "disabled":
        disabled += 1;
        break;
      case "completed":
        idle += 1;
        break;
      default:
        idle += 1;
        break;
    }
  }

  return Object.freeze({
    total: missions.length,
    running,
    idle,
    queued,
    disabled,
    attention,
  });
}

export function buildMissionColumns(missions: readonly Mission[]): readonly MissionColumnView[] {
  const grouped = new Map<string, Mission[]>();
  for (const definition of COLUMN_DEFINITIONS) {
    grouped.set(definition.id, []);
  }

  for (const mission of missions) {
    const column = COLUMN_DEFINITIONS.find((definition) => definition.statuses.includes(mission.status));
    if (column) {
      grouped.get(column.id)?.push(mission);
      continue;
    }
    grouped.get("idle")?.push(mission);
  }

  const comparator = createMissionComparator();

  return Object.freeze(
    COLUMN_DEFINITIONS.map((definition) => {
      const entries = grouped.get(definition.id) ?? [];
      entries.sort(comparator);
      return Object.freeze({
        id: definition.id,
        title: definition.title,
        statuses: definition.statuses,
        missions: Object.freeze([...entries]),
      });
    }),
  );
}

export function buildMissionActivity(missions: readonly Mission[]): readonly MissionActivityView[] {
  const entries = missions
    .map((mission) => createActivityView(mission))
    .filter((entry): entry is MissionActivityView => Boolean(entry));
  entries.sort((a, b) => compareTimestampsDesc(a.timestamp, b.timestamp));
  return Object.freeze(entries.slice(0, 12));
}

export function missionPriorityTone(priority: number): "low" | "medium" | "high" {
  if (!Number.isFinite(priority)) {
    return "low";
  }
  if (priority >= 7) {
    return "high";
  }
  if (priority >= 4) {
    return "medium";
  }
  return "low";
}

export function formatMissionSchedule(schedule: MissionSchedule): string {
  if (!schedule) {
    return "Manual";
  }
  if (schedule.type === "interval") {
    return `Interval • ${schedule.intervalMinutes}m (${schedule.timezone})`;
  }
  return `Cron • ${schedule.cron} (${schedule.timezone})`;
}

export function formatRelativeTimestamp(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "—";
  }
  const diff = Date.now() - timestamp;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) {
    return diff >= 0 ? "moments ago" : "in moments";
  }
  if (abs < hour) {
    const value = Math.round(diff / minute);
    return formatRelativeLabel(value, "minute");
  }
  if (abs < day) {
    const value = Math.round(diff / hour);
    return formatRelativeLabel(value, "hour");
  }
  const value = Math.round(diff / day);
  return formatRelativeLabel(value, "day");
}

export function resolveStatusTone(status: MissionStatus): { readonly label: string; readonly variant: "secondary" | "outline" | "destructive"; readonly className?: string } {
  switch (status) {
    case "running":
      return { label: "Running", variant: "secondary", className: "text-emerald-300" };
    case "queued":
      return { label: "Queued", variant: "outline", className: "text-amber-300" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "paused":
      return { label: "Paused", variant: "outline", className: "text-amber-300" };
    case "disabled":
      return { label: "Disabled", variant: "outline" };
    case "completed":
      return { label: "Completed", variant: "secondary" };
    case "idle":
    default:
      return { label: "Idle", variant: "outline" };
  }
}

function createActivityView(mission: Mission): MissionActivityView | null {
  const sourceTimestamp = mission.lastRunAt || mission.lastFinishedAt || mission.updatedAt || mission.createdAt || null;
  const tone = deriveActivityTone(mission);
  const summary = deriveActivitySummary(mission);
  return Object.freeze({
    id: mission.id,
    label: mission.name || mission.id,
    summary,
    timestamp: sourceTimestamp,
    tone,
  });
}

function deriveActivityTone(mission: Mission): "success" | "warning" | "error" {
  if (mission.lastRunError) {
    return "error";
  }
  if (mission.status === "running" || mission.status === "queued" || mission.status === "paused") {
    return "warning";
  }
  if (mission.status === "failed") {
    return "error";
  }
  return "success";
}

function deriveActivitySummary(mission: Mission): string {
  if (mission.lastRunError) {
    return `Run failed: ${mission.lastRunError}`;
  }
  switch (mission.status) {
    case "running":
      return "Mission is currently running.";
    case "queued":
      return mission.nextRunAt ? `Queued for ${formatRelativeTimestamp(mission.nextRunAt)}.` : "Queued for scheduler.";
    case "paused":
      return "Mission paused by operator.";
    case "failed":
      return "Mission requires attention.";
    case "disabled":
      return "Mission disabled by configuration.";
    case "completed":
      return "Mission completed and idle.";
    case "idle":
    default:
      return "Mission is idle and ready.";
  }
}

function compareTimestampsDesc(a: string | null, b: string | null): number {
  const timeA = a ? Date.parse(a) : NaN;
  const timeB = b ? Date.parse(b) : NaN;
  if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
    return 0;
  }
  if (Number.isNaN(timeA)) {
    return 1;
  }
  if (Number.isNaN(timeB)) {
    return -1;
  }
  return timeB - timeA;
}

function createMissionComparator() {
  return (a: Mission, b: Mission) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const nextRunDiff = compareTimestampsAsc(a.nextRunAt, b.nextRunAt);
    if (nextRunDiff !== 0) {
      return nextRunDiff;
    }
    return a.name.localeCompare(b.name);
  };
}

function compareTimestampsAsc(a: string | null, b: string | null): number {
  const timeA = a ? Date.parse(a) : NaN;
  const timeB = b ? Date.parse(b) : NaN;
  if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
    return 0;
  }
  if (Number.isNaN(timeA)) {
    return 1;
  }
  if (Number.isNaN(timeB)) {
    return -1;
  }
  return timeA - timeB;
}

function formatRelativeLabel(value: number, unit: "minute" | "hour" | "day"): string {
  const formatter = RELATIVE_TIME_FORMATTER;
  if (value === 0) {
    return "now";
  }
  const relative = formatter.format(-value, unit);
  return relative;
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });