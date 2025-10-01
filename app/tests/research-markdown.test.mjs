import { describe, expect, it, vi } from 'vitest';
import { buildResearchMarkdown } from '../infrastructure/research/research.markdown.mjs';

describe('buildResearchMarkdown', () => {
  it('sanitises query and formats markdown output', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const now = () => new Date('2024-03-01T12:34:56.789Z');

    const { suggestedFilename, markdownContent } = await buildResearchMarkdown({
      query: 'What is launch 🚀 velocity?',
      learnings: ['Learning A', 'Learning B'],
      sources: ['https://example.com/a', 'https://example.com/b'],
      summary: 'Summary text',
      now,
      logger
    });

    expect(suggestedFilename).toBe('research/research-what-is-launch-velocity-2024-03-01T12-34-56-789Z.md');
    expect(markdownContent).toContain('# Research Results');
    expect(markdownContent).toContain('## Key Learnings');
    expect(markdownContent).toContain('- Learning A');
    expect(markdownContent).toContain('- https://example.com/a');
    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws when query is missing', async () => {
    await expect(buildResearchMarkdown({})).rejects.toThrow('buildResearchMarkdown requires a query string.');
  });
});
