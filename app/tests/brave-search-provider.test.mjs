import { BraveSearchProvider } from '../infrastructure/search/search.providers.mjs';

describe('BraveSearchProvider', () => {
    it('should throw an error if API key is missing', () => {
        // Constructor should throw when no key present
        expect(() => new BraveSearchProvider()).toThrow(/API key is required/);
    });
});
