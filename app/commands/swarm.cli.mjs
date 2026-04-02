/**
 * Swarm CLI Command
 * Why: Provide command-plane parity for swarm inspection and mock delegation workflows.
 * What: Supports status, inspect, plan, mock-delegate, capabilities, and help subcommands.
 * How: Delegates runtime operations to the swarm controller and normalizes output for terminal and WebSocket clients.
 */

import { getSwarmController } from '../features/ai/swarm/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.swarm.cli', { emitToStdStreams: false });
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function stringifyMessage(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable payload]';
    }
  }
  return String(value);
}

function createEmitter(handler, level) {
  const target = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (value, meta = null) => {
    const message = stringifyMessage(value);
    moduleLogger[level](message, meta || null);
    if (target) {
      target(value);
      return;
    }
    stream.write(`${message}\n`);
  };
}

function sendAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function getMissionFromArgs(positionalArgs = []) {
  return positionalArgs.join(' ').trim();
}

function formatOverview(snapshot) {
  const running = snapshot.agents.filter((item) => item.status === 'running').length;
  const idle = snapshot.agents.filter((item) => item.status === 'idle').length;
  const paused = snapshot.agents.filter((item) => item.status === 'paused').length;
  return [
    '--- Swarm Status ---',
    `Mode: ${snapshot.feature.mode}`,
    `Agents: ${snapshot.agents.length} (running ${running}, idle ${idle}, paused ${paused})`,
    `Recent events: ${snapshot.activity.length}`,
    `MCP servers: ${snapshot.mcpServers.length}`,
    `Updated: ${snapshot.updatedAt}`,
  ];
}

export function getSwarmHelpText() {
  return [
    '/swarm status [--json]                                 Show swarm runtime summary.',
    '/swarm inspect [--json]                                Show detailed swarm overview.',
    '/swarm runs [--json]                                   Show recent swarm run state snapshots.',
    '/swarm clarification [--json]                          Show clarification-loop state.',
    '/swarm clarification-set [--enabled=true|false] [--max-rounds=3] [--json]  Update clarification settings.',
    '/swarm clarification-respond <answer> [--action=answer|approve|reject|skip] [--json]  Submit clarification response.',
    '/swarm graph [--json]                                  Show agent/channel/function graph state.',
    '/swarm graph-set [--max-rounds=8] [--channel=id] [--terminate=true] [--json]  Update graph controls.',
    '/swarm graph-message <message> --channel=id --speaker=id [--function=id] [--skip=true] [--json]  Append graph message event.',
    '/swarm capabilities [--json]                           Show current swarm capability toggles.',
    '/swarm plan <mission> [--agent=id] [--approval=true|false] [--json]  Preview delegation plan without queuing.',
    '/swarm mock-delegate <mission> [--agent=id] [--approval=true|false] [--json]  Queue a mock delegation.',
    '/swarm checkpoint [--json]                             List workflow checkpoints.',
    '/swarm checkpoint-get <workflowId> [--json]           Show one checkpoint.',
    '/swarm checkpoint-save <workflowId> [--state=running] [--step=0] [--phase=coordinator] [--json]  Save/update checkpoint.',
    '/swarm checkpoint-resume <workflowId> [--json]        Resume an interrupted checkpoint.',
    '/swarm checkpoint-abandon <workflowId> [--json]       Mark a checkpoint as abandoned.',
    '/swarm help                                            Show this help message.',
  ].join('\n');
}

export async function executeSwarm(options = {}, wsOutput, wsError) {
  const outputFn = createEmitter(wsOutput || options.output, 'info');
  const errorFn = createEmitter(wsError || options.error, 'error');
  const controller = getSwarmController();

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || positionalArgs.shift()?.toLowerCase() || 'status';
  const wantsJson = parseBoolean(flags.json, false);

  try {
    switch (subcommand) {
      case 'status': {
        const snapshot = await controller.getOverview();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          formatOverview(snapshot).forEach((line) => outputFn(line));
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'inspect': {
        const snapshot = await controller.getOverview();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Swarm Inspect ---');
          snapshot.agents.forEach((agent) => {
            outputFn(`${agent.name} (${agent.id}) · ${agent.status} · missions ${agent.missionCount}`);
          });
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'runs': {
        const snapshot = await controller.getRuns();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Swarm Runs ---');
          snapshot.runs.forEach((run) => {
            const todo = run.plan?.todo?.length || 0;
            const inProgress = run.plan?.inProgress?.length || 0;
            const done = run.plan?.done?.length || 0;
            outputFn(`${run.id} · ${run.state} · ${run.targetAgentId} · todo ${todo}/active ${inProgress}/done ${done}`);
          });
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'clarification': {
        const snapshot = await controller.getClarification();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Swarm Clarification ---');
          outputFn(`enabled: ${snapshot.clarification.enabled}`);
          outputFn(`rounds: ${snapshot.clarification.roundsUsed}/${snapshot.clarification.maxRounds}`);
          outputFn(`complete: ${snapshot.clarification.isComplete}`);
          outputFn(`question: ${snapshot.clarification.pendingQuestion || 'none'}`);
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'clarification-set': {
        const patch = {};
        if ('enabled' in flags) {
          patch.enabled = parseBoolean(flags.enabled, true);
        }
        if ('max-rounds' in flags) {
          patch.maxRounds = Number(flags['max-rounds']);
        }
        const snapshot = await controller.patchClarification(patch);
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Clarification updated: enabled=${snapshot.clarification.enabled}, rounds=${snapshot.clarification.maxRounds}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'clarification-respond': {
        const action = typeof flags.action === 'string' && flags.action.trim() ? String(flags.action).trim().toLowerCase() : 'answer';
        const response = getMissionFromArgs(positionalArgs);
        const snapshot = await controller.respondClarification({ action, response });
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Clarification response accepted: ${action}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'graph': {
        const snapshot = await controller.getGraph();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Swarm Graph ---');
          outputFn(`rounds: ${snapshot.graph.currentRound}/${snapshot.graph.maxRounds}`);
          outputFn(`channel: ${snapshot.graph.activeChannelId || 'none'}`);
          outputFn(`channels: ${snapshot.graph.channels.length}`);
          outputFn(`functions: ${snapshot.graph.functions.length}`);
          outputFn(`terminated: ${snapshot.graph.terminated}`);
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'graph-set': {
        const patch = {};
        if ('max-rounds' in flags) {
          patch.maxRounds = Number(flags['max-rounds']);
        }
        if ('channel' in flags && typeof flags.channel === 'string') {
          patch.activeChannelId = flags.channel;
        }
        if ('terminate' in flags) {
          patch.terminate = parseBoolean(flags.terminate, false);
        }
        const snapshot = await controller.patchGraph(patch);
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Graph updated: rounds=${snapshot.graph.maxRounds}, channel=${snapshot.graph.activeChannelId || 'none'}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'graph-message': {
        const message = getMissionFromArgs(positionalArgs);
        const channelId = typeof flags.channel === 'string' ? flags.channel.trim() : '';
        const speaker = typeof flags.speaker === 'string' ? flags.speaker.trim() : '';
        if (!channelId || !speaker) {
          throw new Error('ValidationError: --channel and --speaker are required for /swarm graph-message.');
        }
        const snapshot = await controller.appendGraphMessage({
          channelId,
          speaker,
          message,
          functionId: typeof flags.function === 'string' ? flags.function.trim() : '',
          skipHandleExecution: parseBoolean(flags.skip, false),
        });
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Graph message appended on ${channelId} by ${speaker}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'capabilities': {
        const snapshot = await controller.getCapabilities();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Swarm Capabilities ---');
          Object.entries(snapshot.capabilities).forEach(([key, value]) => {
            outputFn(`${key}: ${value ? 'enabled' : 'disabled'}`);
          });
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'plan': {
        const mission = getMissionFromArgs(positionalArgs);
        if (!mission) {
          throw new Error('ValidationError: Mission text is required for /swarm plan.');
        }
        const targetAgentId = typeof flags.agent === 'string' && flags.agent.trim() ? flags.agent.trim() : 'agent-manager';
        const requireApproval = parseBoolean(flags.approval, true);
        const preview = Object.freeze({ mission, targetAgentId, requireApproval, mode: 'preview' });
        outputFn(wantsJson ? JSON.stringify(preview, null, 2) : `Plan preview: ${targetAgentId} -> ${mission} (${requireApproval ? 'approval required' : 'auto-queue'})`);
        sendAck(wsOutput);
        return { success: true, preview };
      }

      case 'mock-delegate': {
        const mission = getMissionFromArgs(positionalArgs);
        if (!mission) {
          throw new Error('ValidationError: Mission text is required for /swarm mock-delegate.');
        }
        const targetAgentId = typeof flags.agent === 'string' && flags.agent.trim() ? flags.agent.trim() : 'agent-manager';
        const requireApproval = parseBoolean(flags.approval, true);
        const record = await controller.delegate({ mission, targetAgentId, requireApproval });
        outputFn(wantsJson ? JSON.stringify(record, null, 2) : `Delegation queued: ${record.id} (${record.status})`);
        sendAck(wsOutput);
        return { success: true, record };
      }

      /* ── Checkpoint subcommands (Pass 12 / Deerflow) ─────── */

      case 'checkpoint': {
        const snapshot = await controller.listCheckpoints();
        if (wantsJson) {
          outputFn(JSON.stringify(snapshot, null, 2));
        } else {
          outputFn('--- Workflow Checkpoints ---');
          if (snapshot.total === 0) {
            outputFn('No checkpoints saved.');
          } else {
            snapshot.checkpoints.forEach((c) => {
              outputFn(`${c.workflowId} · ${c.state} · phase=${c.phase} step=${c.step} resumes=${c.resumeCount}`);
            });
          }
        }
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'checkpoint-get': {
        const workflowId = positionalArgs.shift() || '';
        if (!workflowId) throw new Error('ValidationError: workflowId is required.');
        const snapshot = await controller.getCheckpoint(workflowId);
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `${workflowId} · ${snapshot.state} · phase=${snapshot.thread.phase} step=${snapshot.thread.step} resumes=${snapshot.resumeCount}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'checkpoint-save': {
        const workflowId = positionalArgs.shift() || '';
        if (!workflowId) throw new Error('ValidationError: workflowId is required.');
        const payload = {
          state: typeof flags.state === 'string' ? flags.state.trim() : 'queued',
          step: 'step' in flags ? Number(flags.step) : 0,
          phase: typeof flags.phase === 'string' ? flags.phase.trim() : 'coordinator',
          interruptReason: typeof flags.reason === 'string' ? flags.reason.trim() : null,
        };
        const snapshot = await controller.saveCheckpoint(workflowId, payload);
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Checkpoint saved: ${workflowId} · ${snapshot.state}`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'checkpoint-resume': {
        const workflowId = positionalArgs.shift() || '';
        if (!workflowId) throw new Error('ValidationError: workflowId is required.');
        const patch = typeof flags['approval-note'] === 'string' ? { approvalNote: flags['approval-note'] } : {};
        const snapshot = await controller.resumeCheckpoint(workflowId, patch);
        outputFn(wantsJson ? JSON.stringify(snapshot, null, 2) : `Checkpoint resumed: ${workflowId} · ${snapshot.state} (resumes: ${snapshot.resumeCount})`);
        sendAck(wsOutput);
        return { success: true, snapshot };
      }

      case 'checkpoint-abandon': {
        const workflowId = positionalArgs.shift() || '';
        if (!workflowId) throw new Error('ValidationError: workflowId is required.');
        const result = await controller.abandonCheckpoint(workflowId);
        outputFn(wantsJson ? JSON.stringify(result, null, 2) : `Checkpoint abandoned: ${workflowId} (was: ${result.previousState})`);
        sendAck(wsOutput);
        return { success: true, result };
      }

      case 'help': {
        getSwarmHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: true, handled: true };
      }

      default: {
        const message = `Unknown swarm subcommand: ${subcommand}`;
        errorFn(message, { code: 'unknown_swarm_subcommand' });
        getSwarmHelpText().split('\n').forEach((line) => outputFn(line));
        sendAck(wsOutput);
        return { success: false, handled: true, error: message };
      }
    }
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message, { code: 'swarm_command_failure' });
    sendAck(wsOutput);
    return { success: false, error: message };
  }
}
