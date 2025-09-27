import { getMemoryController } from '../features/memory/index.mjs';
import { DEFAULT_LAYER, normalizeLayer } from '../features/memory/memory.schema.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';

const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthy(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return String(value)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function logJson(outputFn, data) {
  outputFn(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function sendWsAck(wsOutput) {
  if (typeof wsOutput === 'function') {
    wsOutput({ type: 'output', data: '', keepDisabled: false });
  }
}

function formatMemoryRecord(record, index) {
  const header = `[${index + 1}] (${record.layer}) ${record.role} @ ${record.timestamp ?? 'n/a'}`;
  const content = record.content || '[empty]';
  const tags = record.tags?.length ? `Tags: ${record.tags.join(', ')}` : 'Tags: none';
  const metadata = record.metadata && Object.keys(record.metadata).length
    ? `Metadata: ${JSON.stringify(record.metadata)}`
    : 'Metadata: {}';
  const score = record.score != null ? `Score: ${record.score}` : null;
  return [header, content, tags, metadata, score].filter(Boolean);
}

export function getMemoryHelpText() {
  return [
    '/memory stats [--layer=<name>] [--github] [--json]  Show per-layer usage metrics.',
    '/memory recall <query> [--layer=<name>] [--limit=5] [--short-term] [--long-term=false] [--meta=false] [--github] [--json]  Retrieve relevant memories.',
    '/memory store <text> [--layer=<name>] [--role=user] [--tags=a,b] [--source=origin] [--github] [--json]  Persist a new memory.',
    '/memory summarize [--layer=<name>] [--conversation="..."] [--github]  Trigger summarize/finalize pipeline.'
  ].join('\n');
}

export async function executeMemory(options = {}, wsOutput, wsError) {
  const outputFn = typeof wsOutput === 'function' ? wsOutput : console.log;
  const errorFn = typeof wsError === 'function' ? wsError : console.error;

  const positionalArgs = Array.isArray(options.positionalArgs) ? [...options.positionalArgs] : [];
  const flags = options.flags || {};
  const declaredAction = options.action ? String(options.action).toLowerCase() : null;
  const subcommand = declaredAction || (positionalArgs.shift()?.toLowerCase()) || 'stats';

  const layerInput = flags.layer || flags.l || options.layer;
  const hasLayerOverride = layerInput != null && String(layerInput).trim() !== '';
  const layer = hasLayerOverride ? normalizeLayer(layerInput) : DEFAULT_LAYER;
  const jsonOutput = isTruthy(flags.json ?? flags.JSON ?? options.json);
  const githubEnabled = isTruthy(flags.github ?? flags['enable-github'] ?? options.githubEnabled);

  const userContext = options.user || options.currentUser || options?.session?.currentUser || options?.session?.user || null;
  const controller = getMemoryController();

  const contextOptions = {
    user: userContext,
    githubEnabled
  };

  try {
    switch (subcommand) {
      case 'stats': {
  const statsLayer = hasLayerOverride ? layer : undefined;
  const stats = await controller.stats({ ...contextOptions, layer: statsLayer });
        if (jsonOutput) {
          logJson(outputFn, stats);
        } else {
          outputFn('--- Memory Statistics ---');
          stats.layers.forEach(snapshot => {
            outputFn(`Layer: ${snapshot.layer} (depth: ${snapshot.depth})`);
            outputFn(`  Stored: ${snapshot.stored}`);
            outputFn(`  Retrieved: ${snapshot.retrieved}`);
            outputFn(`  Validated: ${snapshot.validated}`);
            outputFn(`  Summarized: ${snapshot.summarized}`);
            outputFn(`  Ephemeral Count: ${snapshot.ephemeralCount}`);
            outputFn(`  Validated Count: ${snapshot.validatedCount}`);
            outputFn(`  GitHub Enabled: ${snapshot.githubEnabled}`);
          });
          outputFn('Totals:');
          outputFn(`  Layers: ${stats.totals.layers}`);
          outputFn(`  Stored: ${stats.totals.stored}`);
          outputFn(`  Retrieved: ${stats.totals.retrieved}`);
          outputFn(`  Validated: ${stats.totals.validated}`);
          outputFn(`  Summarized: ${stats.totals.summarized}`);
        }
        sendWsAck(wsOutput);
        return { success: true, stats };
      }

      case 'recall': {
        const query = options.query || flags.query || positionalArgs.join(' ');
        if (!query || !query.trim()) {
          const errorMsg = 'Memory recall requires a query. Usage: /memory recall <query> [options]';
          errorFn(errorMsg);
          sendWsAck(wsOutput);
          return { success: false, error: errorMsg, handled: true };
        }

        const limit = toInteger(flags.limit ?? flags.top ?? options.limit, undefined);
        const includeShortTerm = flags['short-term'] !== undefined ? isTruthy(flags['short-term']) : true;
        const includeLongTerm = flags['long-term'] !== undefined ? isTruthy(flags['long-term']) : true;
        const includeMeta = flags.meta !== undefined ? isTruthy(flags.meta) : true;

        const recallPayload = {
          query,
          layer,
          limit,
          includeShortTerm,
          includeLongTerm,
          includeMeta
        };

        const memories = await controller.recall(recallPayload, contextOptions);

        if (jsonOutput) {
          logJson(outputFn, memories);
        } else {
          if (!memories.length) {
            outputFn('No matching memories found.');
          } else {
            memories.forEach((record, index) => {
              formatMemoryRecord(record, index).forEach(line => outputFn(line));
              outputFn('');
            });
          }
        }

        sendWsAck(wsOutput);
        return { success: true, memories };
      }

      case 'store': {
        const contentFromFlags = flags.content || options.content;
        const content = contentFromFlags ? String(contentFromFlags) : positionalArgs.join(' ');
        if (!content || !content.trim()) {
          const errorMsg = 'Memory store requires content. Usage: /memory store <text> [options]';
          errorFn(errorMsg);
          sendWsAck(wsOutput);
          return { success: false, error: errorMsg, handled: true };
        }

        const role = flags.role || options.role || 'user';
        const tags = ensureArray(flags.tags ?? flags.tag ?? options.tags);
        const source = flags.source || options.source;
        const metadata = options.metadata && typeof options.metadata === 'object'
          ? options.metadata
          : {};

        const storePayload = {
          content,
          role,
          layer,
          tags,
          source,
          metadata
        };

        const stored = await controller.store(storePayload, contextOptions);

        if (jsonOutput) {
          logJson(outputFn, stored);
        } else {
          outputFn('Memory stored successfully.');
          formatMemoryRecord(stored, 0).forEach(line => outputFn(line));
        }

        sendWsAck(wsOutput);
        return { success: true, record: stored };
      }

      case 'summarize': {
        const conversationText = flags.conversation || options.conversation || positionalArgs.join(' ');
        const result = await controller.summarize({ ...contextOptions, conversationText, layer });

        if (jsonOutput) {
          logJson(outputFn, result);
        } else {
          outputFn('Summarize pipeline invoked.');
          outputFn(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        }

        sendWsAck(wsOutput);
        return { success: true, result };
      }

      default: {
        const errorMsg = `Unknown memory action: ${subcommand}. See /memory help for supported subcommands.`;
        errorFn(errorMsg);
        sendWsAck(wsOutput);
        return { success: false, error: errorMsg, handled: true };
      }
    }
  } catch (error) {
    const errorResult = handleCliError(
      error,
      ErrorTypes.UNKNOWN,
      { command: `memory ${subcommand}` },
      errorFn
    );
    sendWsAck(wsOutput);
    return { ...errorResult, handled: true };
  }
}
