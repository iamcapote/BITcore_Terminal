/**
 * Why: Normalize research command options before logging so sensitive fields stay redacted.
 * What: Clones the incoming options, masks credentials, and collapses heavyweight references for structured logging.
 * How: Returns a shallow copy with passwords removed and session/WebSocket objects summarized.
 */

export function sanitizeResearchOptionsForLog(options = {}) {
  const copy = { ...options };

  if (copy.password) copy.password = '******';
  if (copy.session) {
    const { sessionId, username } = copy.session;
    copy.session = sessionId || username
      ? `{ sessionId: ${sessionId}, user: ${username}, ... }`
      : '{ session: available }';
  }

  if (copy.currentUser) {
    const masked = { ...copy.currentUser };
    if (masked.passwordHash) masked.passwordHash = '******';
    if (masked.salt) masked.salt = '******';
    if (masked.encryptedApiKeys) masked.encryptedApiKeys = '{...}';
    if (masked.encryptedGitHubToken) masked.encryptedGitHubToken = '******';
    copy.currentUser = masked;
  }

  if ('webSocketClient' in copy) {
    copy.webSocketClient = '[WebSocket Object]';
  }

  return copy;
}
