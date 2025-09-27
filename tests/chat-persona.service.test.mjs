import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChatPersonaService } from '../app/features/chat/chat-persona.service.mjs';
import { getPersonaCatalog } from '../app/features/chat/chat-persona.schema.mjs';

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'chat-persona-'));
}

describe('chat persona service', () => {
  let tempDir;
  let service;

  beforeEach(async () => {
    tempDir = await createTempDir();
    service = createChatPersonaService({ storageDir: tempDir, now: () => 1234567890 });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns catalog entries matching schema export', async () => {
    const listed = await service.list();
    const catalog = getPersonaCatalog();
    expect(listed.map((p) => p.slug)).toEqual(catalog.map((p) => p.slug));
  });

  it('returns bitcore as the default persona initially', async () => {
    const defaults = await service.getDefault();
    expect(defaults.persona.slug).toBe('bitcore');
  });

  it('persists new defaults across reads', async () => {
    await service.setDefault('archon');
    const again = await service.getDefault();
    expect(again.persona.slug).toBe('archon');
    expect(again.updatedAt).toBe(1234567890);
  });

  it('resets to the canonical default', async () => {
    await service.setDefault('archon');
    const reset = await service.reset();
    expect(reset.persona.slug).toBe('bitcore');
  });

  it('throws for unknown persona identifiers', async () => {
    await expect(service.setDefault('unknown-persona')).rejects.toThrow(/unknown persona/i);
  });
});
