/**
 * @license INTERNAL ONLY - Logs mock data
 *
 * Why: Provide sample log entries for the Nova logs surface until the streaming backend is wired.
 * What: Supplies recent log events with level, module, message, and timestamp details.
 * How: Matches the historic payload structure from the legacy logs UI.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly id: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

export interface LogFilterPreset {
  readonly id: string;
  readonly label: string;
  readonly levels: readonly LogLevel[];
}

export const logEntries: readonly LogEntry[] = [
  {
    id: "log-1",
    level: "info",
    module: "missions.scheduler",
    message: "Tick completed in 184ms (4 missions processed)",
    timestamp: "2025-11-05T12:30:12.000Z",
    context: { tick: 4082 },
  },
  {
    id: "log-2",
    level: "warn",
    module: "research.telemetry",
    message: "Research telemetry backoff triggered (retry in 2s)",
    timestamp: "2025-11-05T12:29:58.000Z",
    context: { attempt: 2 },
  },
  {
    id: "log-3",
    level: "info",
    module: "github.sync",
    message: "Fetched research/provider-brief.md",
    timestamp: "2025-11-05T12:28:22.000Z",
  },
  {
    id: "log-4",
    level: "error",
    module: "memory.store",
    message: "Invalid payload rejected: content missing",
    timestamp: "2025-11-05T12:25:41.000Z",
    context: { requestId: "mem-82af" },
  },
  {
    id: "log-5",
    level: "debug",
    module: "terminal.dispatch",
    message: "Command queued: mission scheduler tick",
    timestamp: "2025-11-05T12:24:05.000Z",
  },
  {
    id: "log-6",
    level: "info",
    module: "chat.session",
    message: "Chat persona bitcore active with memory depth medium",
    timestamp: "2025-11-05T12:20:10.000Z",
  },
];

export const logFilterPresets: readonly LogFilterPreset[] = [
  { id: "errors", label: "Errors", levels: ["error"] },
  { id: "warnings", label: "Warnings", levels: ["warn", "error"] },
  { id: "all", label: "All", levels: ["debug", "info", "warn", "error"] },
];
