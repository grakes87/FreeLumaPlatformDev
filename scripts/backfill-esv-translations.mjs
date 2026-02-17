import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
};

const ESV_KEY = '3a13d4d12cd9e9b6a2aec3b46a8d3479d845203e';
const BASE_DELAY_MS = 500; // 2 req/sec baseline
const MAX_RETRIES = 5;

function buildEsvUrl(reference) {
  const params = new URLSearchParams({
    q: reference,
    'include-passage-references': 'false',
    'include-verse-numbers': 'false',
    'include-first-verse-numbers': 'false',
    'include-footnotes': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
  });
  return `https://api.esv.org/v3/passage/text/?${params}`;
}

function parseEsvResponse(data) {
  if (!data?.passages || !Array.isArray(data.passages)) return null;
  const text = data.passages.join(' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, headers, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.ok) return res;

    if (res.status === 429) {
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      const backoff = Math.pow(2, attempt + 1) * 1000;
      if (attempt < retries) {
        process.stderr.write(`  429 — backing off ${backoff / 1000}s...\r`);
        await sleep(backoff);
        continue;
      }
    }

    // Non-429 error or retries exhausted
    return res;
  }
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  const [verses] = await conn.query(
    'SELECT id, verse_reference FROM verse_category_content ORDER BY id'
  );
  console.log(`Total verses: ${verses.length}`);

  const [existing] = await conn.query(
    "SELECT verse_category_content_id FROM verse_category_content_translations WHERE translation_code = 'ESV'"
  );
  const existingSet = new Set(existing.map((r) => r.verse_category_content_id));
  console.log(`Already have ESV: ${existingSet.size}`);

  const toFetch = verses.filter((v) => !existingSet.has(v.id));
  console.log(`Need to fetch: ${toFetch.length}\n`);

  if (toFetch.length === 0) {
    console.log('Nothing to do!');
    await conn.end();
    return;
  }

  let inserted = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < toFetch.length; i++) {
    const verse = toFetch[i];

    try {
      const url = buildEsvUrl(verse.verse_reference);
      const res = await fetchWithRetry(url, { Authorization: `Token ${ESV_KEY}` });

      if (!res.ok) {
        console.error(`  [${i + 1}] HTTP ${res.status} for "${verse.verse_reference}"`);
        failed++;
        await sleep(BASE_DELAY_MS);
        continue;
      }

      const data = await res.json();
      const text = parseEsvResponse(data);

      if (!text) {
        console.error(`  [${i + 1}] Empty response for "${verse.verse_reference}"`);
        failed++;
        await sleep(BASE_DELAY_MS);
        continue;
      }

      await conn.query(
        `INSERT IGNORE INTO verse_category_content_translations
         (verse_category_content_id, translation_code, translated_text, source, created_at, updated_at)
         VALUES (?, 'ESV', ?, 'api', NOW(), NOW())`,
        [verse.id, text]
      );
      inserted++;
    } catch (err) {
      console.error(`  [${i + 1}] Error for "${verse.verse_reference}":`, err.message);
      failed++;
    }

    // Progress every 100
    if ((i + 1) % 100 === 0 || i === toFetch.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = inserted > 0 ? (inserted / ((Date.now() - startTime) / 1000)).toFixed(1) : '0';
      console.log(
        `  Progress: ${i + 1}/${toFetch.length} | Inserted: ${inserted} | Failed: ${failed} | ${elapsed}s elapsed (${rate}/s)`
      );
    }

    await sleep(BASE_DELAY_MS);
  }

  console.log(`\nDone! Inserted: ${inserted} | Failed: ${failed}`);
  await conn.end();
}

main().catch(console.error);
