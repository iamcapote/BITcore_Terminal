import { output } from '../app/utils/output-manager.mjs';
import assert from 'assert';

describe('OutputManager', () => {
  it('should log messages', () => {
    assert.doesNotThrow(() => output.log('Test message'));
  });
});
