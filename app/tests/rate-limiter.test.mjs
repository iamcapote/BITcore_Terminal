import { RateLimiter } from '../utils/rate-limiter.mjs';
import assert from 'assert';

describe('RateLimiter', () => {
    it('should delay requests appropriately', async () => {
        const limiter = new RateLimiter(100);
        const start = Date.now();
        await limiter.waitForNextSlot();
        const end = Date.now();
        assert(end - start >= 100, 'RateLimiter did not delay correctly');
    });
});
