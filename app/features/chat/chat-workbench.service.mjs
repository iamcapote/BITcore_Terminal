/**
 * Why: Provide a stable mock-first bootstrap contract for chat workbench presets inspired by chatbot-ui session starters.
 * What: Returns curated model options, persona suggestions, and quick-start prompts for CLI and Nova consumers.
 * How: Build immutable snapshots from local constants so downstream surfaces can wire now and replace internals later.
 */

const DEFAULT_MODELS = Object.freeze([
  Object.freeze({ id: 'qwen3-235b', label: 'Qwen 3 235B', provider: 'venice', capability: 'reasoning' }),
  Object.freeze({ id: 'deepseek-r1-671b', label: 'DeepSeek R1 671B', provider: 'venice', capability: 'analysis' }),
  Object.freeze({ id: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'venice', capability: 'balanced' }),
]);

const DEFAULT_PERSONAS = Object.freeze([
  Object.freeze({ slug: 'bitcore', label: 'BITcore Operator', summary: 'General operations assistant.' }),
  Object.freeze({ slug: 'researcher', label: 'Research Analyst', summary: 'Focused on deep investigation and synthesis.' }),
  Object.freeze({ slug: 'builder', label: 'Systems Builder', summary: 'Focused on implementation and refactors.' }),
]);

const DEFAULT_PROMPTS = Object.freeze([
  Object.freeze({
    id: 'incident-triage',
    title: 'Incident triage',
    prompt: 'Summarize the incident scope, likely impact, and first containment actions.',
  }),
  Object.freeze({
    id: 'research-plan',
    title: 'Research plan',
    prompt: 'Create a bounded research plan with milestones and risks.',
  }),
  Object.freeze({
    id: 'refactor-slice',
    title: 'Refactor slice',
    prompt: 'Propose the smallest reversible refactor slice with tests and rollback path.',
  }),
]);

function freezeRows(rows) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({ ...row })));
}

/**
 * Contract
 * Inputs:
 *   - personaController: optional persona controller exposing list/getDefault for continuity with existing chat personas.
 *   - now: optional clock function returning epoch milliseconds.
 * Outputs:
 *   - listBootstrap(): { source, feature, models, personas, quickPrompts, defaults, updatedAt }
 * Error modes:
 *   - Throws TypeError only when constructor dependencies are invalid.
 * Performance:
 *   - time: <20ms; memory: <1 MB.
 * Side effects:
 *   - None. Read-only in-memory snapshots.
 */
export function createChatWorkbenchService({ personaController = null, now = Date.now } = {}) {
  if (typeof now !== 'function') {
    throw new TypeError('createChatWorkbenchService requires a clock function.');
  }

  async function buildPersonaRows() {
    if (!personaController || typeof personaController.list !== 'function') {
      return DEFAULT_PERSONAS;
    }
    try {
      const snapshot = await personaController.list({ includeDefault: true });
      if (!snapshot || !Array.isArray(snapshot.personas) || snapshot.personas.length === 0) {
        return DEFAULT_PERSONAS;
      }
      return freezeRows(snapshot.personas.map((persona) => ({
        slug: persona.slug,
        label: persona.name,
        summary: persona.description || 'No description available.',
      })));
    } catch {
      return DEFAULT_PERSONAS;
    }
  }

  async function listBootstrap() {
    const personas = await buildPersonaRows();
    const defaultPersona = personas[0]?.slug ?? 'bitcore';
    const defaultModel = DEFAULT_MODELS[0]?.id ?? 'qwen3-235b';
    return Object.freeze({
      source: 'mock',
      feature: Object.freeze({ enabled: true, mode: 'mock', wiring: 'scaffolded' }),
      models: DEFAULT_MODELS,
      personas,
      quickPrompts: DEFAULT_PROMPTS,
      defaults: Object.freeze({
        persona: defaultPersona,
        model: defaultModel,
      }),
      updatedAt: new Date(now()).toISOString(),
    });
  }

  return Object.freeze({
    listBootstrap,
  });
}

export default { createChatWorkbenchService };
