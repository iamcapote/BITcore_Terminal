/**
 * Contract
 * Inputs:
 *   - Prompt identifiers (string) sourced from user input, CLI flags, or stored files.
 *   - Prompt definition payloads { id?: string, title: string, body: string, description?: string, tags?: string[]|string, metadata?: object }.
 * Outputs:
 *   - Normalized prompt records { id, title, body, description, tags, metadata, version, createdAt, updatedAt } frozen for immutability.
 * Error modes:
 *   - RangeError for invalid identifiers, Error for missing required fields, TypeError for malformed metadata.
 * Performance:
 *   - Pure synchronous guards; <1ms per normalization.
 * Side effects:
 *   - None.
 */

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 400;
const DEFAULT_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizePromptId(idLike) {
  if (idLike == null) {
    throw new RangeError('Prompt id is required.');
  }
  const trimmed = String(idLike).trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  if (!slug || !ID_PATTERN.test(slug)) {
    throw new RangeError(`Invalid prompt id "${idLike}". Use lowercase letters, numbers, and hyphens.`);
  }
  return slug;
}

function normalizeTags(tagsLike) {
  if (tagsLike == null) {
    return Object.freeze([]);
  }
  const tagsArray = Array.isArray(tagsLike)
    ? tagsLike
    : String(tagsLike)
        .split(',')
        .map((value) => value.trim());

  const normalized = Array.from(
    new Set(
      tagsArray
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  return Object.freeze(normalized);
}

function normalizeMetadata(metadataLike) {
  if (metadataLike == null) {
    return Object.freeze({});
  }
  if (!isPlainObject(metadataLike)) {
    throw new TypeError('Prompt metadata must be a plain object when provided.');
  }
  return Object.freeze({ ...metadataLike });
}

export function normalizePromptDefinition(input, { now = () => new Date() } = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('Prompt definition must be an object.');
  }

  const id = normalizePromptId(input.id ?? input.title);

  const title = String(input.title ?? '').trim();
  if (!title) {
    throw new Error('Prompt title is required.');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new RangeError(`Prompt title exceeds ${MAX_TITLE_LENGTH} characters.`);
  }

  const body = String(input.body ?? '').trim();
  if (!body) {
    throw new Error('Prompt body is required.');
  }

  const description = input.description == null ? '' : String(input.description).trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new RangeError(`Prompt description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  const tags = normalizeTags(input.tags);
  const metadata = normalizeMetadata(input.metadata);

  const version = Number.isInteger(input.version) && input.version > 0 ? input.version : DEFAULT_VERSION;
  const createdAt = input.createdAt ? new Date(input.createdAt).toISOString() : now().toISOString();
  const updatedAt = input.updatedAt ? new Date(input.updatedAt).toISOString() : createdAt;

  return Object.freeze({
    id,
    title,
    body,
    description,
    tags,
    metadata,
    version,
    createdAt,
    updatedAt
  });
}

export function nextVersion(current) {
  const base = Number.isInteger(current) && current > 0 ? current : DEFAULT_VERSION;
  return base + 1;
}

export function stampUpdate(record, { now = () => new Date() } = {}) {
  if (!isPlainObject(record)) {
    throw new TypeError('Prompt record must be an object.');
  }
  return Object.freeze({
    ...record,
    version: nextVersion(record.version),
    updatedAt: now().toISOString()
  });
}
