import { describe, it, expect, vi } from 'vitest';
import { getResearchData } from '../features/research/research.controller.mjs';

vi.mock('../infrastructure/research/research.engine.mjs', () => {
    const result = {
        learnings: ['Learning A'],
        sources: ['Source A'],
        summary: 'Summary text'
    };
    const ctor = vi.fn().mockImplementation(() => ({
        research: vi.fn().mockResolvedValue(result)
    }));
    return { ResearchEngine: ctor, default: ctor };
});

describe('Research Data helper', () => {
    it('returns structured research results', async () => {
        const data = await getResearchData();
        expect(Array.isArray(data.learnings)).toBe(true);
        expect(data.learnings.length).toBeGreaterThan(0);
        expect(Array.isArray(data.sources)).toBe(true);
    });
});
