/**
 * Why: Surface security control posture (CSRF, rate limiting, validation ranges) for operators.
 * What: Fetches the status summary, extracts the research security descriptor, and renders it for CLI/Web.
 * How: Uses the shared status controller, formats structured output, and mirrors errors to stderr when present.
 */

import { getStatusController } from '../features/status/index.mjs';
import { createModuleLogger } from '../utils/logger.mjs';

const moduleLogger = createModuleLogger('commands.security.cli', { emitToStdStreams: false });

function createEmitter(handler, level) {
  const fn = typeof handler === 'function' ? handler : null;
  const stream = level === 'error' ? process.stderr : process.stdout;
  return (message, meta = null) => {
    moduleLogger[level](message, meta);
    if (fn) {
      fn(message);
      return;
    }
    stream.write(`${message}\n`);
  };
}

export function getSecurityHelpText() {
  return '/security [status]  Show CSRF, rate limiting, and validation ranges for research surfaces.';
}

export async function executeSecurity(options = {}) {
  const {
    positionalArgs = [],
    output,
    error,
    statusController: injectedController
  } = options;

  const emit = createEmitter(output, 'info');
  const emitError = createEmitter(error ?? output, 'error');

  const requestedAction = (positionalArgs[0] || 'status').toString().trim().toLowerCase() || 'status';
  if (requestedAction !== 'status') {
    emitError(`Unknown security action "${requestedAction}". Try /security status.`);
    return { success: false, error: 'Unknown action', handled: true };
  }

  const controller = injectedController || getStatusController();
  try {
    const summary = await controller.summary();
    const securityStatus = summary?.statuses?.security;
    if (!securityStatus) {
      emitError('Security status is unavailable.');
      return { success: false, error: 'Security status unavailable', handled: true };
    }

    const meta = securityStatus.meta || {};
    emit('=== Research Security ===');
    emit(`State: ${securityStatus.state} - ${securityStatus.message}`);
    emit(`CSRF required (WebSocket): ${meta.csrfRequired ? 'Enabled' : 'Disabled'}`);
    if (meta.csrfTtlMs) {
      emit(`CSRF token TTL: ${meta.csrfTtlMs} ms`);
    }
    if (meta.rateLimit) {
      emit(`Rate limit: ${meta.rateLimit.maxTokens} commands per ${meta.rateLimit.intervalMs} ms`);
    }
    if (meta.depthRange) {
      emit(`Depth range: ${meta.depthRange.min}-${meta.depthRange.max}`);
    }
    if (meta.breadthRange) {
      emit(`Breadth range: ${meta.breadthRange.min}-${meta.breadthRange.max}`);
    }
    if (meta.tokenUsage) {
      const aggregate = meta.tokenUsage.aggregate || {};
      emit('Token usage (aggregate):');
      emit(`  Prompts: ${aggregate.promptTokens ?? 0} tokens`);
      emit(`  Completions: ${aggregate.completionTokens ?? 0} tokens`);
      emit(`  Total: ${aggregate.totalTokens ?? 0} tokens across ${aggregate.events ?? 0} calls`);
      if (aggregate.updatedAt) {
        emit(`  Last updated: ${aggregate.updatedAt}`);
      }
      const perOperator = meta.tokenUsage.perOperator || {};
      const operatorEntries = Object.entries(perOperator);
      if (operatorEntries.length) {
        emit('Token usage by operator:');
        for (const [operator, totals] of operatorEntries) {
          emit(`  ${operator}: prompts=${totals.promptTokens ?? 0}, completions=${totals.completionTokens ?? 0}, total=${totals.totalTokens ?? 0}, calls=${totals.events ?? 0}`);
        }
      }
    }
    return { success: true, status: securityStatus };
  } catch (statusError) {
    emitError(`Failed to load security status: ${statusError.message}`);
    return { success: false, error: statusError.message, handled: true };
  }
}
