/**
 * @license INTERNAL ONLY - GitHub sync mock data
 *
 * Why: Keep the Nova GitHub sync console functional with deterministic values while backend uploads are deferred.
 * What: Supplies remote directory listings, staged file metadata, action history, and sync status flags.
 * How: Structures align with the legacy github-sync modules for easy UI portability.
 */

export interface RemoteEntry {
  readonly id: string;
  readonly name: string;
  readonly type: "file" | "directory";
  readonly size: string;
  readonly updatedAgo: string;
}

export interface StagedFile {
  readonly id: string;
  readonly path: string;
  readonly origin: "remote" | "local";
  readonly dirty: boolean;
  readonly updatedAt: string;
  readonly contents: string;
}

export interface SyncActionEntry {
  readonly id: string;
  readonly type: "verify" | "list" | "fetch" | "upload" | "push";
  readonly status: "success" | "error" | "running";
  readonly timestamp: string;
  readonly detail: string;
}

export interface GithubSyncStatus {
  readonly repo: string;
  readonly branch: string;
  readonly connected: boolean;
  readonly lastVerifiedAt: string;
}

export const remoteDirectory: readonly RemoteEntry[] = [
  { id: "remote-directory-research", name: "research", type: "directory", size: "4 files", updatedAgo: "2h ago" },
  { id: "remote-file-brief", name: "provider-brief.md", type: "file", size: "8 KB", updatedAgo: "1h ago" },
  { id: "remote-file-roadmap", name: "roadmap.csv", type: "file", size: "3 KB", updatedAgo: "1d ago" },
  { id: "remote-file-telemetry", name: "telemetry.json", type: "file", size: "12 KB", updatedAgo: "3d ago" },
];

export const stagedFiles: readonly StagedFile[] = [
  {
    id: "staged-brief",
    path: "research/provider-brief.md",
    origin: "remote",
    dirty: true,
    updatedAt: "2025-11-05T11:22:00.000Z",
    contents: "# Provider Resilience Brief\n\nUpdated synthesis on reliability and compliance posture...",
  },
  {
    id: "staged-telemetry",
    path: "research/telemetry.json",
    origin: "remote",
    dirty: false,
    updatedAt: "2025-11-05T10:04:00.000Z",
    contents: "{\n  \"status\": \"running\",\n  \"progress\": 0.64\n}\n",
  },
];

export const syncActivity: readonly SyncActionEntry[] = [
  {
    id: "sync-1",
    type: "verify",
    status: "success",
    timestamp: "2025-11-05T12:32:00.000Z",
    detail: "Credentials verified for iamcapote/BITcore_Terminal",
  },
  {
    id: "sync-2",
    type: "list",
    status: "success",
    timestamp: "2025-11-05T12:28:00.000Z",
    detail: "Listed research/ (4 entries)",
  },
  {
    id: "sync-3",
    type: "fetch",
    status: "success",
    timestamp: "2025-11-05T12:15:00.000Z",
    detail: "Fetched research/provider-brief.md",
  },
  {
    id: "sync-4",
    type: "upload",
    status: "running",
    timestamp: "2025-11-05T12:05:00.000Z",
    detail: "Uploading updated telemetry snapshot",
  },
];

export const githubSyncStatus: GithubSyncStatus = {
  repo: "iamcapote/BITcore_Terminal",
  branch: "semantic",
  connected: true,
  lastVerifiedAt: "2025-11-05T12:32:00.000Z",
};
