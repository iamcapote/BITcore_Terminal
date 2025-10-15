/**
 * Why: Provide shared research archive helpers for CLI and WebSocket flows.
 * What: Lists and retrieves durable research artifacts while formatting output per transport.
 * How: Wraps infrastructure archive helpers, emits structured output, and triggers downloads for Web clients.
 */

import { listResearchArtifacts, getResearchArtifact } from '../../infrastructure/research/research.archive.mjs';
import { createModuleLogger } from '../../utils/logger.mjs';
import { safeSend } from '../../utils/websocket.utils.mjs';

const moduleLogger = createModuleLogger('commands.research.archive-actions', { emitToStdStreams: false });

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

function formatSummaryLine(summary, index) {
  const position = String(index + 1).padStart(2, '0');
  const dateLabel = summary.createdAt ? summary.createdAt : 'unknown date';
  const headline = summary.summary || summary.query || '(no summary)';
  return `${position}. ${summary.id} | ${dateLabel} | ${headline}`;
}

export async function listResearchArchive({ limit, output, error } = {}) {
  const emit = createEmitter(output, 'info');
  const emitError = createEmitter(error ?? output, 'error');
  try {
    const entries = await listResearchArtifacts({ limit });
    if (!entries.length) {
      emit('Research archive is empty. Run /research to generate new entries.');
      return { success: true, entries: [] };
    }
    emit('=== Research Archive ===');
    entries.forEach((entry, idx) => emit(formatSummaryLine(entry, idx)));
    return { success: true, entries };
  } catch (listError) {
    emitError(`Unable to list research archive: ${listError.message}`);
    return { success: false, error: listError.message, handled: true };
  }
}

export async function downloadResearchArchive({ id, output, error, isWebSocket, webSocketClient } = {}) {
  const emit = createEmitter(output, 'info');
  const emitError = createEmitter(error ?? output, 'error');
  if (!id) {
    emitError('Specify the artifact id to download, e.g. /research download <id>.');
    return { success: false, error: 'Missing id', handled: true };
  }
  try {
  const normalizedId = typeof id === 'string' ? id.trim() : id;
  const record = await getResearchArtifact(normalizedId);
    if (isWebSocket && webSocketClient) {
      safeSend(webSocketClient, {
        type: 'download_file',
        filename: record.filename || `${record.id}.md`,
        content: record.content
      });
      emit(`Triggered download for artifact ${record.id}.`);
    } else {
      emit(`--- ${record.filename || record.id}.md ---`);
      emit(record.content);
      emit('--- End Content ---');
    }
    return { success: true, record };
  } catch (downloadError) {
    emitError(`Unable to download research artifact: ${downloadError.message}`);
    return { success: false, error: downloadError.message, handled: true };
  }
}
