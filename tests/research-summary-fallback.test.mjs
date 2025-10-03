/**
 * Why: Guard generateSummary fallback behavior so the research pipeline delivers graceful output without surfacing faux errors.
 * What: Verifies that calling generateSummary with only invalid learnings returns the markdown fallback and logs through the output handler instead of invoking the error handler.
 * How: Mocks output/error callbacks around generateSummary and asserts call patterns plus the resulting summary contents.
 */

import { describe, test, expect, vi } from 'vitest';
import { generateSummary } from '../app/features/ai/research.providers.service.mjs';

describe('generateSummary fallback handling', () => {
  test('returns fallback summary and avoids error handler when learnings are invalid', async () => {
    const outputFn = vi.fn();
    const errorFn = vi.fn();

    const summary = await generateSummary({
      apiKey: 'test-key',
      query: 'Placeholder topic',
      learnings: ['error processing path', 'Error generating report'],
      outputFn,
      errorFn
    });

    expect(outputFn).toHaveBeenCalledWith(
      expect.stringContaining('No valid learnings provided to generate summary')
    );
    expect(errorFn).not.toHaveBeenCalled();
    expect(summary).toContain('No valid summary could be generated');
    expect(summary).toContain('Placeholder topic');
  });
});
