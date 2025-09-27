/**
 * Contract
 * Inputs:
 *   - fetchMemoryIntelligence(options)
 *       • options.query: string research query used to sample memory intelligence.
 *       • options.memoryService: MemoryService instance exposing recall() and stats().
 *       • options.user?: authenticated user object with at least { username }.
 *       • options.fallbackUsername?: string used when user.username is unavailable.
 *       • options.limit?: maximum number of records to return (default 5).
 *       • options.logger?: optional debug logger (string => void).
 *   - deriveMemoryFollowUpQueries({ baseQuery, memoryContext, maxQueries })
 * Outputs:
 *   - fetchMemoryIntelligence → Frozen object { query, records[], stats?, telemetryPayload? }.
 *   - deriveMemoryFollowUpQueries → Array of follow-up query objects { original, metadata }.
 * Error modes:
 *   - fetchMemoryIntelligence throws when memoryService missing or user context cannot be resolved.
 *   - deriveMemoryFollowUpQueries returns [] when inputs are invalid.
 * Performance:
 *   - O(n) over limited memory records (n ≤ limit). Single pass normalization; no additional IO.
 * Side effects:
 *   - Delegates to provided memoryService for recall/stats.
 */

const DEFAULT_RECORD_LIMIT = 5;
const MAX_FOLLOW_UP_QUERIES = 6;
const MAX_TELEMETRY_SUGGESTIONS = 6;

export async function fetchMemoryIntelligence({
  query,
  memoryService,
  user,
  fallbackUsername,
  limit = DEFAULT_RECORD_LIMIT,
  logger
} = {}) {
  if (!memoryService) {
    throw new Error('Memory service is required to fetch intelligence.');
  }

  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  if (!trimmedQuery) {
    return Object.freeze({
      query: '',
      records: Object.freeze([]),
      stats: null,
      telemetryPayload: null
    });
  }

  const resolvedUser = resolveMemoryUser(user, fallbackUsername);
  const memoryOptions = resolvedUser ? { user: resolvedUser } : {};
  const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_RECORD_LIMIT;

  const [rawRecords, statsSnapshot] = await Promise.all([
    memoryService.recall({
      query: trimmedQuery,
      limit: effectiveLimit,
      includeShortTerm: true,
      includeLongTerm: true,
      includeMeta: false
    }, memoryOptions),
    memoryService.stats(memoryOptions)
  ]);

  const normalizedRecords = Array.isArray(rawRecords)
    ? rawRecords
        .slice(0, effectiveLimit)
        .map(normalizeMemoryRecord)
        .filter(Boolean)
    : [];

  const frozenRecords = Object.freeze(normalizedRecords.map((record) => Object.freeze(record)));
  const normalizedStats = normalizeMemoryStats(statsSnapshot?.totals);
  const frozenStats = normalizedStats ? Object.freeze(normalizedStats) : null;

  if (typeof logger === 'function') {
    logger(`[MemoryIntelligence] Retrieved ${frozenRecords.length} record(s) for "${trimmedQuery}".`);
  }

  return Object.freeze({
    query: trimmedQuery,
    records: frozenRecords,
    stats: frozenStats,
    telemetryPayload: Object.freeze({
      query: trimmedQuery,
      records: frozenRecords,
      stats: frozenStats
    })
  });
}

export function deriveMemoryFollowUpQueries({ baseQuery, memoryContext, maxQueries = 4 } = {}) {
  const rootQuery = typeof baseQuery === 'string' ? baseQuery.trim() : '';
  const records = memoryContext?.records;

  if (!rootQuery || !Array.isArray(records) || records.length === 0) {
    return [];
  }

  const limit = Math.min(
    MAX_FOLLOW_UP_QUERIES,
    Math.max(1, Number.isInteger(maxQueries) && maxQueries > 0 ? maxQueries : 4)
  );

  const sanitizedRoot = truncateText(rootQuery, 180);
  const seen = new Set();
  const followUps = [];

  for (const record of records) {
    const subject = typeof record.preview === 'string' ? record.preview.trim() : '';
    if (!subject) continue;

    const dedupeKey = subject.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const subjectSnippet = truncateText(subject, 140);
    const primaryTag = Array.isArray(record.tags) && record.tags.length ? record.tags[0] : null;
    const focusLabel = primaryTag || (record.layer ? record.layer.toLowerCase() : 'this topic');

    const question = buildQuestion(subjectSnippet, sanitizedRoot, focusLabel, followUps.length);
    const constrainedQuestion = truncateText(question, 240);

    followUps.push({
      original: constrainedQuestion,
      metadata: {
        source: 'memory',
        memoryId: record.id ?? null,
        layer: record.layer ?? null,
        tags: Array.isArray(record.tags) ? [...record.tags] : [],
        baseQuery: sanitizedRoot,
        focus: focusLabel,
        score: typeof record.score === 'number' ? record.score : null
      }
    });

    if (followUps.length >= limit) {
      break;
    }
  }

  return followUps;
}

export function projectMemorySuggestions(followUps) {
  if (!Array.isArray(followUps) || followUps.length === 0) {
    return [];
  }

  const suggestions = [];
  for (const entry of followUps) {
    if (!entry || typeof entry !== 'object') continue;
    const prompt = typeof entry.original === 'string' ? truncateText(entry.original, 220) : null;
    if (!prompt) continue;

    const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
    const focus = typeof metadata.focus === 'string' && metadata.focus.trim()
      ? truncateText(metadata.focus, 80)
      : null;
    const layer = typeof metadata.layer === 'string' && metadata.layer
      ? String(metadata.layer).slice(0, 60)
      : null;
    const memoryId = metadata.memoryId ? String(metadata.memoryId).slice(0, 80) : null;
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
          .slice(0, 3)
      : [];
    const score = typeof metadata.score === 'number' ? clampScore(metadata.score) : null;

    suggestions.push({
      prompt,
      focus,
      layer,
      memoryId,
      tags,
      score
    });

    if (suggestions.length >= MAX_TELEMETRY_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}

function buildQuestion(subjectSnippet, rootQuery, focusLabel, index) {
  const isEven = index % 2 === 0;
  if (isEven) {
    return `How does "${subjectSnippet}" impact ${focusLabel} for ${rootQuery}?`;
  }
  return `What recent insights about "${subjectSnippet}" matter for ${rootQuery}?`;
}

function resolveMemoryUser(candidate, fallbackUsername) {
  if (candidate && typeof candidate === 'object' && candidate.username) {
    return candidate;
  }
  if (typeof fallbackUsername === 'string' && fallbackUsername.trim()) {
    return { username: fallbackUsername.trim() };
  }
  throw new Error('Memory intelligence requires a user context with a username.');
}

function normalizeMemoryRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const previewSource = getPreviewSource(record);
  if (!previewSource) {
    return null;
  }

  const tags = Array.isArray(record.tags)
    ? record.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const normalizedScore = clampScore(record.score);
  const normalizedTimestamp = normalizeTimestamp(record.timestamp);
  const source = resolveSource(record);

  return {
    id: record.id ? String(record.id).slice(0, 80) : null,
    layer: record.layer ? String(record.layer) : null,
    preview: truncateText(previewSource, 260),
    tags,
    source,
    score: normalizedScore,
    timestamp: normalizedTimestamp
  };
}

function getPreviewSource(record) {
  if (typeof record.preview === 'string' && record.preview.trim()) {
    return record.preview.trim();
  }
  if (typeof record.content === 'string' && record.content.trim()) {
    return record.content.trim();
  }
  return null;
}

function resolveSource(record) {
  if (record.metadata && typeof record.metadata === 'object' && record.metadata.source) {
    return truncateText(String(record.metadata.source), 120);
  }
  if (record.source) {
    return truncateText(String(record.source), 120);
  }
  return null;
}

function normalizeMemoryStats(totals) {
  if (!totals || typeof totals !== 'object') {
    return null;
  }
  return {
    stored: coerceCount(totals.stored),
    retrieved: coerceCount(totals.retrieved),
    validated: coerceCount(totals.validated),
    summarized: coerceCount(totals.summarized),
    ephemeralCount: coerceCount(totals.ephemeralCount),
    validatedCount: coerceCount(totals.validatedCount)
  };
}

function coerceCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.round(num);
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, num));
  return Number.isNaN(clamped) ? null : clamped;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function truncateText(text, maxLength = 200) {
  if (typeof text !== 'string') {
    return '';
  }
  const trimmed = text.trim();
  if (!maxLength || trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}

export const memoryIntelligenceInternal = Object.freeze({
  resolveMemoryUser,
  normalizeMemoryRecord,
  normalizeMemoryStats,
  truncateText,
  projectMemorySuggestions
});
