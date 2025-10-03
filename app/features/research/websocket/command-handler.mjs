/**
 * Contract
 * Why: Execute top-level terminal commands received over the research WebSocket.
 * What: Parses slash-commands, prepares option payloads, delegates to command modules, and manages client input state.
 * How: Uses shared IO helpers for structured messaging, enriches options with session context, and propagates telemetry hooks for research flows.
 */

import { WebSocket } from 'ws';
import { commands, parseCommandArgs } from '../../../commands/index.mjs';
import { outputManager } from '../../../utils/research.output-manager.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { userManager } from '../../auth/user-manager.mjs';
import { cloneUserRecord, wsErrorHelper, wsOutputHelper } from './client-io.mjs';
import { wsPrompt } from './prompt.mjs';

const commandLogger = createModuleLogger('research.websocket.command-handler');
const sessionLogger = commandLogger.child('session');
const executionLogger = commandLogger.child('execution');
const debugLogger = commandLogger.child('debug');

export async function handleCommandMessage(ws, message, session) {
  const fullCommandString = `/${message.command} ${message.args.join(' ')}`;
  const { commandName, positionalArgs, flags } = parseCommandArgs(fullCommandString);
  const passwordFromPayload = message.password;

  let effectiveModel = null;
  let effectiveCharacter = null;

  outputManager.debug(`[$handleCommandMessage] Parsed: name='${commandName}', args=${JSON.stringify(positionalArgs)}, flags=${JSON.stringify(flags)}`);

  if (!commandName) {
    wsErrorHelper(ws, 'Invalid command format.', true);
    return false;
  }

  const commandFunction = commands[commandName];
  if (typeof commandFunction !== 'function') {
    wsErrorHelper(ws, `Unknown command: /${commandName}. Type /help for available commands.`, true);
    return false;
  }

  const payloadPassword = typeof passwordFromPayload === 'string' && passwordFromPayload.trim().length > 0
    ? passwordFromPayload
    : null;
  if (payloadPassword) {
    session.password = payloadPassword;
  }
  const effectivePassword = payloadPassword ?? session.password ?? null;

  if (!session.currentUser) {
    try {
      const resolvedUser = userManager.getCurrentUser?.();
      const clonedUser = cloneUserRecord(resolvedUser);
      if (clonedUser) {
        session.currentUser = clonedUser;
      }
    } catch (userResolveError) {
      sessionLogger.warn('Failed to hydrate session user for command.', {
        commandName,
        sessionId: session.sessionId,
        error: userResolveError
      });
    }
  }
  const sessionUser = session.currentUser ?? null;

  if (session.isChatActive && commandName !== 'help') {
    executionLogger.warn('Attempted to run top-level command while chat is active.', {
      commandName,
      sessionId: session.sessionId
    });
    wsErrorHelper(ws, 'Cannot run top-level commands while in chat mode. Use chat messages or in-chat commands (e.g., /exit).', true);
    return false;
  }

  let enableInputAfter = true;

  const newModelFlag = flags.m;
  const newCharacterFlag = flags.c;

  if (commandName === 'chat' || commandName === 'research') {
    if (newModelFlag) {
      if (session.sessionModel === null) {
        session.sessionModel = newModelFlag;
        outputManager.debug(`[WebSocket] Session ${session.sessionId} model set by flag to: ${session.sessionModel}`);
        wsOutputHelper(ws, `Session model set to: ${session.sessionModel}`);
      } else if (session.sessionModel !== newModelFlag) {
        wsOutputHelper(ws, `Info: Model for this session is already set to '${session.sessionModel}'. Flag '--m ${newModelFlag}' ignored.`);
      }
    }
    if (newCharacterFlag) {
      const newCharValue = newCharacterFlag.toLowerCase() === 'none' ? 'None' : newCharacterFlag;
      if (session.sessionCharacter === null) {
        session.sessionCharacter = newCharValue;
        outputManager.debug(`[WebSocket] Session ${session.sessionId} character set by flag to: ${session.sessionCharacter}`);
        wsOutputHelper(ws, `Session character set to: ${session.sessionCharacter === 'None' ? 'None (no character)' : session.sessionCharacter}`);
      } else if (session.sessionCharacter !== newCharValue) {
        wsOutputHelper(ws, `Info: Character for this session is already set to '${session.sessionCharacter}'. Flag '--c ${newCharacterFlag}' ignored.`);
      }
    }
  }

  const defaultModels = {
    chat: 'qwen3-235b',
    research: 'dolphin-2.9.2-qwen2-72b',
  };
  const defaultCharacters = {
    chat: 'bitcore',
    research: 'archon',
  };

  effectiveModel = session.sessionModel;
  effectiveCharacter = session.sessionCharacter;

  if (commandName === 'chat') {
    if (effectiveModel === null) {
      effectiveModel = defaultModels.chat;
      session.sessionModel = effectiveModel;
      wsOutputHelper(ws, `Using default model for chat: ${effectiveModel}`);
    }
    if (effectiveCharacter === null) {
      effectiveCharacter = defaultCharacters.chat;
      session.sessionCharacter = effectiveCharacter;
      wsOutputHelper(ws, `Using default character for chat: ${effectiveCharacter}`);
    }
  } else if (commandName === 'research') {
    if (effectiveModel === null) {
      effectiveModel = defaultModels.research;
      session.sessionModel = effectiveModel;
      wsOutputHelper(ws, `Using default model for research: ${effectiveModel}`);
    }
    if (effectiveCharacter === null) {
      effectiveCharacter = defaultCharacters.research;
      session.sessionCharacter = effectiveCharacter;
      wsOutputHelper(ws, `Using default character for research: ${effectiveCharacter}`);
    }
  }

  if (!effectiveModel && (commandName === 'chat' || commandName === 'research')) {
    effectiveModel = defaultModels[commandName];
    if (session.sessionModel === null) session.sessionModel = effectiveModel;
    outputManager.debug(`[WebSocket] Session ${session.sessionId} model defaulted to: ${effectiveModel} as a fallback.`);
  }

  const options = {
    positionalArgs,
    flags,
    depth: flags.depth || 2,
    breadth: flags.breadth || 3,
    classify: flags.classify || false,
    verbose: flags.verbose || false,
    memory: flags.memory || false,
    output: null,
    error: null,
    model: effectiveModel,
    character: effectiveCharacter === 'None' ? null : effectiveCharacter,
    password: effectivePassword,
    currentUser: sessionUser,
    requestingUser: sessionUser,
  };

  const commandOutput = (data) => {
    if (typeof data === 'object' && data !== null && data.type) {
      safeSend(ws, data);
    } else {
      wsOutputHelper(ws, data);
    }
  };

  const commandError = (data) => {
    executionLogger.error('Command error reported by handler.', {
      commandName,
      sessionId: session.sessionId,
      error: data
    });
    wsErrorHelper(ws, data, true);
    enableInputAfter = false;
  };

  const commandDebug = (data) => {
    if (options.verbose || process.env.DEBUG_MODE === 'true') {
      wsOutputHelper(ws, `[DEBUG] ${data}`);
    }
    if (process.env.DEBUG_MODE === 'true') {
      debugLogger.debug('Command debug event emitted.', {
        commandName,
        sessionId: session.sessionId,
        data
      });
    }
  };

  options.webSocketClient = ws;
  options.isWebSocket = true;
  options.session = session;
  options.wsPrompt = wsPrompt;
  options.output = commandOutput;
  options.error = commandError;
  options.debug = commandDebug;

  try {
    executionLogger.info('Executing command.', {
      commandName,
      sessionId: session.sessionId,
      username: session.username
    });
    executionLogger.debug('Command options summary.', {
      commandName,
      sessionId: session.sessionId,
      positionalArgs,
      flags,
      model: options.model,
      character: options.character,
      verbose: options.verbose,
      memory: options.memory,
      telemetryAttached: Boolean(options.telemetry)
    });

    if (commandName === 'chat') {
      executionLogger.debug('Chat command specific options.', {
        sessionId: session.sessionId,
        model: options.model,
        character: options.character,
        flags
      });
    }

    if (commandName === 'research') {
      const telemetry = session.researchTelemetry;
      if (telemetry) {
        telemetry.updateSender((type, payload) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            safeSend(ws, { type, data: payload });
          }
        });
        telemetry.clearHistory();
        telemetry.emitStatus({ stage: 'preparing', message: 'Preparing research command.' });
        options.telemetry = telemetry;
      }
      if (!options.query || !options.query.trim()) {
        if (typeof wsPrompt !== 'function') {
          executionLogger.error('wsPrompt unavailable for research query prompt.', {
            sessionId: session.sessionId,
          });
          commandError('Research query is missing and the interactive prompt is unavailable.');
          return false;
        }

        try {
          wsOutputHelper(ws, 'Research requires a query. Respond to the prompt to continue.');
          const promptResponse = await wsPrompt(
            ws,
            session,
            'Enter research query:',
            undefined,
            false,
            'research_query'
          );
          const normalizedQuery = typeof promptResponse === 'string' ? promptResponse.trim() : '';

          if (!normalizedQuery) {
            wsErrorHelper(ws, 'Research cancelled: query cannot be empty.', true);
            return true;
          }

          options.query = normalizedQuery;
          options.positionalArgs = [normalizedQuery];
          executionLogger.debug('Research query obtained via prompt.', {
            sessionId: session.sessionId,
            queryPreview: normalizedQuery.substring(0, 120)
          });
        } catch (promptError) {
          executionLogger.warn('Research query prompt failed or was cancelled.', {
            sessionId: session.sessionId,
            error: promptError?.message ?? String(promptError)
          });
          if (!(promptError instanceof Error && promptError.message === 'Prompt timed out.')) {
            wsErrorHelper(ws, `Research cancelled: ${promptError?.message ?? 'Prompt failed.'}`, true);
          }
          return true;
        }
      }
      options.progressHandler = (progressData) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          safeSend(ws, { type: 'progress', data: progressData });
        }
      };
    }

    const result = await commandFunction(options);

    if (result && typeof result === 'object') {
      if (result.user) {
        const updatedUser = cloneUserRecord(result.user);
        if (updatedUser) {
          session.currentUser = updatedUser;
        }
      } else if (result.currentUser) {
        const updatedUser = cloneUserRecord(result.currentUser);
        if (updatedUser) {
          session.currentUser = updatedUser;
        }
      }
    }

    enableInputAfter = true;
    if (typeof result === 'object' && result !== null) {
      if (result.keepDisabled === true) {
        enableInputAfter = false;
      }
      if (result.modeChange) {
        safeSend(ws, { type: 'mode_change', mode: result.modeChange.mode, prompt: result.modeChange.prompt });
      }
      if (result.message) {
        commandOutput(result.message);
      }
    } else if (result === false) {
      enableInputAfter = false;
    }

    if (commandName === 'logout') {
      executionLogger.info('Logout command invoked in single-user mode.', {
        sessionId: session.sessionId
      });
      safeSend(ws, { type: 'logout_success', message: 'Single-user mode: logout is a no-op.' });
      safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
      enableInputAfter = true;
    }

    if (commandName === 'chat') {
      if (result?.success) {
        enableInputAfter = !(result?.keepDisabled === true);
        executionLogger.debug('Chat command succeeded.', {
          sessionId: session.sessionId,
          enableInputAfter
        });
      } else {
        enableInputAfter = false;
        executionLogger.warn('Chat command failed or deferred.', {
          sessionId: session.sessionId,
          enableInputAfter
        });
      }
    }

    if (enableInputAfter === undefined) {
      executionLogger.warn('enableInputAfter was undefined after command; defaulting to true.', {
        commandName,
        sessionId: session.sessionId
      });
      enableInputAfter = true;
    }

    executionLogger.debug('Command handler returning.', {
      commandName,
      sessionId: session.sessionId,
      enableInputAfter
    });
    return enableInputAfter;
  } catch (error) {
    executionLogger.error('Error executing command.', {
      commandName,
      sessionId: session.sessionId,
      error
    });
    commandError(`Internal error executing command /${commandName}: ${error.message}`);
    return false;
  }
}
