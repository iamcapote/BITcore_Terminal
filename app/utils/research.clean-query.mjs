export function cleanQuery(query) {
  if (typeof query !== 'string') {
    throw new Error('Invalid query: must be a string.');
  }

  // Less aggressive cleaning for API queries - only remove trailing question marks
  // and normalize whitespace
  return query
    .replace(/\s+/g, ' ')        // Normalize multiple spaces to a single space
    .replace(/\?+$/, '')         // Remove trailing question marks
    .trim();                     // Trim leading and trailing spaces
}
