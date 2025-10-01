import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTestApiKeys = vi.fn();
const mockCheckApiKeys = vi.fn();
const mockHasGitHubToken = vi.fn();

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  const mutable = { ...actual };
  return {
    __esModule: true,
    default: mutable,
    ...mutable
  };
});

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: {
    testApiKeys: mockTestApiKeys,
    checkApiKeys: mockCheckApiKeys,
    hasGitHubToken: mockHasGitHubToken,
    storageDir: '/tmp/bitcore-test'
  }
}));

vi.mock('../app/utils/cli-error-handler.mjs', async () => {
  const actual = await vi.importActual('../app/utils/cli-error-handler.mjs');
  return {
    ...actual,
    logCommandStart: vi.fn()
  };
});

const { executeKeys } = await import('../app/commands/keys.cli.mjs');
const { executeDiagnose } = await import('../app/commands/diagnose.cli.mjs');
const fsPromises = (await import('fs/promises')).default;

function createSpies() {
  const outputs = [];
  const errors = [];
  return {
    output: vi.fn((line) => outputs.push(line)),
    error: vi.fn((line) => errors.push(line)),
    outputs,
    errors
  };
}

beforeEach(() => {
  mockTestApiKeys.mockReset();
  mockCheckApiKeys.mockReset();
  mockHasGitHubToken.mockReset();
});

describe('keys CLI – GitHub token diagnostics', () => {
  it('reports GitHub token failures during /keys test', async () => {
    mockTestApiKeys.mockResolvedValue({
      brave: { success: true, error: null },
      venice: { success: true, error: null },
      github: { success: false, error: 'GitHub token is not set' }
    });

    const { output, error, outputs, errors } = createSpies();

    const result = await executeKeys({ positionalArgs: ['test'], output, error });

    expect(mockTestApiKeys).toHaveBeenCalledOnce();
    expect(outputs).toContain('Testing configured credentials...');
    expect(outputs).toContain('GitHub Token: Failed (GitHub token is not set)');
    expect(errors).toContain('One or more credentials failed validation.');
    expect(result.success).toBe(false);
  });

  it('reports GitHub token success during /keys test', async () => {
    mockTestApiKeys.mockResolvedValue({
      brave: { success: true, error: null },
      venice: { success: null, error: 'Not configured' },
      github: { success: true, error: null }
    });

    const { output, error, outputs, errors } = createSpies();

    const result = await executeKeys({ positionalArgs: ['test'], output, error });

    expect(mockTestApiKeys).toHaveBeenCalledOnce();
    expect(outputs).toContain('GitHub Token: OK');
    expect(errors.length).toBe(0);
    expect(result.success).toBe(true);
  });
});

describe('diagnose CLI – GitHub token diagnostics', () => {
  it('emits GitHub token status during API checks', async () => {
    mockTestApiKeys.mockResolvedValue({
      brave: { success: true, error: null },
      venice: { success: true, error: null },
      github: { success: false, error: 'GitHub token is not set' }
    });

    const { output, error, outputs, errors } = createSpies();

    const result = await executeDiagnose({
      positionalArgs: ['api'],
      currentUser: { username: 'operator', role: 'admin' },
      output,
      error
    });

    expect(mockTestApiKeys).toHaveBeenCalledOnce();
    const githubLine = outputs.find((line) => typeof line === 'string' && line.includes('GitHub'));
    expect(githubLine).toBeDefined();
    expect(githubLine).toContain('GitHub: Failed (GitHub token is not set)');
    expect(errors.length).toBe(0);
    expect(result.success).toBe(false);
  });

  it('returns success when all API credentials validate', async () => {
    mockTestApiKeys.mockResolvedValue({
      brave: { success: true, error: null },
      venice: { success: true, error: null },
      github: { success: true, error: null }
    });

    const { output, error, outputs, errors } = createSpies();

    const result = await executeDiagnose({
      positionalArgs: ['api'],
      currentUser: { username: 'operator', role: 'admin' },
      output,
      error
    });

    expect(mockTestApiKeys).toHaveBeenCalledOnce();
    expect(outputs).toContain('API Check Result: OK');
    expect(errors.length).toBe(0);
    expect(result.success).toBe(true);
  });
});

describe('diagnose CLI – aggregation across local checks', () => {
  const admin = { username: 'operator', role: 'admin' };

  it('fails when directory permissions are unavailable', async () => {
    const originalAccess = fsPromises.access;
    fsPromises.access = vi.fn().mockRejectedValue(new Error('denied'));

    const { output, error, errors } = createSpies();

    const result = await executeDiagnose({
      positionalArgs: ['perms'],
      currentUser: admin,
      output,
      error
    });

    expect(fsPromises.access).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.results?.permissions?.success).toBe(false);
    expect(errors.length).toBe(0);

    fsPromises.access = originalAccess;
  });

  it('fails when storage metrics cannot be collected', async () => {
    const originalReaddir = fsPromises.readdir;
    fsPromises.readdir = vi.fn().mockRejectedValue(new Error('unavailable'));

    const { output, error, errors } = createSpies();

    const result = await executeDiagnose({
      positionalArgs: ['storage'],
      currentUser: admin,
      output,
      error
    });

    expect(fsPromises.readdir).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.results?.storage?.success).toBe(false);
    expect(errors.length).toBe(0);

    fsPromises.readdir = originalReaddir;
  });
});
