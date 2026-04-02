/**
 * Why: Normalize and inject workflow context into chat messages without coupling chat UI to workflow internals.
 * What: Parses workflow JSON, builds stripped semantic payloads, and composes injected chat message content.
 * How: Uses small object guards plus recursive cleanup to produce stable, minimal context blocks.
 */

export type WorkflowInjectionMode = "none" | "system" | "first";
export type WorkflowSelectionMode = "full" | "stripped";

export interface WorkflowInjectionResult {
  readonly content: string;
  readonly applied: boolean;
  readonly error?: string;
}

interface UnknownRecord {
  [key: string]: unknown;
}

const PROMOTED_FIELD_NAMES = new Set(["title", "description", "tags", "content", "icon", "fileFormat"]);

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function cleanObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    const cleanedArray = value
      .map(cleanObject)
      .filter((entry) => entry !== undefined && entry !== null)
      .filter((entry) => !(Array.isArray(entry) && entry.length === 0))
      .filter((entry) => !(typeof entry === "object" && entry !== null && Object.keys(entry as UnknownRecord).length === 0));
    return cleanedArray.length > 0 ? cleanedArray : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as UnknownRecord;
  const output: UnknownRecord = {};
  for (const [key, entry] of Object.entries(source)) {
    const cleaned = cleanObject(entry);
    if (cleaned === undefined || cleaned === null) {
      continue;
    }
    output[key] = cleaned;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function stripNodeFields(fields: unknown): UnknownRecord | undefined {
  if (!Array.isArray(fields)) {
    return undefined;
  }

  const mapped: UnknownRecord = {};
  for (const candidate of fields) {
    const field = asRecord(candidate);
    if (!field) {
      continue;
    }
    const name = typeof field.name === "string" ? field.name.trim() : "";
    if (!name || PROMOTED_FIELD_NAMES.has(name)) {
      continue;
    }
    const nextValue = cleanObject(field.value);
    if (nextValue === undefined || nextValue === null) {
      continue;
    }
    mapped[name] = nextValue;
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function extractStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleaned = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function stripWorkflowPayload(workflow: unknown): UnknownRecord | null {
  const workflowRecord = asRecord(workflow);
  if (!workflowRecord) {
    return null;
  }

  const metadata = asRecord(workflowRecord.metadata);
  const header = cleanObject({
    title: metadata?.title,
    description: metadata?.description,
    tags: extractStringArray(metadata?.tags),
  }) as UnknownRecord | undefined;

  const nodes = Array.isArray(workflowRecord.nodes)
    ? workflowRecord.nodes
        .map((candidate) => {
          const node = asRecord(candidate);
          if (!node) {
            return undefined;
          }
          const data = asRecord(node.data) ?? node;
          return cleanObject({
            title: data.title ?? data.label ?? node.label,
            description: data.description ?? node.notes,
            tags: extractStringArray(data.tags),
            ontology: data["ontology-type"] ?? data.ontologyCode ?? data.type,
            icon: data.icon ?? node.icon,
            content: data.content ?? node.content,
            fileFormat: data.fileFormat ?? data.language,
            fields: stripNodeFields(data.fields),
          }) as UnknownRecord | undefined;
        })
        .filter((entry): entry is UnknownRecord => Boolean(entry))
    : [];

  const output = cleanObject({
    ...(header ?? {}),
    nodes,
  }) as UnknownRecord | undefined;

  return output ?? null;
}

function parseWorkflowJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function composePayload(
  workflow: unknown,
  selectionMode: WorkflowSelectionMode,
): UnknownRecord | null {
  if (selectionMode === "full") {
    const asWorkflow = asRecord(workflow);
    return asWorkflow ? asWorkflow : null;
  }
  return stripWorkflowPayload(workflow);
}

export function injectWorkflowIntoMessage(
  rawMessage: string,
  workflowJson: string,
  injectionMode: WorkflowInjectionMode,
  selectionMode: WorkflowSelectionMode,
): WorkflowInjectionResult {
  const trimmedMessage = rawMessage.trim();
  const trimmedWorkflow = workflowJson.trim();

  if (injectionMode === "none" || !trimmedWorkflow) {
    return { content: trimmedMessage, applied: false };
  }

  const parsed = parseWorkflowJson(trimmedWorkflow);
  if (!parsed) {
    return {
      content: trimmedMessage,
      applied: false,
      error: "Workflow context must be valid JSON.",
    };
  }

  const selected = composePayload(parsed, selectionMode);
  if (!selected) {
    return {
      content: trimmedMessage,
      applied: false,
      error: "Workflow context is empty after selection.",
    };
  }

  const payload = JSON.stringify(selected, null, 2);
  if (injectionMode === "system") {
    return {
      content: `[SYSTEM WORKFLOW CONTEXT]\n${payload}${trimmedMessage ? `\n\n[USER MESSAGE]\n${trimmedMessage}` : ""}`,
      applied: true,
    };
  }

  return {
    content: `[WORKFLOW CONTEXT]\n${payload}${trimmedMessage ? `\n\n${trimmedMessage}` : ""}`,
    applied: true,
  };
}
