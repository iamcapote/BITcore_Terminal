import { describe, it, expect, vi } from 'vitest';
import { createResearchTelemetry } from '../app/features/research/research.telemetry.mjs';

describe('research telemetry memory context', () => {
	it('normalizes memory context payloads before emitting', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 8 });

		const longQuery = 'q'.repeat(400);
		const records = Array.from({ length: 8 }, (_, index) => ({
			id: index,
			preview: `Record ${index}: ${'x'.repeat(400)}`,
			tags: [' primary ', '', 'secondary'],
			source: '  Example Source  ',
			score: index % 3 === 0 ? 1.4 : -0.5,
			timestamp: '2024-01-01T00:00:00Z'
		}));

		telemetry.emitMemoryContext({
			query: longQuery,
			stats: { stored: '5', retrieved: 2.4, validated: -2 },
			records
		});

		expect(send).toHaveBeenCalledTimes(1);
		const [type, data] = send.mock.calls[0];
		expect(type).toBe('research-memory');
		expect(data.query.length).toBeLessThanOrEqual(281); // 280 + ellipsis
		expect(data.stats).toMatchObject({ stored: 5, retrieved: 2, validated: 0 });
		expect(Array.isArray(data.records)).toBe(true);
		expect(data.records.length).toBeLessThanOrEqual(6);

		const firstRecord = data.records[0];
		expect(firstRecord.preview.length).toBeLessThanOrEqual(260);
		expect(firstRecord.tags).toEqual(['primary', 'secondary']);
		expect(firstRecord.source).toBe('Example Source');
		expect(firstRecord.score).toBeGreaterThanOrEqual(0);
		expect(firstRecord.score).toBeLessThanOrEqual(1);
	});

	it('replays buffered memory events to the latest sender', () => {
		const initialSend = vi.fn();
		const replaySend = vi.fn();
		const telemetry = createResearchTelemetry({ send: initialSend, bufferSize: 4 });

		telemetry.emitMemoryContext({ query: 'alpha', records: [{ preview: 'First record' }] });
		expect(initialSend).toHaveBeenCalledTimes(1);

		telemetry.updateSender(replaySend);
		telemetry.replay();

		expect(replaySend).toHaveBeenCalledTimes(1);
		const [type, data] = replaySend.mock.calls[0];
		expect(type).toBe('research-memory');
		expect(data.query).toBe('alpha');
		expect(data.records[0].preview).toBe('First record');
		expect(data.records).toHaveLength(1);
	});

		it('normalizes suggestion payloads and truncates metadata', () => {
			const send = vi.fn();
			const telemetry = createResearchTelemetry({ send, bufferSize: 12 });

			telemetry.emitSuggestions({
				source: 'Memory',
				generatedAt: 123,
				suggestions: [
					{
						prompt: ' '.repeat(5) + 'Investigate long-term risk mitigation strategies '.repeat(10),
						focus: 'Critical infrastructure resilience and redundancies',
						layer: 'long-term',
						memoryId: 'mem-1234567890',
						tags: ['ops ', ' ', 'risk'],
						score: 1.25
					},
					{
						prompt: null,
						focus: 'invalid'
					}
				]
			});

			expect(send).toHaveBeenCalledTimes(1);
			const [type, data] = send.mock.calls[0];
			expect(type).toBe('research-suggestions');
			expect(data.source).toBe('memory');
			expect(data.generatedAt).toBe(123);
			expect(Array.isArray(data.suggestions)).toBe(true);
			expect(data.suggestions).toHaveLength(1);
			const [entry] = data.suggestions;
			expect(entry.prompt.length).toBeLessThanOrEqual(240);
			expect(entry.focus).toBe('Critical infrastructure resilience and redundancies');
			expect(entry.layer).toBe('long-term');
			expect(entry.memoryId).toBe('mem-1234567890');
			expect(entry.tags).toEqual(['ops', 'risk']);
			expect(entry.score).toBe(1);
		});
});

describe('research telemetry core events', () => {
	it('throttles successive status events within the configured window', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 6, statusThrottleMs: 100 });

		vi.useFakeTimers();
		try {
			telemetry.emitStatus({ stage: 'one', message: 'first' });
			telemetry.emitStatus({ stage: 'two', message: 'second' });
			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0][0]).toBe('research-status');
			expect(send.mock.calls[0][1].stage).toBe('one');

			vi.advanceTimersByTime(101);
			telemetry.emitStatus({ stage: 'three', message: 'third' });
			expect(send).toHaveBeenCalledTimes(2);
			expect(send.mock.calls[1][1].stage).toBe('three');
		} finally {
			vi.useRealTimers();
		}
	});

	it('normalizes string thoughts and emits research-thought events', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 4 });

		telemetry.emitThought('Consider exploring primary sources.');
		expect(send).toHaveBeenCalledWith('research-thought', expect.objectContaining({
			text: 'Consider exploring primary sources.'
		}));
	});

	it('emits research-complete payloads with normalized fields', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 4 });

		telemetry.emitComplete({
			success: false,
			durationMs: '1200',
			learnings: 4,
			sources: 7,
			suggestedFilename: 'report.md',
			error: 'timeout',
			summary: 'Failed due to timeout.'
		});

		expect(send).toHaveBeenCalledWith('research-complete', expect.objectContaining({
			success: false,
			durationMs: null,
			learnings: 4,
			sources: 7,
			suggestedFilename: 'report.md',
			error: 'timeout',
			summary: 'Failed due to timeout.',
			meta: {}
		}));
	});

	it('normalizes token usage payloads for research-token-usage events', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 4 });

		telemetry.emitTokenUsage({
			stage: 'generate-queries',
			promptTokens: '42',
			completion_tokens: 13.7,
			totalTokens: undefined,
			model: ' llama-3.3-70b ',
			meta: { depth: 2, details: { breadth: 3, description: 'x'.repeat(400) } }
		});

		expect(send).toHaveBeenCalledWith('research-token-usage', expect.objectContaining({
			stage: 'generate-queries',
			promptTokens: 42,
			completionTokens: 14,
			totalTokens: 56,
			model: 'llama-3.3-70b',
			meta: expect.objectContaining({ depth: 2, details: expect.objectContaining({ breadth: 3 }) })
		}));
	});

	it('ignores token usage events without numeric measurements', () => {
		const send = vi.fn();
		const telemetry = createResearchTelemetry({ send, bufferSize: 2 });

		const result = telemetry.emitTokenUsage({ stage: 'generate-summary', model: 'foo' });

		expect(result).toBe(false);
		expect(send).not.toHaveBeenCalled();
		expect(telemetry.getTokenUsageTotals().events).toBe(0);
	});

	it('tracks aggregate token usage and supports reset', () => {
		const telemetry = createResearchTelemetry();
		telemetry.emitTokenUsage({ stage: 'generate-queries', promptTokens: 10, completionTokens: 5 });
		telemetry.emitTokenUsage({ stage: 'process-results', promptTokens: 3, completion_tokens: 7, totalTokens: 15 });
		telemetry.emitTokenUsage({ stage: 'generate-queries', promptTokens: 2 });

		const totals = telemetry.getTokenUsageTotals();
		expect(totals.promptTokens).toBe(15);
		expect(totals.completionTokens).toBe(12);
		expect(totals.totalTokens).toBe(30);
		expect(totals.events).toBe(3);
		expect(totals.perStage['generate-queries'].promptTokens).toBe(12);
		expect(totals.perStage['generate-queries'].events).toBe(2);
		expect(totals.perStage['process-results'].completionTokens).toBe(7);

		telemetry.resetTokenUsageTotals();
		const resetTotals = telemetry.getTokenUsageTotals();
		expect(resetTotals.promptTokens).toBe(0);
		expect(resetTotals.events).toBe(0);
		expect(Object.keys(resetTotals.perStage)).toHaveLength(0);
	});
});
