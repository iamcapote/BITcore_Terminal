import { getResearchData } from '../features/research/controller.mjs';
import assert from 'assert';

describe('Research Data Tests', () => {
    it('should fetch research data', async () => {
        const data = await getResearchData();
        assert(Array.isArray(data), 'Data should be an array');
        assert(data.length > 0, 'Data should not be empty');
    });
});
