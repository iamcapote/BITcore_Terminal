/**
 * Contract
 * Why: Validate WebSocket input handler behaviour for prompt lifecycles and ensure IO helpers toggle input as designed.
 * What: Exercises handleInputMessage across error, post-research, and standard prompt branches with mocked dependencies.
 * How: Stubs WebSocket interactions, telemetry helpers, and GitHub sync adapter to assert side-effects and return values.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const safeSend = vi.fn();
const wsErrorHelper = vi.fn();
const wsOutputHelper = vi.fn();
const uploadFileMock = vi.fn(async () => ({ summary: { commitUrl: 'https://example.com/c', fileUrl: 'https://example.com/f' } }));
const getDecryptedGitHubConfigMock = vi.fn(async () => ({ owner: 'acme', repo: 'research', branch: 'main', token: 'ghp_token' }));

vi.mock('../app/utils/websocket.utils.mjs', () => ({
  safeSend,
}));

vi.mock('../app/features/research/websocket/client-io.mjs', () => ({
  wsErrorHelper,
  wsOutputHelper,
}));

vi.mock('../app/features/research/research.github-sync.controller.mjs', () => ({
  getGitHubResearchSyncController: () => ({
    uploadFile: uploadFileMock,
  }),
}));

vi.mock('../app/features/auth/user-manager.mjs', () => ({
  userManager: {
    getDecryptedGitHubConfig: (...args) => getDecryptedGitHubConfigMock(...args),
  },
}));

const { handleInputMessage } = await import('../app/features/research/websocket/input-handler.mjs');

function createSocket() {
  return { readyState: 1, sent: [], send(payload) { this.sent.push(payload); } };
}

function createBaseSession(overrides = {}) {
  return {
    sessionId: 'session-123',
    pendingPromptResolve: null,
    pendingPromptReject: null,
    promptTimeoutId: null,
    promptIsPassword: false,
    promptContext: null,
    promptData: null,
    currentResearchResult: null,
    currentResearchFilename: null,
    currentResearchQuery: null,
    password: null,
    lastActivity: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  getDecryptedGitHubConfigMock.mockClear();
});

describe('handleInputMessage', () => {
  it('rejects unexpected input when no prompt is pending and re-enables client input', async () => {
    const ws = createSocket();
    const session = createBaseSession();

    const result = await handleInputMessage(ws, { value: 'orphan response' }, session);

    expect(result).toBe(false);
    expect(wsErrorHelper).toHaveBeenCalledTimes(1);
    const [socketArg, message, enableFlag] = wsErrorHelper.mock.calls[0];
    expect(socketArg).toBe(ws);
    expect(message).toMatch(/unexpected input/i);
    expect(enableFlag).toBe(true);
  });

  it('handles post-research download action and clears cached result', async () => {
    const ws = createSocket();
    const resolve = vi.fn();
    const reject = vi.fn();
    const promptTimeoutId = setTimeout(() => {}, 1000);
    const session = createBaseSession({
      pendingPromptResolve: resolve,
      pendingPromptReject: reject,
      promptTimeoutId,
      promptIsPassword: false,
      promptContext: 'post_research_action',
      promptData: { suggestedFilename: 'analysis.md' },
      currentResearchResult: '# Findings',
      currentResearchFilename: 'result.md',
      currentResearchQuery: 'neural nets',
    });

    const result = await handleInputMessage(ws, { value: 'Download' }, session);

    expect(result).toBe(true);
    expect(wsErrorHelper).not.toHaveBeenCalled();
    expect(wsOutputHelper).toHaveBeenCalledWith(ws, expect.stringMatching(/Preparing download/i));
    expect(safeSend).toHaveBeenCalledWith(ws, {
      type: 'download_file',
      filename: 'analysis.md',
      content: '# Findings',
    });
    expect(session.currentResearchResult).toBeNull();
    expect(session.currentResearchFilename).toBeNull();
    expect(session.pendingPromptResolve).toBeNull();
    expect(session.pendingPromptReject).toBeNull();
    clearTimeout(promptTimeoutId);
  });

  it('uploads research results to GitHub and surfaces commit links', async () => {
    const ws = createSocket();
    const resolve = vi.fn();
    const reject = vi.fn();
    const promptTimeoutId = setTimeout(() => {}, 1000);
    getDecryptedGitHubConfigMock.mockResolvedValueOnce({
      owner: 'acme',
      repo: 'research-reports',
      branch: 'main',
      token: 'ghp_token'
    });
    uploadFileMock.mockResolvedValueOnce({
      summary: {
        commitUrl: 'https://example.com/commit/123',
        fileUrl: 'https://example.com/file/report.md'
      }
    });

    const session = createBaseSession({
      pendingPromptResolve: resolve,
      pendingPromptReject: reject,
      promptTimeoutId,
      promptIsPassword: false,
      promptContext: 'post_research_action',
      promptData: { suggestedFilename: 'analysis.md' },
      currentResearchResult: '# Findings',
      currentResearchFilename: 'draft.md',
      currentResearchQuery: 'vector databases',
    });

    const result = await handleInputMessage(ws, { value: 'Upload' }, session);

    expect(result).toBe(true);
    expect(wsOutputHelper).toHaveBeenCalledWith(ws, 'Attempting to upload to GitHub...');
    expect(wsOutputHelper).toHaveBeenCalledWith(ws, 'Upload successful!');
    expect(wsOutputHelper).toHaveBeenCalledWith(ws, expect.stringContaining('Commit: https://example.com/commit/123'));
    expect(wsOutputHelper).toHaveBeenCalledWith(ws, expect.stringContaining('File: https://example.com/file/report.md'));
    expect(uploadFileMock).toHaveBeenCalledWith({
      path: 'analysis.md',
      content: '# Findings',
      message: 'Research results for query: vector databases',
    });
    expect(getDecryptedGitHubConfigMock).toHaveBeenCalledTimes(1);
    expect(session.currentResearchResult).toBeNull();
    expect(session.currentResearchFilename).toBeNull();
    expect(session.currentResearchQuery).toBeUndefined();
    clearTimeout(promptTimeoutId);
  });

  it('reports upload errors and clears cached password hints on failure', async () => {
    const ws = createSocket();
    const resolve = vi.fn();
    const reject = vi.fn();
    const promptTimeoutId = setTimeout(() => {}, 1000);
    getDecryptedGitHubConfigMock.mockResolvedValueOnce({
      owner: 'acme',
      repo: 'research-reports',
      branch: 'main',
      token: 'ghp_token'
    });
    uploadFileMock.mockRejectedValueOnce(new Error('Password required to access GitHub repository'));

    const session = createBaseSession({
      pendingPromptResolve: resolve,
      pendingPromptReject: reject,
      promptTimeoutId,
      promptIsPassword: false,
      promptContext: 'post_research_action',
      promptData: { suggestedFilename: 'analysis.md' },
      currentResearchResult: '# Findings',
      currentResearchFilename: 'draft.md',
      currentResearchQuery: 'vector databases',
      password: 'cached-password'
    });

    const result = await handleInputMessage(ws, { value: 'Upload' }, session);

    expect(result).toBe(false);
    expect(uploadFileMock).toHaveBeenCalledWith({
      path: 'analysis.md',
      content: '# Findings',
      message: 'Research results for query: vector databases',
    });
    expect(wsErrorHelper).toHaveBeenCalledWith(
      ws,
      expect.stringContaining("Error performing action 'upload': Password required"),
      true
    );
    expect(session.password).toBeNull();
    expect(session.currentResearchResult).toBeNull();
    expect(session.currentResearchFilename).toBeNull();
    expect(session.currentResearchQuery).toBeUndefined();
    clearTimeout(promptTimeoutId);
  });

  it('prevents uploads when GitHub configuration is incomplete', async () => {
    const ws = createSocket();
    const resolve = vi.fn();
    const reject = vi.fn();
    const promptTimeoutId = setTimeout(() => {}, 1000);
    getDecryptedGitHubConfigMock.mockResolvedValueOnce({ owner: 'acme', repo: 'research', branch: 'main', token: null });

    const session = createBaseSession({
      pendingPromptResolve: resolve,
      pendingPromptReject: reject,
      promptTimeoutId,
      promptIsPassword: false,
      promptContext: 'post_research_action',
      promptData: { suggestedFilename: 'analysis.md' },
      currentResearchResult: '# Findings',
      currentResearchFilename: 'draft.md',
      currentResearchQuery: 'vector databases',
    });

    const result = await handleInputMessage(ws, { value: 'Upload' }, session);

    expect(result).toBe(true);
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(wsErrorHelper).toHaveBeenCalledWith(
      ws,
      expect.stringContaining('GitHub uploads require owner, repo, branch, and a token'),
      true
    );
    expect(session.currentResearchResult).toBe('# Findings');
    expect(session.currentResearchFilename).toBe('draft.md');
    expect(session.currentResearchQuery).toBe('vector databases');
    clearTimeout(promptTimeoutId);
  });

  it('resolves standard prompts without re-enabling input', async () => {
    const ws = createSocket();
    const resolve = vi.fn();
    const reject = vi.fn();
    const promptTimeoutId = setTimeout(() => {}, 1000);
    const session = createBaseSession({
      pendingPromptResolve: resolve,
      pendingPromptReject: reject,
      promptTimeoutId,
      promptIsPassword: true,
      promptContext: null,
    });

    const result = await handleInputMessage(ws, { value: 's3cr3t' }, session);

    expect(result).toBe(false);
    expect(resolve).toHaveBeenCalledWith('s3cr3t');
    expect(wsErrorHelper).not.toHaveBeenCalled();
    expect(wsOutputHelper).not.toHaveBeenCalled();
    expect(session.pendingPromptResolve).toBeNull();
    expect(session.pendingPromptReject).toBeNull();
    clearTimeout(promptTimeoutId);
  });
});
