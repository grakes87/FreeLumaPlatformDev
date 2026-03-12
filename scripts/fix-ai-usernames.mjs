/**
 * Fix AI-seeded user usernames to look like real users.
 *
 * Replaces spammy `fl_user_123`, `fl_zara_wil456`, `fl_grace_t` patterns
 * with natural-looking usernames derived from display names.
 *
 * Patterns: zarawilliams, zara.williams, zara_w, zaraw23, etc.
 *
 * Usage: node scripts/fix-ai-usernames.mjs [--dry-run]
 * Target: production DB via SSH tunnel on port 3307
 */

import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  user: 'freeluma_app',
  password: 'FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1',
  database: 'freeluma_prod',
};

const BATCH_SIZE = 200;

// Username generation styles
const STYLES = [
  'firstlast',      // zarawilliams
  'first.last',     // zara.williams
  'first_last',     // zara_williams
  'firstLnum',      // zaraw23
  'fLast',          // zwilliams
  'firstnum',       // zara23
  'first.l',        // zara.w
  'first_l',        // zara_w
  'firstlastnum',   // zarawilliams3
  'Lfirst',         // williamszara
  'firstL',         // zaraw
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUsername(displayName, usedSet) {
  const parts = displayName.trim().split(/\s+/);
  const first = (parts[0] || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const last = (parts[1] || '').toLowerCase().replace(/[^a-z]/g, '');

  if (!first) return null;

  // Try multiple styles until we find a unique one
  const shuffledStyles = [...STYLES].sort(() => Math.random() - 0.5);

  for (const style of shuffledStyles) {
    let candidate;
    const num = randomInt(1, 99);

    switch (style) {
      case 'firstlast':
        candidate = `${first}${last}`;
        break;
      case 'first.last':
        candidate = last ? `${first}.${last}` : `${first}.${num}`;
        break;
      case 'first_last':
        candidate = last ? `${first}_${last}` : `${first}_${num}`;
        break;
      case 'firstL':
        candidate = last ? `${first}${last[0]}` : `${first}${num}`;
        break;
      case 'firstLnum':
        candidate = last ? `${first}${last[0]}${num}` : `${first}${num}`;
        break;
      case 'fLast':
        candidate = last ? `${first[0]}${last}` : `${first[0]}${num}`;
        break;
      case 'firstnum':
        candidate = `${first}${num}`;
        break;
      case 'first.l':
        candidate = last ? `${first}.${last[0]}` : `${first}.${num}`;
        break;
      case 'first_l':
        candidate = last ? `${first}_${last[0]}` : `${first}_${num}`;
        break;
      case 'firstlastnum':
        candidate = last ? `${first}${last}${num}` : `${first}${num}`;
        break;
      case 'Lfirst':
        candidate = last ? `${last}${first}` : `${first}${num}`;
        break;
      default:
        candidate = `${first}${num}`;
    }

    // Ensure length constraints (3-30 chars)
    if (candidate.length < 3) candidate = `${candidate}${randomInt(10, 99)}`;
    if (candidate.length > 30) candidate = candidate.slice(0, 30);

    if (!usedSet.has(candidate.toLowerCase())) {
      usedSet.add(candidate.toLowerCase());
      return candidate;
    }
  }

  // Fallback: append random numbers
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = `${first}${last ? last[0] : ''}${randomInt(1, 9999)}`;
    if (!usedSet.has(candidate.toLowerCase()) && candidate.length >= 3 && candidate.length <= 30) {
      usedSet.add(candidate.toLowerCase());
      return candidate;
    }
  }

  return null;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const conn = await mysql.createConnection(DB_CONFIG);

  console.log(`=== FIX AI USERNAMES ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // Find all AI users by email domain
  const [aiUsers] = await conn.query(
    `SELECT id, username, display_name, email FROM users
     WHERE email LIKE '%@ai-seed.freeluma.internal'
     ORDER BY id`
  );

  console.log(`Found ${aiUsers.length} AI users to update.\n`);

  if (aiUsers.length === 0) {
    await conn.end();
    return;
  }

  // Get ALL existing usernames to avoid collisions (case-insensitive)
  const [allRows] = await conn.query(`SELECT username FROM users`);
  const usedUsernames = new Set(allRows.map((r) => r.username.toLowerCase()));

  const updates = []; // { id, oldUsername, newUsername }
  let skipped = 0;

  for (const user of aiUsers) {
    const newUsername = generateUsername(user.display_name, usedUsernames);
    if (!newUsername) {
      skipped++;
      continue;
    }
    updates.push({ id: user.id, oldUsername: user.username, newUsername });
  }

  console.log(`Generated ${updates.length} new usernames, ${skipped} skipped.\n`);

  // Show samples
  console.log('Sample changes:');
  for (const u of updates.slice(0, 15)) {
    console.log(`  @${u.oldUsername} -> @${u.newUsername}`);
  }
  console.log('  ...\n');

  if (isDryRun) {
    console.log('DRY RUN — no changes made.');
    await conn.end();
    return;
  }

  // Apply updates row-by-row to handle any edge-case collisions gracefully
  console.log(`Applying ${updates.length} username changes...`);
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    for (const u of batch) {
      try {
        await conn.query(
          `UPDATE users SET username = ?, email = ? WHERE id = ?`,
          [u.newUsername, `${u.newUsername}@ai-seed.freeluma.internal`, u.id]
        );
        updated++;
      } catch (err) {
        // On duplicate, try with a number suffix
        try {
          const fallback = `${u.newUsername}${randomInt(100, 999)}`.slice(0, 30);
          await conn.query(
            `UPDATE users SET username = ?, email = ? WHERE id = ?`,
            [fallback, `${fallback}@ai-seed.freeluma.internal`, u.id]
          );
          updated++;
        } catch {
          errors++;
        }
      }
    }

    process.stdout.write(`\r  ${updated + errors}/${updates.length} processed (${errors} errors)`);
  }

  console.log(' ✓');
  console.log(`\n=== DONE: ${updated} updated, ${errors} errors ===`);

  await conn.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
