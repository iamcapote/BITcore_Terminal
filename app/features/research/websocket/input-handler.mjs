/**
 * Contract
 * Why: Resolve server-originated prompts and post-research actions for WebSocket sessions.
 * What: Consumes client input events, maps contextual workflows (downloads/uploads/etc.), and manages prompt lifecycle state.
 * How: Coordinates session bookkeeping, emits structured responses, and delegates to GitHub sync controllers when required.
 */

import { safeSend } from '../../../utils/websocket.utils.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { getGitHubResearchSyncController } from '../research.github-sync.controller.mjs';
import { wsErrorHelper, wsOutputHelper } from './client-io.mjs';

const inputLogger = createModuleLogger('research.websocket.input-handler');

export async function handleInputMessage(ws, message, session) {
  const inputValue = message.value;
  let enableInputAfter = false;
  session.lastActivity = Date.now();

  inputLogger.debug('Processing input response.', {
    sessionId: session.sessionId,
    promptPending: Boolean(session.pendingPromptResolve),
    isPassword: session.promptIsPassword,
    valuePreview: session.promptIsPassword ? '******' : inputValue
  });

  if (!session.pendingPromptResolve) {
    inputLogger.warn('Received input when no prompt was pending.', {
      sessionId: session.sessionId,
      valuePreview: inputValue
    });
    wsErrorHelper(ws, 'Received unexpected input. No prompt was active.', true);
    return false;
  }

  inputLogger.debug('Handling input message.', {
    sessionId: session.sessionId,
    pendingPrompt: Boolean(session.pendingPromptResolve),
    context: session.promptContext,
    isPassword: session.promptIsPassword,
    valuePreview: session.promptIsPassword ? '******' : inputValue
  });

  const resolve = session.pendingPromptResolve;
  const reject = session.pendingPromptReject;
  const context = session.promptContext;
  const promptIsPassword = session.promptIsPassword;
  const promptData = session.promptData;

  clearTimeout(session.promptTimeoutId);
  session.pendingPromptResolve = null;
  session.pendingPromptReject = null;
  session.promptTimeoutId = null;
  session.promptIsPassword = false;
  session.promptContext = null;
  session.promptData = null;

  if (context === 'post_research_action') {
    inputLogger.info('Handling post-research action input.', {
      sessionId: session.sessionId,
      action: inputValue
    });
    const action = inputValue.toLowerCase().trim();
    const markdownContent = session.currentResearchResult;
    const suggestedFilename = promptData?.suggestedFilename || session.currentResearchFilename || 'research-result.md';

    if (!markdownContent) {
      wsErrorHelper(ws, 'No research result is available for post-research actions. Please rerun /research to generate content.', true);
      return true;
    }

    try {
      switch (action) {
        case 'download':
          wsOutputHelper(ws, 'Preparing download...');
          safeSend(ws, {
            type: 'download_file',
            filename: suggestedFilename,
            content: markdownContent,
          });
          enableInputAfter = true;
          break;
        case 'upload': {
          wsOutputHelper(ws, 'Attempting to upload to GitHub...');
          enableInputAfter = false;
          const repoPath = suggestedFilename;
          const commitMessage = `Research results for query: ${session.currentResearchQuery || 'Unknown Query'}`;
          const controller = getGitHubResearchSyncController();
          const { summary } = await controller.uploadFile({
            path: repoPath,
            content: markdownContent,
            message: commitMessage,
          });
          wsOutputHelper(ws, 'Upload successful!');
          if (summary?.commitUrl) {
            wsOutputHelper(ws, `Commit: ${summary.commitUrl}`);
          }
          if (summary?.fileUrl) {
            wsOutputHelper(ws, `File: ${summary.fileUrl}`);
          }
          enableInputAfter = true;
          break;
        }
        case 'keep':
          wsOutputHelper(ws, 'Research result kept in session (will be lost on disconnect/logout).');
          enableInputAfter = true;
          break;
        case 'discard':
          wsOutputHelper(ws, 'Research result discarded.');
          enableInputAfter = true;
          break;
        default:
          wsOutputHelper(ws, `Invalid action: '${action}'. Please choose Download, Upload, Keep, or Discard.`);
          enableInputAfter = true;
          break;
      }
    } catch (actionError) {
      inputLogger.error('Error during post-research action.', {
        sessionId: session.sessionId,
        action,
        error: actionError
      });
      wsErrorHelper(ws, `Error performing action '${action}': ${actionError.message}`, true);
      enableInputAfter = false;
      if (action === 'upload' && actionError.message.toLowerCase().includes('password')) {
        session.password = null;
      }
    } finally {
      if (action === 'download' || action === 'upload' || action === 'discard') {
        session.currentResearchResult = null;
        session.currentResearchFilename = null;
        delete session.currentResearchQuery;
      }
    }
  } else if (context === 'github_token_password') {
    resolve(inputValue);
    enableInputAfter = true;
  } else {
    inputLogger.debug('Resolving standard prompt.', {
      sessionId: session.sessionId,
      context: context || 'none',
      isPassword: promptIsPassword
    });
    resolve(inputValue);
    enableInputAfter = false;
  }

  inputLogger.debug('Completed handleInputMessage.', {
    sessionId: session.sessionId,
    enableInputAfter
  });
  return enableInputAfter;
}
