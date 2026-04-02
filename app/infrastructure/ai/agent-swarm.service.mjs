/**
 * Agent Swarm Service
 * Why: Provide a stable backend seam for swarm orchestration before full provider wiring.
 * What: Exposes immutable overview, capability, and mock delegation operations.
 * How: Keeps in-memory state with guarded updates so CLI and Nova share one contract.
 *
 * Contract
 * Inputs:
 *   - options.timeProvider?: () => number
 *   - options.uuidProvider?: () => string
 * Outputs:
 *   - getOverview(): SwarmOverviewSnapshot
 *   - getCapabilities(): SwarmCapabilitiesSnapshot
 *   - getRuns(): SwarmRunsSnapshot
 *   - getClarification(): SwarmClarificationSnapshot
 *   - getGraph(): SwarmGraphSnapshot
 *   - updateCapabilities(patch): SwarmCapabilitiesSnapshot
 *   - updateClarification(patch): SwarmClarificationSnapshot
 *   - respondClarification(payload): SwarmClarificationSnapshot
 *   - updateGraph(patch): SwarmGraphSnapshot
 *   - appendGraphMessage(payload): SwarmGraphSnapshot
 *   - delegate(request): SwarmDelegationRecord
 * Error modes:
 *   - ValidationError for malformed capability patches or delegation payloads.
 * Performance:
 *   - O(n) over in-memory arrays; memory bounded by recent mock activity list.
 * Side effects:
 *   - Mutates in-memory runtime snapshot only; no external IO.
 */

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function safeIso(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function freezeCapabilities(capabilities) {
  return Object.freeze({
    readFiles: Boolean(capabilities.readFiles),
    writeFiles: Boolean(capabilities.writeFiles),
    networkAccess: Boolean(capabilities.networkAccess),
    keyboardMouse: Boolean(capabilities.keyboardMouse),
    openApps: Boolean(capabilities.openApps),
    screenshots: Boolean(capabilities.screenshots),
    requireStepApproval: Boolean(capabilities.requireStepApproval),
    blockExternalDownloads: Boolean(capabilities.blockExternalDownloads),
    rateLimitOps: Boolean(capabilities.rateLimitOps),
  });
}

const INITIAL_AGENTS = Object.freeze([
  Object.freeze({
    id: 'agent-manager',
    name: 'Manager',
    status: 'running',
    autonomy: 'Guarded',
    model: 'gpt-5',
    persona: 'swarm.manager',
    missionCount: 3,
    tools: Object.freeze(['registry', 'planner', 'memory']),
    lastRunAgo: '1m',
  }),
  Object.freeze({
    id: 'agent-research',
    name: 'Research Child',
    status: 'idle',
    autonomy: 'Guarded',
    model: 'qwen3-235b',
    persona: 'swarm.child.research',
    missionCount: 5,
    tools: Object.freeze(['browser', 'search', 'fs']),
    lastRunAgo: '12m',
  }),
  Object.freeze({
    id: 'agent-ship',
    name: 'Ship Child',
    status: 'paused',
    autonomy: 'Manual',
    model: 'llama-3.3-70b',
    persona: 'swarm.child.ship',
    missionCount: 2,
    tools: Object.freeze(['git', 'terminal']),
    lastRunAgo: '37m',
  }),
]);

const INITIAL_MCP = Object.freeze([
  Object.freeze({ id: 'mcp-fs', name: 'filesystem', status: 'online', endpoints: Object.freeze(['ls', 'readFile', 'writeFile']) }),
  Object.freeze({ id: 'mcp-browser', name: 'browser', status: 'online', endpoints: Object.freeze(['navigate', 'extract', 'screenshot']) }),
  Object.freeze({ id: 'mcp-code', name: 'code-exec', status: 'offline', endpoints: Object.freeze(['run', 'kill', 'status']) }),
]);

const INITIAL_ACTIVITY = Object.freeze([
  Object.freeze({ id: 'swarm-activity-1', agentId: 'agent-manager', summary: 'Delegated docs synthesis mission', timestampAgo: '2m ago', status: 'success' }),
  Object.freeze({ id: 'swarm-activity-2', agentId: 'agent-research', summary: 'Awaiting approval for external crawl', timestampAgo: '8m ago', status: 'warning' }),
  Object.freeze({ id: 'swarm-activity-3', agentId: 'agent-ship', summary: 'Push paused by guardrail policy', timestampAgo: '26m ago', status: 'error' }),
]);

const INITIAL_RUNS = Object.freeze([
  Object.freeze({
    id: 'swarm-run-1',
    mission: 'Synthesize vendor security guardrails',
    targetAgentId: 'agent-manager',
    state: 'running',
    mode: 'mock',
    createdAt: '2026-02-17T00:00:00.000Z',
    updatedAt: '2026-02-17T00:03:00.000Z',
    plan: Object.freeze({
      todo: Object.freeze(['Collect patterns', 'Compare contracts']),
      inProgress: Object.freeze(['Draft adoption notes']),
      done: Object.freeze(['Scan canonical vendor index']),
    }),
  }),
  Object.freeze({
    id: 'swarm-run-2',
    mission: 'Queue MCP reconnect reliability checks',
    targetAgentId: 'agent-research',
    state: 'awaiting_approval',
    mode: 'mock',
    createdAt: '2026-02-16T22:20:00.000Z',
    updatedAt: '2026-02-16T22:20:00.000Z',
    plan: Object.freeze({
      todo: Object.freeze(['Validate OAuth callback flow']),
      inProgress: Object.freeze([]),
      done: Object.freeze([]),
    }),
  }),
]);

function validateDelegateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('ValidationError: Delegation payload is required.');
  }
  const mission = typeof input.mission === 'string' ? input.mission.trim() : '';
  if (!mission) {
    throw new Error('ValidationError: Delegation mission is required.');
  }
  const targetAgentId = typeof input.targetAgentId === 'string' && input.targetAgentId.trim()
    ? input.targetAgentId.trim()
    : 'agent-manager';
  const requireApproval = parseBoolean(input.requireApproval, true);
  return { mission, targetAgentId, requireApproval };
}

function validateClarificationPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Clarification patch must be an object.');
  }
  const output = {};
  if ('enabled' in input) {
    output.enabled = parseBoolean(input.enabled, false);
  }
  if ('maxRounds' in input) {
    const parsed = Number(input.maxRounds);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      throw new Error('ValidationError: maxRounds must be an integer between 0 and 10.');
    }
    output.maxRounds = parsed;
  }
  if ('question' in input) {
    const question = typeof input.question === 'string' ? input.question.trim() : '';
    output.question = question;
  }
  return output;
}

function validateClarificationResponse(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Clarification response payload must be an object.');
  }
  const action = typeof input.action === 'string' ? input.action.trim().toLowerCase() : 'answer';
  const allowedActions = new Set(['answer', 'approve', 'reject', 'skip']);
  if (!allowedActions.has(action)) {
    throw new Error('ValidationError: action must be one of answer|approve|reject|skip.');
  }
  const response = typeof input.response === 'string' ? input.response.trim() : '';
  if (action === 'answer' && !response) {
    throw new Error('ValidationError: response is required when action=answer.');
  }
  return { action, response };
}

function validateGraphPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Graph patch payload must be an object.');
  }
  const patch = {};
  if ('maxRounds' in input) {
    const parsed = Number(input.maxRounds);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new Error('ValidationError: maxRounds must be an integer between 1 and 50.');
    }
    patch.maxRounds = parsed;
  }
  if ('activeChannelId' in input) {
    patch.activeChannelId = typeof input.activeChannelId === 'string' ? input.activeChannelId.trim() : '';
  }
  if ('terminate' in input) {
    patch.terminate = parseBoolean(input.terminate, false);
  }
  return patch;
}

function validateGraphMessage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ValidationError: Graph message payload must be an object.');
  }
  const channelId = typeof input.channelId === 'string' ? input.channelId.trim() : '';
  const speaker = typeof input.speaker === 'string' ? input.speaker.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!channelId) {
    throw new Error('ValidationError: channelId is required.');
  }
  if (!speaker) {
    throw new Error('ValidationError: speaker is required.');
  }
  if (!message) {
    throw new Error('ValidationError: message is required.');
  }
  return {
    channelId,
    speaker,
    message,
    functionId: typeof input.functionId === 'string' ? input.functionId.trim() : '',
    skipHandleExecution: parseBoolean(input.skipHandleExecution, false),
  };
}

function cloneOverviewState(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    agents: Object.freeze(state.agents.map((agent) => Object.freeze({
      ...agent,
      tools: Object.freeze([...agent.tools]),
    }))),
    activity: Object.freeze(state.activity.map((entry) => Object.freeze({ ...entry }))),
    mcpServers: Object.freeze(state.mcpServers.map((server) => Object.freeze({
      ...server,
      endpoints: Object.freeze([...server.endpoints]),
    }))),
    updatedAt: safeIso(state.updatedAt),
  });
}

function cloneRunsState(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    runs: Object.freeze(state.runs.map((run) => Object.freeze({
      ...run,
      plan: Object.freeze({
        todo: Object.freeze([...(run.plan?.todo || [])]),
        inProgress: Object.freeze([...(run.plan?.inProgress || [])]),
        done: Object.freeze([...(run.plan?.done || [])]),
      }),
    }))),
    updatedAt: safeIso(state.updatedAt),
  });
}

function cloneClarificationState(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    clarification: Object.freeze({
      enabled: Boolean(state.clarification.enabled),
      roundsUsed: Number(state.clarification.roundsUsed || 0),
      maxRounds: Number(state.clarification.maxRounds || 0),
      isComplete: Boolean(state.clarification.isComplete),
      pendingQuestion: typeof state.clarification.pendingQuestion === 'string' ? state.clarification.pendingQuestion : '',
      lastResponse: typeof state.clarification.lastResponse === 'string' ? state.clarification.lastResponse : '',
      updatedAt: safeIso(state.clarification.updatedAt || state.updatedAt),
      history: Object.freeze((state.clarification.history || []).map((entry) => Object.freeze({
        ...entry,
        timestamp: safeIso(entry.timestamp),
      }))),
    }),
    updatedAt: safeIso(state.updatedAt),
  });
}

function cloneGraphState(state) {
  return Object.freeze({
    source: 'mock',
    feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
    graph: Object.freeze({
      maxRounds: Number(state.graph.maxRounds || 0),
      currentRound: Number(state.graph.currentRound || 0),
      activeChannelId: typeof state.graph.activeChannelId === 'string' ? state.graph.activeChannelId : '',
      terminated: Boolean(state.graph.terminated),
      lastMessage: typeof state.graph.lastMessage === 'string' ? state.graph.lastMessage : '',
      updatedAt: safeIso(state.graph.updatedAt || state.updatedAt),
      channels: Object.freeze((state.graph.channels || []).map((channel) => Object.freeze({
        ...channel,
        members: Object.freeze([...(channel.members || [])]),
      }))),
      functions: Object.freeze((state.graph.functions || []).map((fn) => Object.freeze({ ...fn }))),
      events: Object.freeze((state.graph.events || []).map((event) => Object.freeze({
        ...event,
        timestamp: safeIso(event.timestamp),
      }))),
    }),
    updatedAt: safeIso(state.updatedAt),
  });
}

let singletonService = null;

export function createAgentSwarmService(options = {}) {
  const {
    timeProvider = () => Date.now(),
    uuidProvider = () => globalThis.crypto?.randomUUID?.() || `swarm-${Date.now()}`,
    maxActivityItems = 30,
  } = options;

  const state = {
    agents: [...INITIAL_AGENTS],
    activity: [...INITIAL_ACTIVITY],
    mcpServers: [...INITIAL_MCP],
    runs: [...INITIAL_RUNS],
    clarification: {
      enabled: true,
      roundsUsed: 1,
      maxRounds: 3,
      isComplete: false,
      pendingQuestion: 'Should this mission perform external web crawl or stay local-only?',
      lastResponse: '',
      updatedAt: timeProvider(),
      history: [
        {
          id: 'clar-1',
          role: 'coordinator',
          action: 'question',
          message: 'Need confirmation on external crawl scope before execution.',
          timestamp: timeProvider(),
        },
      ],
    },
    graph: {
      maxRounds: 8,
      currentRound: 2,
      activeChannelId: 'channel-research',
      terminated: false,
      lastMessage: 'Planner asked Research child to validate threat model assumptions.',
      updatedAt: timeProvider(),
      channels: [
        {
          id: 'channel-research',
          name: 'Research Channel',
          members: ['agent-manager', 'agent-research'],
          roundsUsed: 2,
          maxRounds: 8,
          status: 'running',
          lastSpeaker: 'agent-research',
        },
        {
          id: 'channel-ship',
          name: 'Ship Channel',
          members: ['agent-manager', 'agent-ship'],
          roundsUsed: 0,
          maxRounds: 5,
          status: 'idle',
          lastSpeaker: '',
        },
      ],
      functions: [
        { id: 'fn-search', name: 'search_web', enabled: true, sync: false, lastRunStatus: 'ok' },
        { id: 'fn-memory', name: 'memory_recall', enabled: true, sync: true, lastRunStatus: 'ok' },
        { id: 'fn-git', name: 'git_status', enabled: false, sync: true, lastRunStatus: 'disabled' },
      ],
      events: [
        {
          id: 'graph-event-1',
          type: 'onStart',
          channelId: 'channel-research',
          message: 'Channel started with manager + research child.',
          timestamp: timeProvider(),
        },
        {
          id: 'graph-event-2',
          type: 'onMessage',
          channelId: 'channel-research',
          message: 'Research child posted planning context.',
          timestamp: timeProvider(),
        },
      ],
    },
    capabilities: freezeCapabilities({
      readFiles: true,
      writeFiles: true,
      networkAccess: false,
      keyboardMouse: false,
      openApps: false,
      screenshots: false,
      requireStepApproval: true,
      blockExternalDownloads: false,
      rateLimitOps: true,
    }),
    updatedAt: timeProvider(),
  };

  return Object.freeze({
    getOverview() {
      return cloneOverviewState(state);
    },

    getCapabilities() {
      return Object.freeze({
        source: 'mock',
        feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
        capabilities: state.capabilities,
        updatedAt: safeIso(state.updatedAt),
      });
    },

    getRuns() {
      return cloneRunsState(state);
    },

    getClarification() {
      return cloneClarificationState(state);
    },

    getGraph() {
      return cloneGraphState(state);
    },

    updateCapabilities(patch = {}) {
      if (!patch || typeof patch !== 'object') {
        throw new Error('ValidationError: Capability patch must be an object.');
      }
      const next = { ...state.capabilities };
      for (const key of Object.keys(next)) {
        if (key in patch) {
          next[key] = parseBoolean(patch[key], next[key]);
        }
      }
      state.capabilities = freezeCapabilities(next);
      state.updatedAt = timeProvider();
      return this.getCapabilities();
    },

    updateClarification(patch = {}) {
      const parsed = validateClarificationPatch(patch);
      const now = timeProvider();
      if ('enabled' in parsed) {
        state.clarification.enabled = parsed.enabled;
      }
      if ('maxRounds' in parsed) {
        state.clarification.maxRounds = parsed.maxRounds;
      }
      if ('question' in parsed) {
        state.clarification.pendingQuestion = parsed.question;
        if (parsed.question) {
          state.clarification.history = [
            {
              id: `clar-${uuidProvider()}`,
              role: 'coordinator',
              action: 'question',
              message: parsed.question,
              timestamp: now,
            },
            ...state.clarification.history,
          ].slice(0, maxActivityItems);
          state.clarification.isComplete = false;
        }
      }
      state.clarification.updatedAt = now;
      state.updatedAt = now;
      return this.getClarification();
    },

    respondClarification(payload = {}) {
      const parsed = validateClarificationResponse(payload);
      const now = timeProvider();
      const hadPendingQuestion = Boolean(state.clarification.pendingQuestion);
      if (hadPendingQuestion && state.clarification.roundsUsed < state.clarification.maxRounds) {
        state.clarification.roundsUsed += 1;
      }

      if (parsed.action === 'approve' || parsed.action === 'reject' || parsed.action === 'skip') {
        state.clarification.isComplete = true;
      }
      if (parsed.action === 'answer' && parsed.response) {
        state.clarification.lastResponse = parsed.response;
      }
      if (parsed.action !== 'answer') {
        state.clarification.lastResponse = parsed.action;
      }
      state.clarification.pendingQuestion = '';
      state.clarification.history = [
        {
          id: `clar-${uuidProvider()}`,
          role: 'operator',
          action: parsed.action,
          message: parsed.response || parsed.action,
          timestamp: now,
        },
        ...state.clarification.history,
      ].slice(0, maxActivityItems);
      state.clarification.updatedAt = now;
      state.updatedAt = now;
      return this.getClarification();
    },

    updateGraph(patch = {}) {
      const parsed = validateGraphPatch(patch);
      const now = timeProvider();
      if ('maxRounds' in parsed) {
        state.graph.maxRounds = parsed.maxRounds;
      }
      if ('activeChannelId' in parsed) {
        if (parsed.activeChannelId && !state.graph.channels.some((channel) => channel.id === parsed.activeChannelId)) {
          throw new Error('ValidationError: activeChannelId does not exist.');
        }
        state.graph.activeChannelId = parsed.activeChannelId;
      }
      if (parsed.terminate) {
        state.graph.terminated = true;
      }
      state.graph.updatedAt = now;
      state.updatedAt = now;
      return this.getGraph();
    },

    appendGraphMessage(payload = {}) {
      const parsed = validateGraphMessage(payload);
      const now = timeProvider();
      const channelIndex = state.graph.channels.findIndex((channel) => channel.id === parsed.channelId);
      if (channelIndex < 0) {
        throw new Error(`ValidationError: channelId \"${parsed.channelId}\" does not exist.`);
      }
      const channel = state.graph.channels[channelIndex];
      if (channel.roundsUsed >= channel.maxRounds || state.graph.currentRound >= state.graph.maxRounds) {
        state.graph.terminated = true;
        state.graph.events = [
          {
            id: `graph-event-${uuidProvider()}`,
            type: 'onAbort',
            channelId: parsed.channelId,
            message: 'Execution halted by maxRounds guard.',
            timestamp: now,
          },
          ...state.graph.events,
        ].slice(0, maxActivityItems);
        state.graph.updatedAt = now;
        state.updatedAt = now;
        throw new Error('ValidationError: maxRounds reached for graph execution.');
      }

      const nextChannel = {
        ...channel,
        roundsUsed: channel.roundsUsed + 1,
        status: 'running',
        lastSpeaker: parsed.speaker,
      };
      state.graph.channels[channelIndex] = nextChannel;
      state.graph.currentRound += 1;
      state.graph.activeChannelId = parsed.channelId;
      state.graph.lastMessage = parsed.message;
      state.graph.terminated = false;

      if (parsed.functionId) {
        state.graph.functions = state.graph.functions.map((entry) => {
          if (entry.id !== parsed.functionId) {
            return entry;
          }
          return {
            ...entry,
            lastRunStatus: parsed.skipHandleExecution ? 'skipped' : 'ok',
          };
        });
      }

      state.graph.events = [
        {
          id: `graph-event-${uuidProvider()}`,
          type: parsed.skipHandleExecution ? 'onInterrupt' : 'onMessage',
          channelId: parsed.channelId,
          message: parsed.message,
          speaker: parsed.speaker,
          functionId: parsed.functionId || null,
          timestamp: now,
        },
        ...state.graph.events,
      ].slice(0, maxActivityItems);

      state.graph.updatedAt = now;
      state.updatedAt = now;
      return this.getGraph();
    },

    delegate(input) {
      const payload = validateDelegateInput(input);
      const now = timeProvider();
      const runId = uuidProvider();
      const record = Object.freeze({
        id: runId,
        mission: payload.mission,
        targetAgentId: payload.targetAgentId,
        queuedAt: safeIso(now),
        mode: 'mock',
        requireApproval: payload.requireApproval,
        status: payload.requireApproval ? 'awaiting_approval' : 'queued',
      });

      const activityItem = Object.freeze({
        id: `swarm-activity-${uuidProvider()}`,
        agentId: payload.targetAgentId,
        summary: payload.requireApproval
          ? `Queued mission awaiting approval: ${payload.mission}`
          : `Queued mission: ${payload.mission}`,
        timestampAgo: 'just now',
        status: payload.requireApproval ? 'warning' : 'success',
      });

      state.activity = [activityItem, ...state.activity].slice(0, maxActivityItems);
      const runRecord = Object.freeze({
        id: runId,
        mission: payload.mission,
        targetAgentId: payload.targetAgentId,
        state: payload.requireApproval ? 'awaiting_approval' : 'queued',
        mode: 'mock',
        createdAt: safeIso(now),
        updatedAt: safeIso(now),
        plan: Object.freeze({
          todo: Object.freeze(['Review mission constraints', 'Execute delegated task']),
          inProgress: Object.freeze([]),
          done: Object.freeze([]),
        }),
      });
      state.runs = [runRecord, ...state.runs].slice(0, maxActivityItems);
      state.updatedAt = now;
      return record;
    },
  });
}

export function getAgentSwarmService() {
  if (!singletonService) {
    singletonService = createAgentSwarmService();
  }
  return singletonService;
}

export function resetAgentSwarmServiceSingleton() {
  singletonService = null;
}
