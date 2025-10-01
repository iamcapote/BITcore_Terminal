/**
 * Why: Provide persona management helpers for the `/chat` CLI entrypoint.
 * What: Formats persona listings, resolves truthy flags, and executes list/get/set/reset subcommands.
 * How: Export `handlePersonaCommand` and `getPersonaHelpText` for reuse by the thin CLI wrapper.
 */

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function formatPersonaLines(persona, index, { isDefault = false } = {}) {
  const header = isDefault
    ? `[${index + 1}] ${persona.name} (${persona.slug}) ★`
    : `[${index + 1}] ${persona.name} (${persona.slug})`;
  const description = persona.description
    ? `    ${persona.description}`
    : '    No description provided.';
  return [header, description];
}

export function getPersonaHelpText() {
  return [
    '/chat persona list [--json]                 List available personas and indicate the current default.',
    '/chat persona get                          Show the current default persona.',
    '/chat persona set <slug|name> [--json]     Persist a new default persona.',
    '/chat persona reset                        Restore the default Bitcore persona.',
  ].join('\n');
}

/**
 * Contract
 * Inputs:
 *   - options: {
 *       args?: string[];
 *       flags?: Record<string, unknown>;
 *       outputFn: (line: string) => void;
 *       errorFn: (line: string) => void;
 *       personaController: {
 *         list: Function;
 *         getDefault: Function;
 *         setDefault: Function;
 *         reset: Function;
 *         describe?: Function;
 *       };
 *       currentUser?: object;
 *     }
 * Outputs:
 *   - Promise<{ success: boolean; handled: true; keepDisabled: boolean }>
 * Error modes:
 *   - Validation errors reported via errorFn with handled=true.
 *   - Controller failures propagated to errorFn and surfaced as handled=true responses.
 * Performance:
 *   - time: <100ms (controller calls dominate); memory: trivial.
 * Side effects:
 *   - Delegates persona mutations to the provided controller.
 */
export async function handlePersonaCommand({
  args = [],
  flags = {},
  outputFn,
  errorFn,
  personaController,
  currentUser,
}) {
  const action = (args.shift() || '').toLowerCase() || 'list';
  const wantsJson = isTruthy(flags.json ?? flags.JSON);

  switch (action) {
    case 'list':
    case 'ls':
    case 'show': {
      const snapshot = await personaController.list({ includeDefault: true });
      if (wantsJson) {
        outputFn(JSON.stringify({
          personas: snapshot.personas,
          default: snapshot.default,
          updatedAt: snapshot.updatedAt,
        }, null, 2));
      } else {
        outputFn('--- Available Chat Personas ---');
        snapshot.personas.forEach((persona, index) => {
          const isDefault = snapshot.default && snapshot.default.slug === persona.slug;
          formatPersonaLines(persona, index, { isDefault }).forEach((line) => outputFn(line));
        });
        if (snapshot.updatedAt) {
          const ts = new Date(snapshot.updatedAt).toISOString();
          outputFn(`Updated: ${ts}`);
        }
      }
      return { success: true, handled: true, keepDisabled: false };
    }

    case 'get':
    case 'current': {
      const state = await personaController.getDefault();
      if (wantsJson) {
        outputFn(JSON.stringify(state, null, 2));
      } else {
        outputFn(`Default persona: ${state.persona.name} (${state.persona.slug})`);
        if (state.updatedAt) {
          outputFn(`Last updated: ${new Date(state.updatedAt).toISOString()}`);
        }
        if (state.persona.description) {
          outputFn(state.persona.description);
        }
      }
      return { success: true, handled: true, keepDisabled: false };
    }

    case 'set':
    case 'use': {
      const identifier = args.shift()
        || flags.slug
        || flags.character
        || flags.persona;
      if (!identifier) {
        errorFn('Usage: /chat persona set <slug|name>');
        return { success: false, handled: true, keepDisabled: false };
      }
      try {
        const result = await personaController.setDefault(identifier, { actor: currentUser });
        if (wantsJson) {
          outputFn(JSON.stringify(result, null, 2));
        } else {
          outputFn(`Default persona updated to ${result.persona.name} (${result.persona.slug}).`);
        }
        return { success: true, handled: true, keepDisabled: false };
      } catch (error) {
        errorFn(error?.message ?? String(error));
        return { success: false, handled: true, keepDisabled: false };
      }
    }

    case 'reset': {
      const state = await personaController.reset({ actor: currentUser });
      if (wantsJson) {
        outputFn(JSON.stringify(state, null, 2));
      } else {
        outputFn(`Persona reset to ${state.persona.name} (${state.persona.slug}).`);
      }
      return { success: true, handled: true, keepDisabled: false };
    }

    case 'help': {
      getPersonaHelpText().split('\n').forEach((line) => outputFn(line));
      return { success: true, handled: true, keepDisabled: false };
    }

    default: {
      errorFn(`Unknown persona subcommand: ${action}`);
      getPersonaHelpText().split('\n').forEach((line) => outputFn(line));
      return { success: false, handled: true, keepDisabled: false };
    }
  }
}
