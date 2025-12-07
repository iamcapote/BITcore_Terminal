import { describe, expect, it } from "vitest";
import { researchReducer } from "./researchReducer";
import {
  INITIAL_STATE,
  MAX_SUGGESTIONS,
  MAX_THOUGHTS,
  type ResearchState,
} from "./researchTypes";

function cloneState(state: ResearchState): ResearchState {
  return JSON.parse(JSON.stringify(state));
}

describe("researchReducer", () => {
  it("resets telemetry slices on RESET", () => {
    const state = researchReducer(INITIAL_STATE, {
      type: "STATUS",
      payload: { stage: "collect", message: "Collecting" },
      timestamp: 111,
    });

    const next = researchReducer(state, { type: "RESET", timestamp: 222 });

    expect(next.summary.title).toBe("Research telemetry");
    expect(next.status.stage).toBe("Idle");
    expect(next.progress.percent).toBe(0);
    expect(next.summary.lastUpdated).toBe(222);
    expect(next.thoughts).toHaveLength(0);
  });

  it("merges status payload and surfaces query metadata", () => {
    const state = researchReducer(INITIAL_STATE, {
      type: "STATUS",
      payload: {
        stage: "drafting_summary",
        message: "Drafting summary",
        detail: "Synthesizing key takeaways",
        meta: { query: "nova roadmap" },
      },
      timestamp: 333,
    });

    expect(state.status.stage).toBe("Drafting Summary");
    expect(state.status.message).toBe("Drafting summary");
    expect(state.summary.title).toBe("nova roadmap");
    expect(state.summary.lead).toBe("Synthesizing key takeaways");
    expect(state.summary.lastUpdated).toBe(333);
  });

  it("tracks progress percent using completed and total queries", () => {
    const state = researchReducer(INITIAL_STATE, {
      type: "PROGRESS",
      payload: { completed: 2, total: 5, status: "Running" },
      timestamp: 444,
    });

    expect(state.progress.percent).toBe(40);
    expect(state.progress.completed).toBe(2);
    expect(state.progress.total).toBe(5);
    expect(state.progress.status).toBe("Running");
    expect(state.progress.lastUpdated).toBe(444);
  });

  it("stores unique thoughts capped by MAX_THOUGHTS", () => {
    let state = cloneState(INITIAL_STATE);
    for (let index = 0; index < MAX_THOUGHTS + 2; index += 1) {
      state = researchReducer(state, {
        type: "THOUGHT",
        payload: { text: `Thought ${index}` },
        timestamp: 500 + index,
        eventId: `event-${index}`,
      });
    }

    expect(state.thoughts.length).toBe(MAX_THOUGHTS);
    expect(state.thoughts[0].text).toBe(`Thought ${MAX_THOUGHTS + 1}`);
  expect(state.thoughts.at(-1)?.text).toBe("Thought 2");
  });

  it("normalizes suggestions and enforces bounds", () => {
    const payload = {
      source: "memory",
      suggestions: Array.from({ length: MAX_SUGGESTIONS + 2 }, (_, index) => ({
        prompt: index % 2 === 0 ? `Prompt ${index}` : " ",
        focus: index % 2 === 0 ? "Focus" : undefined,
      })),
    };

    const state = researchReducer(INITIAL_STATE, {
      type: "SUGGESTIONS",
      payload,
      timestamp: 600,
      eventId: "suggestion",
    });

  expect(state.suggestions.length).toBe(4);
    expect(state.suggestions[0].prompt).toBe("Prompt 0");
    expect(state.suggestions[0].focus).toBe("Focus");
  });

  it("aggregates GitHub snapshots into ordered entries", () => {
    const snapshot = [
      { id: "a", message: "Build succeeded", level: "info", timestamp: 5 },
      { id: "b", message: "Lint warning", level: "warn", timestamp: 6 },
      { id: "c", message: "Deploy failed", level: "error", timestamp: 7 },
    ];

    const state = researchReducer(INITIAL_STATE, {
      type: "GITHUB_SNAPSHOT",
      entries: snapshot,
      timestamp: 777,
    });

    expect(state.github.entries.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
    expect(state.github.aggregate.total).toBe(3);
    expect(state.github.aggregate.errors).toBe(1);
    expect(state.github.aggregate.warnings).toBe(1);
    expect(state.github.aggregate.lastMessage).toBe("Deploy failed");
  });
});
