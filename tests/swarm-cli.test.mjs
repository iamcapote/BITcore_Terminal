import { beforeEach, describe, expect, it } from 'vitest';
import { executeSwarm, getSwarmHelpText } from '../app/commands/swarm.cli.mjs';
import { resetSwarmController } from '../app/features/ai/swarm/index.mjs';
import { resetAgentSwarmServiceSingleton } from '../app/infrastructure/ai/agent-swarm.service.mjs';

beforeEach(() => {
  resetSwarmController();
  resetAgentSwarmServiceSingleton();
});

describe('swarm cli command', () => {
  it('exposes help text', () => {
    const help = getSwarmHelpText();
    expect(help).toContain('/swarm status');
    expect(help).toContain('/swarm mock-delegate');
    expect(help).toContain('/swarm runs');
    expect(help).toContain('/swarm clarification');
    expect(help).toContain('/swarm graph');
  });

  it('returns status snapshot by default', async () => {
    const result = await executeSwarm({ flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.feature.mode).toBe('mock');
  });

  it('queues a mock delegation', async () => {
    const result = await executeSwarm({
      action: 'mock-delegate',
      positionalArgs: ['Compile', 'vendor', 'pass', 'report'],
      flags: { approval: false },
    });
    expect(result.success).toBe(true);
    expect(result.record.status).toBe('queued');
  });

  it('returns run snapshots', async () => {
    const result = await executeSwarm({ action: 'runs', flags: { json: true } });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.snapshot.runs)).toBe(true);
  });

  it('returns clarification snapshot', async () => {
    const result = await executeSwarm({ action: 'clarification', flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.clarification.maxRounds).toBeGreaterThan(0);
  });

  it('updates clarification settings', async () => {
    const result = await executeSwarm({ action: 'clarification-set', flags: { 'max-rounds': 4 } });
    expect(result.success).toBe(true);
    expect(result.snapshot.clarification.maxRounds).toBe(4);
  });

  it('returns graph snapshot', async () => {
    const result = await executeSwarm({ action: 'graph', flags: { json: true } });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.snapshot.graph.channels)).toBe(true);
  });

  it('updates graph settings', async () => {
    const result = await executeSwarm({ action: 'graph-set', flags: { 'max-rounds': 6, channel: 'channel-research' } });
    expect(result.success).toBe(true);
    expect(result.snapshot.graph.maxRounds).toBe(6);
    expect(result.snapshot.graph.activeChannelId).toBe('channel-research');
  });

  it('appends graph message event', async () => {
    const result = await executeSwarm({
      action: 'graph-message',
      positionalArgs: ['Continue', 'threat', 'model', 'validation'],
      flags: { channel: 'channel-research', speaker: 'agent-manager' },
    });
    expect(result.success).toBe(true);
    expect(result.snapshot.graph.currentRound).toBeGreaterThan(0);
  });

  it('validates missing mission for plan', async () => {
    const result = await executeSwarm({ action: 'plan', positionalArgs: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ValidationError');
  });
});
