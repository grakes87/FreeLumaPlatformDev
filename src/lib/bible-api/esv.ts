/**
 * ESV API client — fetches verse/chapter text from api.esv.org
 *
 * Uses the ESV_KEY environment variable for authentication.
 * API docs: https://api.esv.org/docs/passage-text/
 */

function buildEsvApiUrl(reference: string, type: 'verse' | 'chapter' = 'verse'): string {
  let q = reference;

  // For chapter requests, expand to full chapter range (e.g., "John 3" → "John 3:1-999")
  if (type === 'chapter') {
    const parsed = reference.match(/^(.+?)\s+(\d+)(?::.*)?$/);
    if (parsed) {
      q = `${parsed[1]} ${parsed[2]}:1-999`;
    }
  }

  const params = new URLSearchParams({
    q,
    'include-passage-references': 'false',
    'include-verse-numbers': 'false',
    'include-first-verse-numbers': 'false',
    'include-footnotes': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
  });

  return `https://api.esv.org/v3/passage/text/?${params.toString()}`;
}

function parseEsvResponse(data: unknown): string | null {
  if (
    !data ||
    typeof data !== 'object' ||
    !('passages' in data) ||
    !Array.isArray((data as Record<string, unknown>).passages)
  ) {
    return null;
  }

  const passages = (data as { passages: string[] }).passages;
  const text = passages.join(' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

/**
 * Fetch a verse or chapter from the ESV API.
 *
 * @param reference - Human-readable reference (e.g., "John 3:16" or "Psalm 23")
 * @param type - 'verse' for a single verse/range, 'chapter' for full chapter
 * @returns The passage text, or null if unavailable
 */
export async function fetchFromEsvApi(
  reference: string,
  type: 'verse' | 'chapter' = 'verse'
): Promise<string | null> {
  const apiKey = process.env.ESV_KEY;

  if (!apiKey) {
    console.warn('[esv-api] ESV_KEY not set, skipping ESV fetch');
    return null;
  }

  const url = buildEsvApiUrl(reference, type);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`[esv-api] API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return parseEsvResponse(data);
  } catch (error) {
    console.error('[esv-api] Fetch error:', error);
    return null;
  }
}
