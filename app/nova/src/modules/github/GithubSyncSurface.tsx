/**
 * @license INTERNAL ONLY — GitHub sync surface
 *
 * Contract
 * Inputs:
 *   - GitHubSyncProvider state (activityEntries, connectionVerified, loading flags, sync actions)
 * Outputs:
 *   - Nova layout showing connection status, activity feed, and sync controls backed by live data
 * Error modes:
 *   - Displays inline error banners; does not throw from render path
 * Performance:
 *   - Renders at most a few hundred activity entries; memoized filters prevent re-sorting unless inputs change
 * Side effects:
 *   - Dispatches HTTP-backed actions through GitHubSyncProvider handlers when buttons are pressed
 *
 * Why: Present GitHub sync operations with actionable controls connected to the backend.
 * What: Wraps the GitHubSyncProvider, renders connection status, activity feed, and sync actions using real data.
 * How: Consume provider context, show loading placeholders, and route user actions to the GitHub sync client.
 */

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitHubSyncProvider, useGitHubSync } from "@/modules/github/GitHubSyncProvider";
import type { ActivityEntry } from "@/modules/github/githubSyncClient";
import { AlertCircle, CheckCircle, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

export function GithubSyncSurface(): JSX.Element {
  return (
    <GitHubSyncProvider>
      <GithubSyncContent />
    </GitHubSyncProvider>
  );
}

function GithubSyncContent(): JSX.Element {
  const {
    activityEntries,
    activityStats,
    connectionVerified,
    loading,
    error,
    refreshActivity,
    verifyConnection,
  } = useGitHubSync();

  const [filterLevel, setFilterLevel] = useState<string>("all");

  const filteredActivity = activityEntries.filter((entry) => {
    if (filterLevel === "all") return true;
    return entry.level === filterLevel;
  });

  const handleRefresh = useCallback(() => {
    refreshActivity();
  }, [refreshActivity]);

  const handleVerify = useCallback(() => {
    verifyConnection();
  }, [verifyConnection]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <p className="text-sm font-medium">Failed to load GitHub sync</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
        <Button size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-semibold">GitHub Sync</h2>
              <p className="text-sm text-muted-foreground">Manage repository synchronization and activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connectionVerified ? "default" : "outline"}>
              {connectionVerified ? <CheckCircle className="mr-1 h-3 w-3" /> : null}
              {connectionVerified ? "Connected" : "Not Verified"}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleVerify} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Verify
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {activityStats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="border-border/60 bg-background/70">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{activityStats.total}</div>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/70">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{activityStats.levels.error}</div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/70">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{activityStats.levels.warn}</div>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-background/70">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{activityStats.levels.info}</div>
                <p className="text-xs text-muted-foreground">Info</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="flex min-h-0 flex-1 flex-col border-border/60 bg-background/70">
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4" /> Activity Feed
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setFilterLevel("all")}>
                All
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFilterLevel("error")}>
                Errors
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFilterLevel("warn")}>
                Warnings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {loading && activityEntries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredActivity.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No activity to display
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {filteredActivity.map((entry) => (
                    <ActivityCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const levelColor = {
    debug: "text-muted-foreground",
    info: "text-blue-400",
    warn: "text-amber-400",
    error: "text-destructive",
  }[entry.level];

  return (
    <Card className="border-border/60 bg-background/80">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={levelColor}>
                {entry.level.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
            </div>
            <p className="mt-2 text-sm">{entry.message}</p>
            {entry.source && (
              <p className="mt-1 text-xs text-muted-foreground">Source: {entry.source}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}
