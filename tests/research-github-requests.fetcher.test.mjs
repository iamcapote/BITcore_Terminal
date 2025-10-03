import { describe, expect, it, vi } from 'vitest';
import { fetchResearchRequests } from '../app/features/research/github-sync/request.fetcher.mjs';

function createController(files) {
  const listEntries = vi.fn().mockResolvedValue({
    entries: files.map(file => ({ type: 'file', path: file.path })),
    ref: 'main'
  });
  const fetchFile = vi.fn(async ({ path }) => files.find(file => file.path === path));
  return { listEntries, fetchFile };
}

describe('fetchResearchRequests', () => {
  it('parses JSON requests and filters pending items', async () => {
    const files = [
      {
        path: 'requests/request-1.json',
        content: JSON.stringify({ query: 'Explore fusion reactors', depth: 3, status: 'pending', metadata: { urgency: 'high' } }),
        sha: 'sha-1'
      },
      {
        path: 'requests/request-2.json',
        content: JSON.stringify({ query: 'Retired request', status: 'closed' }),
        sha: 'sha-2'
      }
    ];
    const controller = createController(files);

    const result = await fetchResearchRequests({ controller, directory: 'requests' });

    expect(controller.listEntries).toHaveBeenCalledWith({ path: 'requests' });
    expect(controller.fetchFile).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(1);
    expect(result.requests[0]).toMatchObject({
      id: 'request-1',
      query: 'Explore fusion reactors',
      depth: 3,
      status: 'pending',
      metadata: { urgency: 'high' }
    });
  });

  it('treats plaintext files as simple query requests', async () => {
    const files = [
      {
        path: 'requests/plain-request.txt',
        content: 'Investigate superconducting materials advancements\n',
        sha: 'sha-3'
      }
    ];
    const controller = createController(files);

    const result = await fetchResearchRequests({ controller, directory: 'requests' });

    expect(result.count).toBe(1);
    expect(result.requests[0]).toMatchObject({
      id: 'plain-request',
      query: 'Investigate superconducting materials advancements',
      status: 'pending'
    });
  });
});
