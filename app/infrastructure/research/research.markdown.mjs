/**
 * Why: Centralise Markdown result generation so the research engine stays focused on orchestration.
 * What: Produces a suggested filename and Markdown payload from query context, learnings, sources, and summary.
 * How: Sanitises the query for filenames, formats sections, and returns both values without writing to disk.
 * Contract
 * Inputs:
 *   - params: {
 *       query: string;
 *       learnings?: string[];
 *       sources?: string[];
 *       summary?: string;
 *       now?: () => Date;
 *       logger?: { info?: (line: string) => void; error?: (line: string) => void };
 *     }
 *     `now` defaults to `() => new Date()` to ease testing. `logger.info` defaults to console.log; `logger.error` to console.error.
 * Outputs:
 *   - Promise<{ suggestedFilename: string; markdownContent: string }>.
 * Error modes:
 *   - Throws when required `query` is missing or when formatting fails; caller should handle.
 * Performance:
 *   - O(n) over number of learnings/sources; no I/O.
 * Side effects:
 *   - None (pure formatting aside from optional logging).
 */

import path from 'path';

const defaultLogger = {
  info: console.log.bind(console),
  error: console.error.bind(console)
};

export async function buildResearchMarkdown(params) {
  const {
    query,
    learnings = [],
    sources = [],
    summary = 'No summary available.',
    now = () => new Date(),
    logger = defaultLogger
  } = params || {};

  if (!query) {
    throw new Error('buildResearchMarkdown requires a query string.');
  }

  try {
    const timestamp = now().toISOString().replace(/[:.]/g, '-');
    const subject = query
      .replace(/[^a-zA-Z0-9\s-]+/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50) || 'untitled-research';

    const suggestedFilename = path.join('research', `research-${subject}-${timestamp}.md`).replace(/\\/g, '/');

    const markdownSections = [
      '# Research Results',
      '---',
      '## Query',
      '',
      query,
      '',
      '## Summary',
      '',
      summary,
      '',
      '## Key Learnings',
      '',
      ...learnings.map((item) => `- ${item}`),
      '',
      '## References',
      '',
      ...sources.map((item) => `- ${item}`)
    ];

    const markdownContent = markdownSections.join('\n');
    logger.info?.(`[research.markdown] Generated markdown. Suggested filename: ${suggestedFilename}`);
    return { suggestedFilename, markdownContent };
  } catch (error) {
    logger.error?.(`[research.markdown] Failed to build markdown: ${error.message}`);
    throw error;
  }
}
