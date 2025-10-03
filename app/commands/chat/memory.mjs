/**
 * Why: Encapsulate memory finalisation logic triggered by `/chat` commands.
 * What: Provides the `exitMemory` command handler used by CLI and WebSocket flows.
 * How: Exports a single function that validates session state, summarises memories, and emits output.
 */

import { output as outputManagerInstance } from '../../utils/research.output-manager.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
const moduleLogger = createModuleLogger('commands.chat.memory');


/**
 * Contract
 * Inputs:
 *   - options: {
 *       session?: {
 *         memoryManager?: {
 *           summarizeAndFinalize: Function;
 *         };
 *         chatHistory?: Array<{ role: string; content: string }>;
 *         sessionId?: string;
 *       };
 *       output?: (line: string | object) => void;
 *       error?: (line: string | object) => void;
 *       isWebSocket?: boolean;
 *     }
 * Outputs:
 *   - Promise<{ success: boolean; handled?: boolean; keepDisabled: boolean; commitSha?: string; error?: string }>
 * Error modes:
 *   - Missing memory manager: handled response with user-facing error.
 *   - Finalisation failure: returns handled error and keeps input enabled.
 * Performance:
 *   - time: depends on summarisation/commit operations; memory bounded by chat history size.
 * Side effects:
 *   - Mutates session.memoryManager to null after finalisation attempt.
 */
export async function exitMemory(options = {}) {
  const { session, output: outputFn, error: errorFn } = options;

  const effectiveOutput = typeof outputFn === 'function' ? outputFn : outputManagerInstance.log;
  const effectiveError = typeof errorFn === 'function' ? errorFn : outputManagerInstance.error;

  const memoryManager = session?.memoryManager;
  const chatHistory = session?.chatHistory || [];

  if (!memoryManager) {
    effectiveError('Memory mode is not enabled. Cannot finalize memories.');
    if (options.isWebSocket) {
      return { success: false, error: 'Memory mode not enabled', handled: true, keepDisabled: false };
    }
    return { success: false, error: 'Memory mode not enabled', handled: true, keepDisabled: false };
  }

  effectiveOutput('Finalizing memories...');
  try {
    const conversationText = chatHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const finalizationResult = await memoryManager.summarizeAndFinalize(conversationText);
    let commitSha = null;
    if (finalizationResult && finalizationResult.success && finalizationResult.summary && finalizationResult.summary.commitSha) {
      commitSha = finalizationResult.summary.commitSha;
    } else if (finalizationResult && finalizationResult.commitSha) {
      commitSha = finalizationResult.commitSha;
    }

    effectiveOutput('Memory finalization complete.');
    if (commitSha) {
      effectiveOutput(`Memories committed to GitHub. Commit SHA: ${commitSha}`);
      return { success: true, commitSha, keepDisabled: false };
    }

    effectiveOutput('Memory finalized (local storage or GitHub commit failed/disabled).');
    return { success: true, keepDisabled: false };
  } catch (error) {
    effectiveError(`Error during memory finalization: ${error.message}`);
    return { success: false, error: error.message, handled: true, keepDisabled: false };
  } finally {
    if (session) {
      session.memoryManager = null;
        if (session.sessionId) {
        moduleLogger.debug(`Removed memory manager after exitMemory for session ${session.sessionId}.`);
      }
    }
  }
}
