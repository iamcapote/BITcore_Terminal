import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PromptRepository, NotFoundError } from '../app/features/prompts/prompt.repository.mjs';

function createClock(...timestamps) {
  const queue = timestamps.slice();
  return () => {
    const next = queue.shift();
    return next instanceof Date ? next : new Date(next ?? '2030-01-01T00:00:00.000Z');
  };
}

describe('PromptRepository', () => {
  let workingDir;
  let repository;

  beforeEach(async () => {
    workingDir = await fs.mkdtemp(path.join(tmpdir(), 'prompt-repo-'));
    repository = new PromptRepository({
      baseDir: workingDir,
      now: createClock(
        new Date('2024-05-01T12:00:00.000Z'),
        new Date('2024-05-02T13:30:00.000Z'),
        new Date('2024-05-03T09:15:00.000Z')
      )
    });
  });

  afterEach(async () => {
    await fs.rm(workingDir, { recursive: true, force: true });
  });

  it('saves a new prompt and lists it via summaries and records', async () => {
    const record = await repository.save({
      id: 'daily-check-in',
      title: 'Daily Check-In',
      body: 'Ask the user how their day is going.'
    });

    expect(record.version).toBe(1);
    expect(record.createdAt).toBe('2024-05-01T12:00:00.000Z');
    expect(record.updatedAt).toBe('2024-05-01T12:00:00.000Z');

    const summaries = await repository.listSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'daily-check-in',
      title: 'Daily Check-In'
    });

    const records = await repository.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0].body).toContain('Ask the user');
    expect(await repository.exists('daily-check-in')).toBe(true);
  });

  it('increments version and preserves createdAt on update', async () => {
    await repository.save({
      id: 'status-update',
      title: 'Status Update',
      body: 'Collect blockers and progress.'
    });

    const updated = await repository.save({
      id: 'status-update',
      title: 'Status Update v2',
      body: 'Collect blockers, progress, and highlights.',
      tags: ['sync']
    });

    expect(updated.version).toBe(2);
    expect(updated.createdAt).toBe('2024-05-01T12:00:00.000Z');
  expect(updated.updatedAt).toBe('2024-05-03T09:15:00.000Z');
    expect(updated.tags).toContain('sync');

    const stored = JSON.parse(
      await fs.readFile(path.join(workingDir, 'status-update.prompt.json'), 'utf8')
    );
    expect(stored.version).toBe(2);
    expect(stored.title).toBe('Status Update v2');
  });

  it('deletes prompts and throws NotFoundError when missing', async () => {
    await repository.save({
      id: 'retro-guide',
      title: 'Retro Guide',
      body: 'Lead a blameless retrospective.'
    });

    await repository.delete('retro-guide');
    await expect(repository.get('retro-guide')).rejects.toBeInstanceOf(NotFoundError);
    expect(await repository.exists('retro-guide')).toBe(false);
  });
});
