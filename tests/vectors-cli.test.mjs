import { beforeEach, describe, expect, it } from 'vitest';
import { executeVectors, getVectorsHelpText } from '../app/commands/vectors.cli.mjs';
import { resetVectorAdminController } from '../app/features/ai/vector-admin/index.mjs';
import { resetVectorAdminServiceSingleton } from '../app/infrastructure/ai/vector-admin.service.mjs';

beforeEach(() => {
  resetVectorAdminController();
  resetVectorAdminServiceSingleton();
});

describe('vectors cli command', () => {
  it('exposes help text', () => {
    const help = getVectorsHelpText();
    expect(help).toContain('/vectors status');
    expect(help).toContain('/vectors process');
  });

  it('returns status snapshot by default', async () => {
    const result = await executeVectors({ flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.snapshot.feature.mode).toBe('mock');
  });

  it('returns accepted mimes', async () => {
    const result = await executeVectors({ action: 'accepts', flags: { json: true } });
    expect(result.success).toBe(true);
    expect(result.payload.acceptedMimes.length).toBeGreaterThan(0);
  });

  it('validates required flags for process', async () => {
    const result = await executeVectors({ action: 'process', flags: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ValidationError');
  });
});
