/**
 * Why: Provide CLI parity for chat workbench bootstrap data used by Nova session controls.
 * What: Exposes `/chat-workbench` with a `bootstrap` action and optional JSON output.
 * How: Delegates data retrieval to the chat workbench controller and formats deterministic output lines.
 */

import { getChatWorkbenchController } from '../features/chat/index.mjs';

function outputLines(snapshot, outputFn) {
  outputFn('--- Chat Workbench Bootstrap ---');
  outputFn(`Source: ${snapshot.source}`);
  outputFn(`Wiring: ${snapshot.feature.wiring}`);
  outputFn(`Default persona: ${snapshot.defaults.persona}`);
  outputFn(`Default model: ${snapshot.defaults.model}`);
  outputFn('Models:');
  snapshot.models.forEach((model) => {
    outputFn(`  - ${model.id} (${model.provider})`);
  });
  outputFn('Personas:');
  snapshot.personas.forEach((persona) => {
    outputFn(`  - ${persona.slug}: ${persona.label}`);
  });
  outputFn('Quick prompts:');
  snapshot.quickPrompts.forEach((prompt) => {
    outputFn(`  - ${prompt.title}`);
  });
}

export function getChatWorkbenchHelpText() {
  return [
    '/chat-workbench [bootstrap] [--json]     Show chat startup suggestions (models, personas, quick prompts).',
  ].join('\n');
}

export async function executeChatWorkbench(options = {}) {
  const outputFn = typeof options.output === 'function' ? options.output : console.log;
  const errorFn = typeof options.error === 'function' ? options.error : console.error;
  const action = (options.action || options.positionalArgs?.[0] || 'bootstrap').toLowerCase();
  const wantsJson = Boolean(options.flags?.json || options.flags?.JSON);

  if (action !== 'bootstrap' && action !== 'status') {
    errorFn(`Unknown chat-workbench action: ${action}`);
    outputFn(getChatWorkbenchHelpText());
    return { success: false, error: `Unknown action: ${action}` };
  }

  try {
    const controller = getChatWorkbenchController();
    const snapshot = await controller.getBootstrap();

    if (wantsJson) {
      outputFn(JSON.stringify(snapshot, null, 2));
    } else {
      outputLines(snapshot, outputFn);
    }

    return { success: true, snapshot };
  } catch (error) {
    const message = error?.message || String(error);
    errorFn(message);
    return { success: false, error: message };
  }
}

export default {
  executeChatWorkbench,
  getChatWorkbenchHelpText,
};
