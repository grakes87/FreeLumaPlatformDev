/**
 * Cursor-based pagination helpers using base64url-encoded JSON.
 *
 * Cursor format: { created_at: ISO string, id: number }
 * This supports keyset pagination ordered by (created_at DESC, id DESC).
 */

/**
 * Encode a record's created_at + id into a cursor string.
 */
export function encodeCursor(record: { created_at: Date | string; id: number }): string {
  const payload = {
    created_at: typeof record.created_at === 'string'
      ? record.created_at
      : record.created_at.toISOString(),
    id: record.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decode a cursor string back into its components.
 * Returns null if the cursor is invalid or malformed.
 */
export function decodeCursor(cursor: string): { created_at: string; id: number } | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);

    if (
      typeof parsed.created_at !== 'string' ||
      typeof parsed.id !== 'number' ||
      !Number.isFinite(parsed.id)
    ) {
      return null;
    }

    return { created_at: parsed.created_at, id: parsed.id };
  } catch {
    return null;
  }
}
