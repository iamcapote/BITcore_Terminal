import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StagingManager } from '../app/public/github-sync/modules/staging.js';

describe('StagingManager', () => {
  let manager;
  let logger;

  beforeEach(() => {
    logger = { error: vi.fn() };
    manager = new StagingManager({ logger });
  });

  it('stages files, marks the first as active, and emits lifecycle events', () => {
    const changeSpy = vi.fn();
    const activeSpy = vi.fn();
    manager.on('change', changeSpy);
    manager.on('active-change', activeSpy);

    const record = manager.stageFile({ path: 'docs/notes.md', content: 'hello' });

    expect(record.path).toBe('docs/notes.md');
    expect(record.content).toBe('hello');
    expect(manager.getActive()).toEqual(expect.objectContaining({ path: 'docs/notes.md' }));

    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy).toHaveBeenCalledWith([
      expect.objectContaining({ path: 'docs/notes.md', content: 'hello' })
    ]);
    expect(activeSpy).toHaveBeenCalledTimes(1);
    expect(activeSpy).toHaveBeenCalledWith({
      path: 'docs/notes.md',
      file: expect.objectContaining({ path: 'docs/notes.md', content: 'hello' })
    });
  });

  it('updates content, tracks dirty state, and emits updates for the active file', () => {
    manager.stageFile({ path: 'notes.md', content: 'hello' });
    const changeSpy = vi.fn();
    const activeSpy = vi.fn();
    manager.on('change', changeSpy);
    manager.on('active-change', activeSpy);

    const updated = manager.updateContent('notes.md', 'updated');

    expect(updated.content).toBe('updated');
    expect(manager.isDirty('notes.md')).toBe(true);
    expect(manager.dirtyEntries()).toHaveLength(1);
    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(activeSpy).toHaveBeenCalledWith({
      path: 'notes.md',
      file: expect.objectContaining({ content: 'updated' })
    });
  });

  it('changes the active file and validates existence', () => {
    manager.stageFile({ path: 'a.md', content: 'A' });
    manager.stageFile({ path: 'b.md', content: 'B' });

    const activeSpy = vi.fn();
    manager.on('active-change', activeSpy);

    const nextActive = manager.setActive('b.md');
    expect(nextActive).toEqual(expect.objectContaining({ path: 'b.md' }));
    expect(activeSpy).toHaveBeenLastCalledWith({
      path: 'b.md',
      file: expect.objectContaining({ path: 'b.md' })
    });

    expect(() => manager.setActive('missing.md')).toThrow(/Cannot activate unstaged file/);
  });

  it('removes files, clears active selection when needed, and emits events', () => {
    manager.stageFile({ path: 'one.md', content: '1' });
    manager.stageFile({ path: 'two.md', content: '2' });

    const changeSpy = vi.fn();
    const activeSpy = vi.fn();
    manager.on('change', changeSpy);
    manager.on('active-change', activeSpy);

    expect(manager.remove('one.md')).toBe(true);

    expect(manager.has('one.md')).toBe(false);
    expect(manager.get('two.md')).toEqual(expect.objectContaining({ path: 'two.md' }));
    expect(changeSpy).toHaveBeenCalled();
    expect(activeSpy).toHaveBeenLastCalledWith({
      path: 'two.md',
      file: expect.objectContaining({ path: 'two.md' })
    });

    manager.remove('two.md');
    expect(activeSpy).toHaveBeenLastCalledWith({ path: null, file: null });
  });

  it('clears all staging entries and resets active path', () => {
    manager.stageFile({ path: 'a.md', content: 'A' });
    manager.stageFile({ path: 'b.md', content: 'B' });

    const changeSpy = vi.fn();
    const activeSpy = vi.fn();
    manager.on('change', changeSpy);
    manager.on('active-change', activeSpy);

    manager.clear();

    expect(manager.toArray()).toEqual([]);
    expect(manager.getActive()).toBeNull();
    expect(changeSpy).toHaveBeenCalledWith([]);
    expect(activeSpy).toHaveBeenLastCalledWith({ path: null, file: null });
  });

  it('enforces non-empty paths when staging files', () => {
  expect(() => manager.stageFile({ path: '   ', content: '' })).toThrow(/requires a non-empty path/);
    expect(() => manager.stageFile({ content: 'missing' })).toThrow(/requires a path/);
  });
});
