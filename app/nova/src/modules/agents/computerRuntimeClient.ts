/**
 * Why: Provide typed access to machine runtime endpoints for the Computer surface.
 * What: Fetches and patches shell interface + SSH execution runtime settings.
 * How: Uses credentialed fetch calls with payload normalization and fallback snapshots.
 */

export interface ComputerRuntime {
  readonly shellInterface: "local" | "ssh";
  readonly codeExecSshEnabled: boolean;
  readonly codeExecSshAddr: string;
  readonly codeExecSshPort: number;
  readonly codeExecSshUser: string;
  readonly codeExecSshHasPassword: boolean;
  readonly updatedAt: string;
}

export interface ComputerRuntimeSnapshot {
  readonly source: string;
  readonly feature: {
    readonly enabled: boolean;
    readonly mode: string;
    readonly wiring: string;
  };
  readonly runtime: ComputerRuntime;
  readonly updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const payload = await response.json();
    if (isObject(payload) && typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error;
    }
  } catch {
    // noop
  }
  throw new Error(message);
}

function normalizeSnapshot(payload: unknown, fallback: ComputerRuntimeSnapshot): ComputerRuntimeSnapshot {
  if (!isObject(payload) || !isObject(payload.runtime)) {
    return fallback;
  }

  const runtimePayload = payload.runtime;
  const shellInterface = runtimePayload.shellInterface === "ssh" ? "ssh" : "local";
  const port = Number(runtimePayload.codeExecSshPort);

  return {
    source: typeof payload.source === "string" ? payload.source : fallback.source,
    feature: {
      enabled: isObject(payload.feature) ? Boolean(payload.feature.enabled) : fallback.feature.enabled,
      mode: isObject(payload.feature) && typeof payload.feature.mode === "string" ? payload.feature.mode : fallback.feature.mode,
      wiring: isObject(payload.feature) && typeof payload.feature.wiring === "string" ? payload.feature.wiring : fallback.feature.wiring,
    },
    runtime: {
      shellInterface,
      codeExecSshEnabled: Boolean(runtimePayload.codeExecSshEnabled),
      codeExecSshAddr: typeof runtimePayload.codeExecSshAddr === "string" ? runtimePayload.codeExecSshAddr : fallback.runtime.codeExecSshAddr,
      codeExecSshPort: Number.isInteger(port) ? port : fallback.runtime.codeExecSshPort,
      codeExecSshUser: typeof runtimePayload.codeExecSshUser === "string" ? runtimePayload.codeExecSshUser : fallback.runtime.codeExecSshUser,
      codeExecSshHasPassword: Boolean(runtimePayload.codeExecSshHasPassword),
      updatedAt: typeof runtimePayload.updatedAt === "string" ? runtimePayload.updatedAt : new Date().toISOString(),
    },
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
  };
}

export async function fetchComputerRuntime(fallback: ComputerRuntimeSnapshot): Promise<ComputerRuntimeSnapshot> {
  try {
    const response = await fetch("/api/tools/computer/runtime", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = await response.json();
    return normalizeSnapshot(payload, fallback);
  } catch {
    return fallback;
  }
}

export async function patchComputerRuntime(
  patch: Partial<Omit<ComputerRuntime, "updatedAt">> & { readonly codeExecSshPass?: string },
  fallback: ComputerRuntimeSnapshot,
): Promise<ComputerRuntimeSnapshot> {
  const response = await fetch("/api/tools/computer/runtime", {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    return parseError(response);
  }
  const payload = await response.json();
  return normalizeSnapshot(payload, fallback);
}
