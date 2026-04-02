/**
 * Unit tests for workflow-checkpoint.service — state machine guards.
 * Pattern derived from: deerflow checkpoint persistence + interrupt/resume lifecycle.
 * Tests: save, get, resume guards, abandon, pruning, history accumulation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkflowCheckpointService,
  resetWorkflowCheckpointService,
} from '../app/infrastructure/workflow-checkpoint.service.mjs';

let now = 1000;
const tick = (ms = 100) => { now += ms; return now; };
const timeProvider = () => now;

beforeEach(() => {
  now = 1000;
  resetWorkflowCheckpointService();
});

describe('saveCheckpoint — input validation', () => {
  it('throws ValidationError when workflowId is empty', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    expect(() => svc.saveCheckpoint('', { state: 'queued' })).toThrow('ValidationError: workflowId is required');
    expect(() => svc.saveCheckpoint('  ', { state: 'queued' })).toThrow('ValidationError: workflowId is required');
  });

  it('throws ValidationError when payload is not an object', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    expect(() => svc.saveCheckpoint('wf-1', null)).toThrow('ValidationError');
    expect(() => svc.saveCheckpoint('wf-1', 'state=queued')).toThrow('ValidationError');
    expect(() => svc.saveCheckpoint('wf-1', [])).toThrow('ValidationError');
  });

  it('returns a frozen snapshot with expected shape', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    const snap = svc.saveCheckpoint('wf-1', { state: 'running', step: 2, phase: 'planner' });
    expect(snap.workflowId).toBe('wf-1');
    expect(snap.state).toBe('running');
    expect(snap.thread.step).toBe(2);
    expect(snap.thread.phase).toBe('planner');
    expect(snap.resumeCount).toBe(0);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.thread)).toBe(true);
  });

  it('normalizes unknown state to queued', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    const snap = svc.saveCheckpoint('wf-2', { state: 'flying' });
    expect(snap.state).toBe('queued');
  });

  it('preserves existing thread values on update if new payload omits them', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-3', { state: 'running', step: 5, phase: 'reporter' });
    tick();
    const snap = svc.saveCheckpoint('wf-3', { state: 'interrupted' });
    expect(snap.thread.step).toBe(5);
    expect(snap.thread.phase).toBe('reporter');
  });
});

describe('getCheckpoint', () => {
  it('returns null for unknown workflowId', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    expect(svc.getCheckpoint('nonexistent')).toBeNull();
  });

  it('returns the saved checkpoint', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-g', { state: 'running', step: 1 });
    const snap = svc.getCheckpoint('wf-g');
    expect(snap.workflowId).toBe('wf-g');
    expect(snap.state).toBe('running');
  });
});

describe('resumeCheckpoint — state guards', () => {
  it('throws NotFound for unknown workflowId', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    expect(() => svc.resumeCheckpoint('no-such')).toThrow('NotFound');
  });

  it('throws ValidationError when checkpoint is in non-resumable state', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-r', { state: 'done' });
    expect(() => svc.resumeCheckpoint('wf-r')).toThrow('ValidationError');
  });

  it('transitions state to running and increments resumeCount', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-r2', { state: 'interrupted', interruptReason: 'needs approval' });
    tick();
    const snap = svc.resumeCheckpoint('wf-r2');
    expect(snap.state).toBe('running');
    expect(snap.resumeCount).toBe(1);
    expect(snap.thread.interruptReason).toBeNull();
  });

  it('merges variable patch on resume', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-r3', { state: 'awaiting_approval', variables: { taskId: 'abc' } });
    tick();
    const snap = svc.resumeCheckpoint('wf-r3', { variables: { approved: true } });
    expect(snap.thread.variables.taskId).toBe('abc');
    expect(snap.thread.variables.approved).toBe(true);
  });

  it('appends prior state to history on resume', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-hist', { state: 'awaiting_approval' });
    tick();
    const snap = svc.resumeCheckpoint('wf-hist');
    expect(snap.history.length).toBeGreaterThan(0);
    expect(snap.history[snap.history.length - 1].state).toBe('awaiting_approval');
  });

  it('allows resumed queued checkpoints', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-q', { state: 'queued' });
    tick();
    const snap = svc.resumeCheckpoint('wf-q');
    expect(snap.state).toBe('running');
  });
});

describe('abandonCheckpoint', () => {
  it('throws NotFound for unknown workflowId', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    expect(() => svc.abandonCheckpoint('no-such')).toThrow('NotFound');
  });

  it('returns abandon result with previousState', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-ab', { state: 'running' });
    const result = svc.abandonCheckpoint('wf-ab');
    expect(result.abandoned).toBe(true);
    expect(result.previousState).toBe('running');
    expect(result.workflowId).toBe('wf-ab');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('marks checkpoint as abandoned in store', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-ab2', { state: 'running' });
    svc.abandonCheckpoint('wf-ab2');
    const snap = svc.getCheckpoint('wf-ab2');
    expect(snap.state).toBe('abandoned');
  });
});

describe('listCheckpoints', () => {
  it('returns empty list when no checkpoints saved', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    const snap = svc.listCheckpoints();
    expect(snap.total).toBe(0);
    expect(snap.checkpoints).toHaveLength(0);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('lists all saved checkpoints in reverse chronological order', () => {
    const svc = createWorkflowCheckpointService({ timeProvider });
    svc.saveCheckpoint('wf-a', { state: 'queued' });
    tick();
    svc.saveCheckpoint('wf-b', { state: 'running' });
    const snap = svc.listCheckpoints();
    expect(snap.total).toBe(2);
    expect(snap.checkpoints[0].workflowId).toBe('wf-b');
  });
});

describe('pruning — maxCheckpoints', () => {
  it('evicts oldest checkpoint when limit exceeded', () => {
    const svc = createWorkflowCheckpointService({ timeProvider, maxCheckpoints: 2 });
    svc.saveCheckpoint('wf-1', { state: 'queued' }); tick();
    svc.saveCheckpoint('wf-2', { state: 'queued' }); tick();
    svc.saveCheckpoint('wf-3', { state: 'queued' }); // evicts wf-1
    expect(svc.getCheckpoint('wf-1')).toBeNull();
    expect(svc.getCheckpoint('wf-3')).not.toBeNull();
  });
});
