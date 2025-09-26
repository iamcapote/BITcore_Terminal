import { RateLimiter } from '../utils/research.rate-limiter.mjs';
import assert from 'assert';

describe('RateLimiter', () => {
    it('should delay requests appropriately after the initial call', async () => {
        const limiter = new RateLimiter(100);
        await limiter.waitForNextSlot(); // initial call should not wait
        const start = Date.now();
        await limiter.waitForNextSlot();
        const end = Date.now();
        assert(end - start >= 100, 'RateLimiter did not delay correctly');
    });
});
