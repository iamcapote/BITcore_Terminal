import { userManager } from '../features/auth/user-manager.mjs';
import { handleCliError, ErrorTypes } from '../utils/cli-error-handler.mjs';

/**
 * Provides help text for the /memory command.
 * @returns {string} Help text.
 */
export function getMemoryHelpText() {
    return `/memory stats - Display statistics about the current memory session (only available within /chat --memory).`;
    // Add help for other potential actions like clear, list, search later
}

/**
 * CLI command for interacting with the memory system.
 * Usage: /memory stats
 */
export async function executeMemory(options = {}, wsOutput, wsError) {
  const { action = 'stats', session } = options; // Default action is stats

  if (!session || !session.memoryManager) {
    const errorMsg = 'Memory mode is not active. Use /chat --memory=true first.';
    if (wsError) {
      wsError(errorMsg);
      // Send keepDisabled false explicitly for WS
      wsOutput({ type: 'output', data: '', keepDisabled: false });
    } else {
      console.error(errorMsg);
    }
    return { success: false, error: errorMsg, handled: true };
  }

  const memoryManager = session.memoryManager;
  const outputFn = wsOutput || console.log;
  const errorFn = wsError || console.error;

  try {
    switch (action) {
      case 'stats':
        const stats = await memoryManager.getStats();
        outputFn('--- Memory Statistics ---');
        outputFn(`Depth Level: ${stats.depthLevel}`);
        outputFn(`Short-Term Count: ${stats.shortTermCount} / ${stats.shortTermCapacity}`);
        outputFn(`Long-Term Count (GitHub): ${stats.longTermCount}`);
        outputFn(`Meta Memory Count (GitHub): ${stats.metaCount}`);
        outputFn(`GitHub Integration: ${stats.githubStatus}`);
        outputFn('-------------------------');
        // Send keepDisabled false explicitly for WS
        if (wsOutput) wsOutput({ type: 'output', data: '', keepDisabled: false });
        return { success: true, stats: stats };
      default:
        const unknownActionMsg = `Unknown memory action: ${action}. Available actions: stats`;
        errorFn(unknownActionMsg);
        if (wsOutput) wsOutput({ type: 'output', data: '', keepDisabled: false });
        return { success: false, error: unknownActionMsg, handled: true };
    }
  } catch (error) {
    const errorResult = handleCliError(
      error,
      ErrorTypes.UNKNOWN,
      { command: `memory ${action}` },
      errorFn
    );
     if (wsOutput) wsOutput({ type: 'output', data: '', keepDisabled: false });
    return { ...errorResult, handled: true };
  }
}
