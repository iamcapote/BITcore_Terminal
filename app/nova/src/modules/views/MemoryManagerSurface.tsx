/**
 * Why: Full-featured memory management panel — the only LIVE-wired knowledge surface.
 * What: Store/recall forms, layer breakdown, telemetry feed, activity log, and recall results.
 * How: Consumes useMemoryTelemetry for real-time state; forms dispatch store/recall operations.
 */

import { useState, type FormEvent } from "react";
import { useMemoryTelemetry } from "@/modules/memory/MemoryTelemetryProvider";
import {
  DEFAULT_TOTALS,
  parseTagsInput,
  OverviewCard,
  LayerBreakdownCard,
  FeedCard,
  StoreCard,
  RecallCard,
  RecallResultsCard,
  type FeedEntry,
  type LayerSnapshotEntry,
  type RecallEntry,
} from "@/modules/views/MemoryHelpers";

/* ── Component ─────────────────────────────────────────────────────── */

export function MemoryManagerSurface() {
  const {
    stats,
    statsStatus,
    statsError,
    lastUpdatedAt,
    activity,
    telemetry,
    recallResults,
    storeState,
    recallState,
    refreshStats,
    storeMemory,
    recallMemory,
    clearResults,
  } = useMemoryTelemetry();

  const [storeForm, setStoreForm] = useState({
    content: "",
    layer: "working",
    source: "",
    tags: "",
    githubEnabled: false,
  });
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null);
  const [recallForm, setRecallForm] = useState({
    query: "",
    layer: "working",
    limit: "5",
    includeShortTerm: true,
    includeLongTerm: true,
    includeMeta: false,
    githubEnabled: false,
  });
  const [recallFeedback, setRecallFeedback] = useState<string | null>(null);

  const totals = stats?.totals ?? DEFAULT_TOTALS;
  const layers = stats?.layers ?? [];
  const summaryItems = [
    { label: "Stored", value: totals.stored },
    { label: "Recalled", value: totals.retrieved },
    { label: "Validated", value: totals.validated },
    { label: "Summarized", value: totals.summarized },
  ];
  const isRefreshing = statsStatus === "loading";
  const storePending = storeState.status === "loading";
  const recallPending = recallState.status === "loading";

  const handleStoreSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = storeForm.content.trim();
    if (!content) {
      setStoreFeedback("Add content before storing the memory.");
      return;
    }
    setStoreFeedback(null);
    const payload = {
      content,
      layer: storeForm.layer || undefined,
      source: storeForm.source.trim() ? storeForm.source.trim() : null,
      tags: parseTagsInput(storeForm.tags),
      githubEnabled: storeForm.githubEnabled,
    };
    const record = await storeMemory(payload);
    if (record) {
      setStoreFeedback("Memory stored successfully.");
      setStoreForm((previous) => ({ ...previous, content: "", source: "", tags: "" }));
    } else {
      setStoreFeedback(storeState.error ?? "Failed to store memory.");
    }
  };

  const handleRecallSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = recallForm.query.trim();
    if (!query) {
      setRecallFeedback("Ask a question or describe what to recall.");
      return;
    }
    setRecallFeedback(null);
    const limitValue = Number.parseInt(recallForm.limit, 10);
    const payload = {
      query,
      layer: recallForm.layer || undefined,
      limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined,
      includeShortTerm: recallForm.includeShortTerm,
      includeLongTerm: recallForm.includeLongTerm,
      includeMeta: recallForm.includeMeta,
      githubEnabled: recallForm.githubEnabled,
    } as const;
    const results = await recallMemory(payload);
    if (results.length === 0) {
      setRecallFeedback(recallState.error ?? "No memories matched that query.");
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full justify-center overflow-auto p-2 sm:p-3">
      <div className="flex min-h-0 min-w-0 w-full flex-col gap-3 sm:gap-4">
        <section className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          {/* ── Left column: overview, layers, telemetry, activity ── */}
          <div className="flex min-h-0 flex-col gap-4">
            <OverviewCard
              summaryItems={summaryItems}
              statsStatus={statsStatus}
              statsError={statsError}
              isRefreshing={isRefreshing}
              lastUpdatedAt={lastUpdatedAt}
              totalLayers={totals.layers}
              onRefresh={() => void refreshStats()}
            />
            <LayerBreakdownCard layers={layers as unknown as ReadonlyArray<LayerSnapshotEntry>} />
            <div className="grid gap-4 lg:grid-cols-2">
              <FeedCard title="Telemetry feed" items={telemetry as unknown as ReadonlyArray<FeedEntry>} />
              <FeedCard title="Activity" items={activity as unknown as ReadonlyArray<FeedEntry>} labelKey="label" />
            </div>
          </div>

          {/* ── Right column: store, recall, results ───────────── */}
          <div className="flex min-h-0 flex-col gap-4">
            <StoreCard
              form={storeForm}
              onChange={setStoreForm}
              onSubmit={handleStoreSubmit}
              pending={storePending}
              feedback={storeFeedback}
              storeState={storeState}
            />
            <RecallCard
              form={recallForm}
              onChange={setRecallForm}
              onSubmit={handleRecallSubmit}
              pending={recallPending}
              feedback={recallFeedback}
              recallState={recallState}
            />
            <RecallResultsCard results={recallResults as unknown as ReadonlyArray<RecallEntry>} onClear={clearResults} />
          </div>
        </section>
      </div>
    </div>
  );
}
