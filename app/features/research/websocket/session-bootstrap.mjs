/**
 * Why: Centralize the WebSocket session bootstrap so the main connection orchestrator stays lean.
 * What: Creates session state, hydrates persisted data, wires telemetry/log feeds, and delivers the initial welcome payload.
 * How: Builds and registers the session object, attaches activity streams, and emits baseline status via provided helpers.
 * Contract
 *   Inputs:
 *     - ws: WebSocket client connection (open or connecting)
 *     - pushStatusSummary: Function({ validate?: boolean, reason?: string }) => Promise<void>
 *     - activityLogger?: Logger used for GitHub stream diagnostics
 *   Outputs:
 *     - Promise<{ sessionId: string; sessionData: object; telemetryChannel: object }>
 *   Error modes:
 *     - Propagates errors from persistence, telemetry creation, or WebSocket writes so callers can tear down
 *   Performance:
 *     - Expected <150 ms (disk hydration + initial sends); memory footprint bounded by snapshot payload (<50 KB)
 *   Side effects:
 *     - Registers session in registry, sends initial WebSocket messages, attaches log + GitHub streams, updates telemetry map
 */

import crypto from 'crypto';
import { WebSocket } from 'ws';
import { safeSend } from '../../../utils/websocket.utils.mjs';
import { output } from '../../../utils/research.output-manager.mjs';
import { userManager } from '../../auth/user-manager.mjs';
import { ensureResearchTelemetryChannel } from '../research.telemetry.metrics.mjs';
import { createGitHubActivityWebComm } from '../github-activity.webcomm.mjs';
import { logChannel } from '../../../utils/log-channel.mjs';
import { createModuleLogger } from '../../../utils/logger.mjs';
import { cloneUserRecord, enableClientInput } from './client-io.mjs';
import {
  loadSessionState,
  applySessionStateToRef
} from '../../../infrastructure/session/session.store.mjs';
import {
  registerSession
} from './session-registry.mjs';
import config from '../../../config/index.mjs';

const bootstrapLogger = createModuleLogger('research.websocket.bootstrap');

export async function bootstrapSession({ ws, pushStatusSummary, activityLogger }) {
  const sessionId = crypto.randomUUID();
  const current = userManager.getCurrentUser();
  const telemetryKey = current?.username || 'operator';
  const { channel: telemetryChannel, isNew } = ensureResearchTelemetryChannel({
    key: telemetryKey,
    send: (type, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type, data: payload });
      }
    },
    replay: true
  });
  if (!isNew) {
    telemetryChannel.emitStatus({ stage: 'reconnected', message: 'Telemetry channel resumed after reconnect.' });
  }
  const currentUser = cloneUserRecord(current) || null;
  const researchSecurityConfig = config?.security?.research ?? {};
  const csrfTtlMs = Number.isInteger(researchSecurityConfig.csrfTtlMs) && researchSecurityConfig.csrfTtlMs > 0
    ? researchSecurityConfig.csrfTtlMs
    : 15 * 60 * 1000;

  const sessionData = {
    sessionId,
    webSocketClient: ws,
    isChatActive: false,
    chatHistory: [],
    memoryManager: null,
    lastActivity: Date.now(),
    username: current?.username || 'operator',
    role: current?.role || 'admin',
    pendingPromptResolve: null,
    pendingPromptReject: null,
    promptTimeoutId: null,
    promptIsPassword: false,
    promptContext: null,
    promptData: null,
    password: null,
    currentUser,
    currentResearchResult: null,
    currentResearchFilename: null,
    currentResearchSummary: null,
    currentResearchQuery: null,
    sessionModel: null,
    sessionCharacter: null,
    memoryEnabled: false,
    memoryDepth: null,
    memoryGithubEnabled: false,
    researchTelemetry: telemetryChannel,
    githubActivityStream: null,
    githubActivityStreamDisposer: null,
    lastGitHubActivityTimestamp: null,
    csrfToken: crypto.randomBytes(32).toString('hex'),
    csrfIssuedAt: Date.now(),
    csrfExpiresAt: Date.now() + csrfTtlMs
  };

  try {
    const persistedState = await loadSessionState();
    applySessionStateToRef(sessionData, persistedState);
    sessionData.csrfIssuedAt = sessionData.csrfIssuedAt || Date.now();
    sessionData.csrfExpiresAt = sessionData.csrfIssuedAt + csrfTtlMs;
    if (sessionData.currentResearchResult) {
      safeSend(ws, {
        type: 'output',
        data: 'Previous research result restored from last session. Use /export or /storage to continue.'
      });
    }
  } catch (persistError) {
    bootstrapLogger.warn('Failed to hydrate WebSocket session from persisted snapshot.', {
      message: persistError?.message || String(persistError)
    });
  }

  registerSession(sessionId, sessionData, ws);
  bootstrapLogger.info('Created session for new connection.', { sessionId, username: sessionData.username });

  output.addWebSocketClient(ws);

  safeSend(ws, { type: 'connection', connected: true });
  safeSend(ws, { type: 'login_success', username: sessionData.username });
  safeSend(ws, { type: 'output', data: 'Welcome to MCP Terminal!' });
  safeSend(ws, { type: 'output', data: `Single-user mode active as ${sessionData.username} (${sessionData.role}). No login required.` });
  safeSend(ws, { type: 'mode_change', mode: 'command', prompt: '> ' });
  safeSend(ws, { type: 'csrf_token', value: sessionData.csrfToken });

  const initialLogSnapshot = logChannel.getSnapshot({ limit: 120 });
  if (initialLogSnapshot.length) {
    safeSend(ws, { type: 'log-snapshot', logs: initialLogSnapshot });
  }

  const githubLogger = activityLogger ?? bootstrapLogger.child('github-activity');
  const githubActivityStream = createGitHubActivityWebComm({
    send: (eventType, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        safeSend(ws, { type: eventType, data: payload });
      }
    },
    snapshotLimit: 80,
    logger: githubLogger
  });
  githubActivityStream.attach({ limit: 80 });
  sessionData.githubActivityStream = githubActivityStream;
  const disposeListener = githubActivityStream.onEntry((entry) => {
    sessionData.lastGitHubActivityTimestamp = entry?.timestamp ?? Date.now();
  });
  sessionData.githubActivityStreamDisposer = typeof disposeListener === 'function' ? disposeListener : null;

  enableClientInput(ws);
  telemetryChannel.emitStatus({ stage: 'connected', message: 'Research telemetry channel ready.' });

  pushStatusSummary({ reason: 'initial' });
  bootstrapLogger.info('Initial setup complete for session.', { sessionId });

  return { sessionId, sessionData, telemetryChannel };
}
