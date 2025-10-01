/**
 * Contract
 * Why: Execute top-level terminal commands received over the research WebSocket.
 * What: Parses slash-commands, prepares option payloads, delegates to command modules, and manages client input state.
 * How: Uses shared IO helpers for structured messaging, enriches options with session context, and propagates telemetry hooks for research flows.
 */

import { WebSocket } from 'ws';
import { commands, parseCommandArgs } from '../../../commands/index.mjs';
import { outputManager } from '../../../utils/research.output-manager.mjs';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { userManager } from '../../auth/user-manager.mjs';
import { cloneUserRecord, wsErrorHelper, wsOutputHelper } from './client-io.mjs';
import { wsPrompt } from './prompt.mjs';

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
      console.warn(`[WebSocket] Failed to hydrate session user for command '/${commandName}' (Session ${session.sessionId}): ${userResolveError.message}`);
    }
  }
  const sessionUser = session.currentUser ?? null;

  if (session.isChatActive && commandName !== 'help') {
    console.warn(`[WebSocket] Attempted to run top-level command '/${commandName}' while chat is active (Session ${session.sessionId}).`);
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
    console.error('[commandError] Received error:', data);
    wsErrorHelper(ws, data, true);
    enableInputAfter = false;
  };

  const commandDebug = (data) => {
    if (options.verbose || process.env.DEBUG_MODE === 'true') {
      wsOutputHelper(ws, `[DEBUG] ${data}`);
    }
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[WS DEBUG][${session.sessionId}] ${data}`);
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
    console.log(`[WebSocket] Executing command /${commandName} for user ${session.username}`);
    outputManager.debug(`[Command Execution] Options for /${commandName}: ${JSON.stringify(options, (key, value) => (key === 'webSocketClient' || key === 'session' || key === 'currentUser' || key === 'requestingUser' || key === 'wsPrompt' || key === 'output' || key === 'error' || key === 'debug' || key === 'password') ? `[${typeof value}]` : value, 2)}`);

    if (commandName === 'chat') {
      console.log('[WebSocket] Options passed to executeChat:', JSON.stringify(options, (key, value) => (key === 'webSocketClient' || key === 'session' || key === 'currentUser' || key === 'requestingUser' || key === 'wsPrompt' || key === 'output' || key === 'error') ? `[Object ${key}]` : value, 2));
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
      if (!options.query) {
        commandError('Research query is missing. Please provide a query or use interactive mode.');
        return false;
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
      console.log('[WebSocket] /logout called in single-user mode. No state change.');
      safeSend(ws, { type: 'logout_success', message: 'Single-user mode: logout is a no-op.' });
      safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
      enableInputAfter = true;
    }

    if (commandName === 'chat') {
      if (result?.success) {
        enableInputAfter = !(result?.keepDisabled === true);
        console.log(`[WebSocket] /chat command succeeded. enableInputAfter=${enableInputAfter}`);
      } else {
        enableInputAfter = false;
        console.log(`[WebSocket] /chat command failed or handled. enableInputAfter=${enableInputAfter}`);
      }
    }

    if (enableInputAfter === undefined) {
      console.warn(`[WebSocket] enableInputAfter was undefined after command /${commandName}. Defaulting to true.`);
      enableInputAfter = true;
    }

    console.log(`[WebSocket] Returning from handleCommandMessage. Final enableInputAfter: ${enableInputAfter}`);
    return enableInputAfter;
  } catch (error) {
    console.error(`[WebSocket] Error executing command /${commandName} (Session ${session.sessionId}):`, error.message, error.stack);
    commandError(`Internal error executing command /${commandName}: ${error.message}`);
    return false;
  }
}
