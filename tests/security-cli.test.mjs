/**
 * Why: Confirm /security surfaces the research security status summary and handles errors gracefully.
 * What: Mocks the status controller to verify rendering and error messaging.
 * How: Stubs controller responses and inspects emitted output for expected lines.
 */

import { describe, beforeEach, test, expect, vi } from 'vitest';

const summaryMock = vi.fn();

vi.mock('../app/features/status/index.mjs', () => ({
  getStatusController: vi.fn(() => ({ summary: summaryMock }))
}));

let executeSecurity;

beforeEach(async () => {
  summaryMock.mockReset();
  ({ executeSecurity } = await import('../app/commands/security.cli.mjs'));
});

describe('executeSecurity', () => {
  test('prints security status details', async () => {
    summaryMock.mockResolvedValue({
      statuses: {
        security: {
          state: 'active',
          message: 'CSRF required with rate limiting enforced.',
          meta: {
            csrfRequired: true,
            csrfTtlMs: 600000,
            rateLimit: { maxTokens: 3, intervalMs: 1000 },
            depthRange: { min: 1, max: 6 },
            breadthRange: { min: 1, max: 6 },
            tokenUsage: {
              aggregate: {
                promptTokens: 120,
                completionTokens: 80,
                totalTokens: 200,
                events: 4,
                operators: 1,
                updatedAt: '2025-10-15T22:00:00.000Z'
              },
              perOperator: {
                operator: {
                  promptTokens: 120,
                  completionTokens: 80,
                  totalTokens: 200,
                  events: 4,
                  updatedAt: '2025-10-15T22:00:00.000Z',
                  perStage: {}
                }
              }
            }
          }
        }
      }
    });

    const outputs = [];
    const result = await executeSecurity({ output: (value) => outputs.push(value) });

    expect(result.success).toBe(true);
    expect(outputs.join('\n')).toContain('Research Security');
    expect(outputs.join('\n')).toContain('CSRF required (WebSocket): Enabled');
    expect(outputs.join('\n')).toContain('Token usage (aggregate)');
    expect(outputs.join('\n')).toContain('operator: prompts=120');
  });

  test('returns handled error for unknown action', async () => {
    const errors = [];
    const result = await executeSecurity({
      positionalArgs: ['rotate'],
      error: (value) => errors.push(value)
    });
    expect(result.success).toBe(false);
    expect(errors[0]).toContain('Unknown security action');
  });
});
