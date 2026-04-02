/**
 * Why: Provide a typed client seam for VectorAdmin-style operations in Nova.
 * What: Fetches vector overview, accepted MIME metadata, and runs mock document processing.
 * How: Uses JSON fetch helpers with strict response normalization and explicit error propagation.
 */

export interface VectorStoreSnapshot {
  readonly id: string;
  readonly index: string;
  readonly backend: string;
  readonly dimension: number;
  readonly size: number;
  readonly status: string;
}

export interface VectorOverviewSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly stores: readonly VectorStoreSnapshot[];
  readonly acceptedMimes: readonly string[];
  readonly updatedAt: string;
}

export interface VectorProcessRequest {
  readonly index: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes?: number;
}

export interface VectorProcessResult {
  readonly success: boolean;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStore(value: unknown): VectorStoreSnapshot | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const index = typeof value.index === "string" ? value.index : "";
  const backend = typeof value.backend === "string" ? value.backend : "";
  const dimension = Number(value.dimension);
  const size = Number(value.size);
  const status = typeof value.status === "string" ? value.status : "Unknown";
  if (!id || !index || !backend || !Number.isFinite(dimension) || !Number.isFinite(size)) {
    return null;
  }
  return {
    id,
    index,
    backend,
    dimension,
    size,
    status,
  };
}

function normalizeOverview(payload: unknown): VectorOverviewSnapshot {
  if (!isObject(payload)) {
    return {
      source: "fallback",
      feature: { enabled: true, mode: "mock", wiring: "fallback" },
      stores: [],
      acceptedMimes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const source = typeof payload.source === "string" ? payload.source : "mock";
  const feature = isObject(payload.feature)
    ? {
        enabled: Boolean(payload.feature.enabled),
        mode: typeof payload.feature.mode === "string" ? payload.feature.mode : "mock",
        wiring: typeof payload.feature.wiring === "string" ? payload.feature.wiring : "scaffolded",
      }
    : { enabled: true, mode: "mock", wiring: "scaffolded" };

  const storesRaw = Array.isArray(payload.stores) ? payload.stores : [];
  const stores = storesRaw.map(toStore).filter((item): item is VectorStoreSnapshot => Boolean(item));
  const acceptedMimes = Array.isArray(payload.acceptedMimes)
    ? payload.acceptedMimes.filter((mime): mime is string => typeof mime === "string")
    : [];
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();

  return {
    source,
    feature,
    stores,
    acceptedMimes,
    updatedAt,
  };
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const payload = await response.json();
    if (isObject(payload) && typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // keep generic message
  }
  throw new Error(message);
}

export async function fetchVectorOverview(backend?: string): Promise<VectorOverviewSnapshot> {
  const params = new URLSearchParams();
  if (backend && backend !== "all") {
    params.set("backend", backend);
  }
  const query = params.toString();
  const response = await fetch(`/api/ai/vectors/overview${query ? `?${query}` : ""}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return parseError(response);
  }

  const payload = await response.json();
  return normalizeOverview(payload);
}

export async function fetchVectorAcceptedMimes(): Promise<readonly string[]> {
  const response = await fetch("/api/ai/vectors/accepts", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  if (!isObject(payload) || !Array.isArray(payload.acceptedMimes)) {
    return [];
  }
  return payload.acceptedMimes.filter((mime): mime is string => typeof mime === "string");
}

export async function processVectorDocument(request: VectorProcessRequest): Promise<VectorProcessResult> {
  const response = await fetch("/api/ai/vectors/process", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok && response.status !== 422) {
    return parseError(response);
  }

  const payload = await response.json();
  if (!isObject(payload)) {
    throw new Error("Invalid process response payload.");
  }

  return {
    success: Boolean(payload.success),
    reason: typeof payload.reason === "string" ? payload.reason : "No reason provided.",
    metadata: isObject(payload.metadata) ? payload.metadata : {},
  };
}
