import { describe, expect, it, vi } from "vitest";
import {
  buildGithubState,
  coercePositiveInt,
  createEventId,
  formatStage,
  isDuplicateThought,
  mergeGithubStats,
  normalizeGithubEntry,
  normalizeMemoryRecord,
  normalizeSuggestionEntry,
  normalizeTimestamp,
  resolvePercent,
  resetThoughtRegistry,
} from "./researchNormalizers";
import {
  INITIAL_GITHUB,
  type GithubAggregateState,
} from "./researchTypes";

describe("researchNormalizers", () => {
  it("formats stages into title case words", () => {
  expect(formatStage("drafting_summary")).toBe("Drafting Summary");
    expect(formatStage("  collect-phase  ")).toBe("Collect Phase");
    expect(formatStage(null)).toBe("Unknown");
  });

  it("resolves percent using direct and derived values", () => {
    expect(resolvePercent({ percent: 55.4 })).toBe(55);
    expect(resolvePercent({ completed: 3, total: 4 })).toBe(75);
    expect(resolvePercent({})).toBe(0);
  });

  it("normalizes suggestion entries or filters them", () => {
    const valid = normalizeSuggestionEntry({ prompt: "Refine scope", tags: ["analysis", ""] }, "id-1", "memory", 123);
    const invalid = normalizeSuggestionEntry({ prompt: "   " }, "id-2", "memory", null);

    expect(valid).toMatchObject({ id: "id-1", prompt: "Refine scope", tags: ["analysis"] });
    expect(invalid).toBeNull();
  });

  it("normalizes memory records", () => {
    const record = normalizeMemoryRecord({
      id: "42",
      preview: "Observation",
      tags: ["foo", 1],
      score: 0.8,
      timestamp: "2024-01-01T00:00:00Z",
    });

    expect(record).toMatchObject({ id: "42", preview: "Observation", tags: ["foo"], score: 0.8 });
  });

  it("builds GitHub aggregates and captures latest message", () => {
    const entries = [
      normalizeGithubEntry({ id: "1", message: "First", level: "info", timestamp: 1 })!,
      normalizeGithubEntry({ id: "2", message: "Error", level: "error", timestamp: 3 })!,
      normalizeGithubEntry({ id: "3", message: "Warn", level: "warn", timestamp: 2 })!,
    ];

    const state = buildGithubState(entries, INITIAL_GITHUB.aggregate);

    expect(state.aggregate.total).toBe(3);
    expect(state.aggregate.errors).toBe(1);
    expect(state.aggregate.warnings).toBe(1);
    expect(state.aggregate.lastMessage).toBe("Error");
  });

  it("merges GitHub stats while preserving prior context", () => {
    const previous: GithubAggregateState = {
      total: 10,
      errors: 2,
      warnings: 1,
      lastMessage: "Prev",
      lastAction: "deploy",
      lastTimestamp: 99,
    };

    const next = mergeGithubStats({ total: 5, levels: { error: 1 } }, previous);

    expect(next.total).toBe(5);
    expect(next.errors).toBe(1);
    expect(next.lastMessage).toBe("Prev");
    expect(next.lastAction).toBe("deploy");
  });

  it("detects duplicate thought IDs and trims registry", () => {
    const registry = { seen: new Set<string>(), order: [] as string[] };
    const first = isDuplicateThought(registry, "event-1", 2);
    const second = isDuplicateThought(registry, "event-1", 2);
    const third = isDuplicateThought(registry, "event-2", 2);
    const fourth = isDuplicateThought(registry, "event-3", 2);

    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(third).toBe(false);
    expect(fourth).toBe(false);
    expect(registry.seen.has("event-1")).toBe(false);
  });

  it("coerces positive integers and ignores negatives", () => {
    expect(coercePositiveInt("10")).toBe(10);
    expect(coercePositiveInt(-1)).toBeNull();
    expect(coercePositiveInt("not a number")).toBeNull();
  });

  it("normalizes timestamps from strings and numbers", () => {
    const parsed = normalizeTimestamp("2024-02-02T00:00:00Z");
    const passthrough = normalizeTimestamp(123);
    const invalid = normalizeTimestamp("not-a-date");

    expect(typeof parsed).toBe("number");
    expect(passthrough).toBe(123);
    expect(invalid).toBeNull();
  });

  it("uses crypto.randomUUID when available", () => {
  const spy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000000");
    try {
  expect(createEventId()).toBe("00000000-0000-0000-0000-000000000000");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("resets thought registry state", () => {
    const registry = { seen: new Set<string>(["a", "b"]), order: ["a", "b"] };
    resetThoughtRegistry(registry);
    expect(registry.seen.size).toBe(0);
    expect(registry.order.length).toBe(0);
  });
});
