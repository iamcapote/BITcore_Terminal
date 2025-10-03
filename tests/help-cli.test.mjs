/**
 * Why: Guarantee the aggregated `/help` output stays in sync with the registered command surface.
 * What: Asserts the help text is alphabetical, includes the latest command suites, and ends with the explicit `/help` guidance.
 * How: Imports `getHelpText` from the command registry and inspects the formatted blocks without mocking individual modules.
 */

import { describe, test, expect } from 'vitest';
import { getHelpText } from '../app/commands/index.mjs';
import * as chatCli from '../app/commands/chat.cli.mjs';
import * as chatHistoryCli from '../app/commands/chat-history.cli.mjs';
import * as diagnoseCli from '../app/commands/diagnose.cli.mjs';
import * as exportCli from '../app/commands/export.cli.mjs';
import * as githubSyncCli from '../app/commands/research.github-sync.cli.mjs';
import * as keysCli from '../app/commands/keys.cli.mjs';
import * as logsCli from '../app/commands/logs.cli.mjs';
import * as loginCli from '../app/commands/login.cli.mjs';
import * as logoutCli from '../app/commands/logout.cli.mjs';
import * as memoryCli from '../app/commands/memory.cli.mjs';
import * as missionsCli from '../app/commands/missions.cli.mjs';
import * as passwordCli from '../app/commands/password.cli.mjs';
import * as promptsCli from '../app/commands/prompts.cli.mjs';
import * as researchCli from '../app/commands/research.cli.mjs';
import * as researchGitHubCli from '../app/commands/research-github.cli.mjs';
import * as researchSchedulerCli from '../app/commands/research-scheduler.cli.mjs';
import * as statusCli from '../app/commands/status.cli.mjs';
import * as storageCli from '../app/commands/storage.cli.mjs';
import * as terminalCli from '../app/commands/terminal.cli.mjs';
import * as usersCli from '../app/commands/users.cli.mjs';

const helpProviders = [
  { name: 'chat', getter: chatCli.getChatHelpText },
  { name: 'chat-history', getter: chatHistoryCli.getChatHistoryHelpText },
  { name: 'diagnose', getter: diagnoseCli.getDiagnoseHelpText },
  { name: 'export', getter: exportCli.getExportHelpText },
  { name: 'github-sync', getter: githubSyncCli.getGithubSyncHelpText },
  { name: 'keys', getter: keysCli.getKeysHelpText },
  { name: 'logs', getter: logsCli.getLogsHelpText },
  { name: 'login', getter: loginCli.getLoginHelpText },
  { name: 'logout', getter: logoutCli.getLogoutHelpText },
  { name: 'memory', getter: memoryCli.getMemoryHelpText },
  { name: 'missions', getter: missionsCli.getMissionsHelpText },
  { name: 'password-change', getter: passwordCli.getPasswordChangeHelpText },
  { name: 'prompts', getter: promptsCli.getPromptsHelpText },
  { name: 'research', getter: researchCli.getResearchHelpText },
  { name: 'research-github', getter: researchGitHubCli.getResearchGitHubHelpText },
  { name: 'research-scheduler', getter: researchSchedulerCli.getResearchSchedulerHelpText },
  { name: 'status', getter: statusCli.getStatusHelpText },
  { name: 'storage', getter: storageCli.getStorageHelpText },
  { name: 'terminal', getter: terminalCli.getTerminalHelpText },
  { name: 'users', getter: usersCli.getUsersHelpText }
];

function collectExpectedHeaders() {
  return helpProviders
    .map(({ name, getter }) => {
      if (typeof getter !== 'function') {
        return null;
      }
      const text = getter();
      if (typeof text !== 'string' || !text.trim()) {
        return null;
      }
      const header = text.trim().split('\n').find((line) => line.startsWith('/'));
      if (!header) {
        return null;
      }
      return { name, header };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => item.header);
}

describe('/help command output', () => {
  test('includes storage command and ends with explicit help line', () => {
    const helpText = getHelpText();
    expect(helpText).toContain('/storage');
    expect(helpText).toContain('/export');
    expect(helpText.trim().endsWith('/help                     Show this help message.')).toBe(true);
  });

  test('lists command blocks in alphabetical order', () => {
    const helpText = getHelpText();
    const expectedHeaders = collectExpectedHeaders();
    let cursor = -1;
    expectedHeaders.forEach((header) => {
      const position = helpText.indexOf(header);
      expect(position, `${header} appears out of order in help output`).toBeGreaterThan(cursor);
      cursor = position;
    });
    expect(helpText.trim().endsWith('/help                     Show this help message.')).toBe(true);
  });
});
