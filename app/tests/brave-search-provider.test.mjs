import { BraveSearchProvider } from '../infrastructure/search/providers.mjs';

describe('BraveSearchProvider', () => {
    const mockApiKey = 'test-api-key';
    const provider = new BraveSearchProvider(mockApiKey);

    it('should retry on rate limit errors', async () => {
        // Mock fetch to simulate 429 responses
        global.fetch = jest.fn()
            .mockResolvedValueOnce({ status: 429, headers: { get: () => '1' } })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

        const result = await provider.makeRequest('test query');
        expect(result).toEqual({ items: [] });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw an error after max retries', async () => {
        global.fetch = jest.fn().mockResolvedValue({ status: 429, headers: { get: () => '1' } });

        await expect(provider.makeRequest('test query')).rejects.toThrow('Max retries exceeded');
        expect(fetch).toHaveBeenCalledTimes(5);
    });
});
