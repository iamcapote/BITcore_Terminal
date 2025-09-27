import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferencesSnapshot = Object.freeze({
  widgets: Object.freeze({
    telemetryPanel: true,
    memoryPanel: true,
    modelBrowser: false,
    telemetryIndicator: true,
    logIndicator: true,
  }),
  terminal: Object.freeze({
    retainHistory: true,
    autoScroll: true,
  }),
  updatedAt: 1748265600000,
});

const getTerminalPreferencesMock = vi.fn(async () => preferencesSnapshot);
const updateTerminalPreferencesMock = vi.fn(async () => preferencesSnapshot);
const resetTerminalPreferencesMock = vi.fn(async () => preferencesSnapshot);

vi.mock('../app/features/preferences/index.mjs', () => ({
  getTerminalPreferences: getTerminalPreferencesMock,
  updateTerminalPreferences: updateTerminalPreferencesMock,
  resetTerminalPreferences: resetTerminalPreferencesMock,
}));

vi.mock('../app/utils/cli-error-handler.mjs', async () => {
  const actual = await vi.importActual('../app/utils/cli-error-handler.mjs');
  return {
    ...actual,
    handleCliError: vi.fn(),
  };
});

const { executeTerminal, getTerminalHelpText } = await import('../app/commands/terminal.cli.mjs');

function createSpies() {
  const outputs = [];
  const output = vi.fn(value => {
    outputs.push(value);
  });
  const errors = [];
  const error = vi.fn(value => {
    errors.push(value);
  });
  return { output, error, outputs, errors };
}

beforeEach(() => {
  getTerminalPreferencesMock.mockClear().mockResolvedValue(preferencesSnapshot);
  updateTerminalPreferencesMock.mockClear().mockResolvedValue(preferencesSnapshot);
  resetTerminalPreferencesMock.mockClear().mockResolvedValue(preferencesSnapshot);
});

describe('terminal CLI help', () => {
  it('includes preference usage details', () => {
    const help = getTerminalHelpText();
    expect(help).toContain('/terminal prefs');
    expect(help).toContain('telemetry-panel');
  });
});

describe('executeTerminal', () => {
  it('prints current preferences when no flags supplied', async () => {
    const { output, error, outputs } = createSpies();
    const result = await executeTerminal({}, output, error);

    expect(result.success).toBe(true);
    expect(getTerminalPreferencesMock).toHaveBeenCalledTimes(1);
    expect(updateTerminalPreferencesMock).not.toHaveBeenCalled();
    expect(resetTerminalPreferencesMock).not.toHaveBeenCalled();
    const ack = outputs.at(-1);
    expect(ack).toEqual({ type: 'output', data: '', keepDisabled: false });
    expect(error).not.toHaveBeenCalled();
  });

  it('updates widgets when boolean flags are provided', async () => {
    const { output, error } = createSpies();
    await executeTerminal({ flags: { 'telemetry-panel': 'false', 'log-indicator': 'false', 'auto-scroll': '0' } }, output, error);

    expect(updateTerminalPreferencesMock).toHaveBeenCalledWith({
      widgets: { telemetryPanel: false, logIndicator: false },
      terminal: { autoScroll: false },
    });
  });

  it('resets preferences when requested', async () => {
    const { output, error } = createSpies();
    const result = await executeTerminal({ flags: { reset: 'true' } }, output, error);

    expect(result.success).toBe(true);
    expect(resetTerminalPreferencesMock).toHaveBeenCalledTimes(1);
    expect(updateTerminalPreferencesMock).not.toHaveBeenCalled();
  });
});
