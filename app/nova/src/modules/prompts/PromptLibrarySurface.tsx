/**
 * @license INTERNAL ONLY — Prompt library surface
 *
 * Contract
 * Inputs:
 *   - PromptsProvider state (prompts, selectedPrompt, githubStatus, loading flags, mutation handlers)
 * Outputs:
 *   - Nova layout showing prompt list, filters, detail panel, and GitHub sync status backed by live data
 * Error modes:
 *   - Displays inline error banners; does not throw from render path
 * Performance:
 *   - Renders at most a few hundred prompts; memoized filters prevent re-sorting unless inputs change
 * Side effects:
 *   - Dispatches HTTP-backed actions through PromptsProvider handlers when buttons are pressed
 *
 * Why: Present the prompt library with actionable controls connected to the backend.
 * What: Wraps the PromptsProvider, renders filters, prompt list, detail panel, and GitHub sync using real prompts.
 * How: Consume provider context, show loading placeholders, and route user actions to the prompts client.
 */

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PromptsProvider, usePrompts } from "@/modules/prompts/PromptsProvider";
import { AlertCircle, Filter, FolderGit2, Loader2, RefreshCw, Search, Trash2, Upload } from "lucide-react";

interface PromptFilters {
  readonly search: string;
  readonly category: string | null;
  readonly favoritesOnly: boolean;
}

const DEFAULT_FILTERS: PromptFilters = {
  search: "",
  category: null,
  favoritesOnly: false,
};

export function PromptLibrarySurface(): JSX.Element {
  return (
    <PromptsProvider>
      <PromptLibraryContent />
    </PromptsProvider>
  );
}

function PromptLibraryContent(): JSX.Element {
  const {
    prompts,
    selectedPrompt,
    githubStatus,
    loading,
    error,
    refreshPrompts,
    selectPrompt,
    removePrompt,
    pullFromGitHub,
    pushToGitHub,
  } = usePrompts();

  const [filters, setFilters] = useState<PromptFilters>(DEFAULT_FILTERS);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      if (filters.search.trim().length > 0) {
        const haystack = `${prompt.title} ${prompt.description ?? ""} ${prompt.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(filters.search.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [prompts, filters]);

  const handleRefresh = useCallback(() => {
    refreshPrompts();
  }, [refreshPrompts]);

  const handleSelect = useCallback(
    (id: string) => {
      selectPrompt(id);
    },
    [selectPrompt]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      if (confirm("Delete this prompt?")) {
        await removePrompt(id);
      }
    },
    [removePrompt]
  );

  const handlePull = useCallback(() => {
    pullFromGitHub();
  }, [pullFromGitHub]);

  const handlePush = useCallback(() => {
    pushToGitHub();
  }, [pushToGitHub]);



  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <p className="text-sm font-medium">Failed to load prompts</p>
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
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Search prompts"
                className="w-80"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              {githubStatus && (
                <>
                  <Button size="sm" variant="outline" onClick={handlePull}>
                    <FolderGit2 className="mr-2 h-4 w-4" />
                    Pull
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePush}>
                    <Upload className="mr-2 h-4 w-4" />
                    Push
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col border-border/60 bg-background/70">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm">Prompt Library</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> {filteredPrompts.length} prompts
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              {loading && prompts.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No prompts found
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {filteredPrompts.map((prompt) => (
                      <Card key={prompt.id} className="border-border/60 bg-background/80">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-sm">{prompt.title}</CardTitle>
                              {prompt.description && (
                                <p className="mt-1 text-xs text-muted-foreground">{prompt.description}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSelect(prompt.id)}
                              className="ml-2"
                            >
                              View
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Updated: {formatTimestamp(prompt.updatedAt)}</span>
                            {prompt.tags.length > 0 && (
                              <>
                                <Separator orientation="vertical" className="h-4" />
                                <div className="flex flex-wrap gap-1">
                                  {prompt.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-[10px]">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {selectedPrompt && (
            <Card className="border-border/60 bg-background/70">
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm">{selectedPrompt.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => selectPrompt(null)}>
                    Close
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRemove(selectedPrompt.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedPrompt.description && (
                  <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
                )}
                <Separator />
                <div className="rounded-lg bg-muted p-4">
                  <pre className="whitespace-pre-wrap text-xs">{selectedPrompt.body}</pre>
                </div>
                {selectedPrompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPrompt.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}
