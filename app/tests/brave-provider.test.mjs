import { BraveSearchProvider } from '../infrastructure/search/search.providers.mjs';
import assert from 'assert';

describe('BraveSearchProvider', () => {
  it('should throw an error if API key is missing', () => {
    assert.throws(() => new BraveSearchProvider(), /API key is required/);
  });
});
