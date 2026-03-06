/**
 * Seed 10K AI followers + engagement on @freeluma profile posts.
 *
 * Creates 10,000 AI user accounts that follow @freeluma, react to posts,
 * leave comments, and register impressions (~100K+ total).
 *
 * Usage: node scripts/seed-ai-followers.mjs
 * Cleanup: node scripts/seed-ai-followers.mjs --cleanup
 *
 * Target: production DB (freeluma_prod via 10.0.0.3)
 */

import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: '10.0.0.3',
  user: 'freeluma_app',
  password: 'FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1',
  database: 'freeluma_prod',
};

const BATCH_SIZE = 500;
const TOTAL_USERS = 10000;
const EMAIL_DOMAIN = '@ai-seed.freeluma.internal';

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Grace', 'Marcus', 'Sarah', 'David', 'Olivia', 'Isaiah', 'Hannah', 'Caleb',
  'Naomi', 'Elijah', 'Abigail', 'Joshua', 'Leah', 'Micah', 'Ruth', 'Ethan',
  'Lydia', 'Noah', 'Miriam', 'Samuel', 'Rachel', 'Daniel', 'Faith', 'Luke',
  'Joy', 'Aaron', 'Hope', 'Nathan', 'Esther', 'Timothy', 'Charity', 'Peter',
  'Rebecca', 'James', 'Elizabeth', 'Andrew', 'Mary', 'Benjamin', 'Anna',
  'Stephen', 'Martha', 'Joseph', 'Priscilla', 'Jonathan', 'Eve', 'Matthew',
  'Deborah', 'Philip', 'Tabitha', 'Thomas', 'Selah', 'Gabriel', 'Eden',
  'Michael', 'Mercy', 'Christopher', 'Patience', 'Jacob', 'Harmony', 'Isaac',
  'Sophia', 'Liam', 'Emma', 'Mason', 'Ava', 'Logan', 'Mia', 'Alexander',
  'Chloe', 'William', 'Lily', 'Henry', 'Zoe', 'Sebastian', 'Ella', 'Jack',
  'Aria', 'Owen', 'Nora', 'Aiden', 'Luna', 'Carter', 'Riley', 'Jayden',
  'Layla', 'Dylan', 'Stella', 'Leo', 'Aurora', 'Grayson', 'Ivy', 'Levi',
  'Willow', 'Mateo', 'Hazel', 'Jackson', 'Violet', 'Lincoln', 'Scarlett',
  'Cameron', 'Penelope',
];

const LAST_NAMES = [
  'Thompson', 'Williams', 'Mitchell', 'Chen', 'James', 'Brown', 'Rivera',
  'Foster', 'Scott', 'Moore', 'Cruz', 'Kim', 'Patterson', 'Turner',
  'Gonzalez', 'Brooks', 'Hayes', 'Carter', 'Patel', 'Reed', 'Adams',
  'Wright', 'Morgan', 'Harrison', 'Campbell', 'Phillips', 'Jenkins', 'Diaz',
  'Lee', 'Ross', 'Evans', 'Grant', 'Taylor', 'Anderson', 'Martinez',
  'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Walker', 'Hall', 'Allen',
  'Young', 'King', 'Hill', 'Green', 'Baker', 'Nelson', 'Perez', 'Roberts',
  'Davis', 'Wilson', 'Thomas', 'Garcia', 'Jackson', 'White', 'Harris',
  'Martin', 'Lopez', 'Ramirez', 'Collins', 'Stewart', 'Sanchez', 'Morris',
  'Rogers', 'Reed', 'Cook', 'Bell', 'Cooper', 'Murphy', 'Bailey', 'Howard',
  'Ward', 'Cox', 'Torres', 'Peterson', 'Gray', 'Watson', 'Brooks', 'Kelly',
  'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson',
  'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Butler', 'Russell',
  'Bryant', 'Griffin', 'Flores', 'Washington', 'Simmons', 'Hughes',
];

const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#DC2626', '#059669', '#D97706',
  '#EC4899', '#0891B2', '#9333EA', '#16A34A', '#E11D48',
];

const MODES = ['bible', 'positivity'];

// ---------------------------------------------------------------------------
// Comment pool (50 generic positive / faith-oriented comments)
// ---------------------------------------------------------------------------

const COMMENT_POOL = [
  "This is exactly what I needed to hear today. Thank you for sharing!",
  "So inspiring! God bless you for posting this.",
  "Amen! What a beautiful message.",
  "I've been going through a tough time and this really lifted my spirits.",
  "Sharing this with my small group tonight. So powerful!",
  "The Lord works in mysterious ways. This is proof of that.",
  "Praying for everyone who sees this post today.",
  "What a beautiful reminder of God's faithfulness.",
  "This spoke directly to my heart. Thank you!",
  "I can feel the presence of the Holy Spirit in this message.",
  "Just what I needed on this beautiful day. God is good!",
  "So grateful for this community and messages like this.",
  "Reading this brought tears to my eyes. So powerful.",
  "God's love never fails. This is a perfect reminder.",
  "Bookmarking this to come back to whenever I need encouragement.",
  "This is going to change someone's life today. I can feel it.",
  "Thank you for being a light in this world!",
  "Every time I see your posts, I feel closer to God.",
  "What a blessing this community is! Love you all.",
  "Sending love and prayers to everyone reading this.",
  "This message is fire! God is speaking through you.",
  "I shared this with my family and we all loved it.",
  "The timing of this post is not a coincidence. God knew I needed it.",
  "Wow, this really puts everything in perspective.",
  "My faith grows stronger every day because of content like this.",
  "This is the kind of positivity the world needs right now.",
  "I'm claiming this promise over my life today!",
  "Thank you for always bringing the Word to life.",
  "What a powerful testimony of God's grace.",
  "I love how this community lifts each other up.",
  "Starting my morning with this and feeling so blessed.",
  "God's timing is always perfect. Needed this today!",
  "This hit different today. Thank you for your faithfulness.",
  "Can't stop thinking about this message. So profound.",
  "Sharing this everywhere! Everyone needs to see this.",
  "The world tries to tear us down but God always lifts us up.",
  "Praying that this message reaches the hearts that need it most.",
  "Your posts always bring me peace. Thank you!",
  "I've been following for a while and this is one of the best yet.",
  "Nothing but truth and love in this post. Amen!",
  "This community is such a safe space. I'm so grateful.",
  "God spoke to me through this today. I'm in tears.",
  "What a way to start the day! Blessed beyond measure.",
  "Keep posting content like this. It changes lives!",
  "I feel so encouraged after reading this. God is amazing!",
  "My favorite account to follow. Always uplifting!",
  "This is the content that makes a real difference.",
  "Every word of this resonates with my soul.",
  "Thank you for using your platform for good!",
  "Love and blessings to everyone in this community today.",
];

// Reaction type weights: like 70%, love 15%, pray 10%, wow 5%
const REACTION_WEIGHTS = [
  { type: 'like', weight: 70 },
  { type: 'love', weight: 85 },  // cumulative: 70+15=85
  { type: 'pray', weight: 95 },  // cumulative: 85+10=95
  { type: 'wow', weight: 100 },  // cumulative: 95+5=100
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedReaction() {
  const roll = randomInt(1, 100);
  for (const r of REACTION_WEIGHTS) {
    if (roll <= r.weight) return r.type;
  }
  return 'like';
}

function generateDisplayName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function formatElapsed(startMs) {
  const s = ((Date.now() - startMs) / 1000).toFixed(1);
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isCleanup = process.argv.includes('--cleanup');
  const startTime = Date.now();
  const conn = await mysql.createConnection(DB_CONFIG);

  if (isCleanup) {
    await cleanup(conn);
    await conn.end();
    return;
  }

  console.log('=== SEED 10K AI FOLLOWERS + ENGAGEMENT ===\n');

  // Look up @freeluma user ID
  const [freelumaRows] = await conn.query(
    "SELECT id FROM users WHERE username = 'freeluma'"
  );
  if (freelumaRows.length === 0) {
    console.error('ERROR: @freeluma user not found!');
    await conn.end();
    process.exit(1);
  }
  const freelumaId = freelumaRows[0].id;
  console.log(`@freeluma user ID: ${freelumaId}`);

  // Get @freeluma's posts
  const [posts] = await conn.query(
    'SELECT id, created_at FROM posts WHERE user_id = ? ORDER BY id',
    [freelumaId]
  );
  console.log(`@freeluma has ${posts.length} posts\n`);

  if (posts.length === 0) {
    console.error('ERROR: @freeluma has no posts!');
    await conn.end();
    process.exit(1);
  }

  // ---- Step 1: Create 10K AI users ----
  console.log(`[1/6] Creating ${TOTAL_USERS} AI users (batches of ${BATCH_SIZE})...`);
  let usersCreated = 0;

  for (let batch = 0; batch < TOTAL_USERS; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, TOTAL_USERS);
    const values = [];
    const params = [];

    for (let i = batch; i < batchEnd; i++) {
      const n = i + 1;
      const email = `fl_user_${n}${EMAIL_DOMAIN}`;
      const username = `fl_user_${n}`;
      const displayName = generateDisplayName(i);
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const mode = MODES[i % 2];

      values.push('(?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())');
      params.push(email, displayName, username, avatarColor, mode);
    }

    await conn.query(
      `INSERT IGNORE INTO users (email, display_name, username, avatar_color, mode, email_verified, onboarding_complete, has_seen_tutorial, created_at, updated_at)
       VALUES ${values.join(',')}`,
      params
    );

    usersCreated = batchEnd;
    process.stdout.write(`\r  ${usersCreated}/${TOTAL_USERS} users`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // Get all AI user IDs
  const [aiUsers] = await conn.query(
    `SELECT id FROM users WHERE email LIKE ?`,
    [`%${EMAIL_DOMAIN}`]
  );
  const aiUserIds = aiUsers.map((u) => u.id);
  console.log(`  Found ${aiUserIds.length} AI users in DB`);

  // ---- Step 2: Create user_settings ----
  console.log(`\n[2/6] Creating user_settings for ${aiUserIds.length} users...`);
  let settingsCreated = 0;

  for (let batch = 0; batch < aiUserIds.length; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, aiUserIds.length);
    const values = [];
    const params = [];

    for (let i = batch; i < batchEnd; i++) {
      values.push('(?, NOW(), NOW())');
      params.push(aiUserIds[i]);
    }

    await conn.query(
      `INSERT IGNORE INTO user_settings (user_id, created_at, updated_at)
       VALUES ${values.join(',')}`,
      params
    );

    settingsCreated = batchEnd;
    process.stdout.write(`\r  ${settingsCreated}/${aiUserIds.length} settings`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // ---- Step 3: Follow @freeluma ----
  console.log(`\n[3/6] All ${aiUserIds.length} users following @freeluma...`);
  let followsCreated = 0;

  for (let batch = 0; batch < aiUserIds.length; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, aiUserIds.length);
    const values = [];
    const params = [];

    for (let i = batch; i < batchEnd; i++) {
      values.push("(?, ?, 'active', NOW(), NOW())");
      params.push(aiUserIds[i], freelumaId);
    }

    await conn.query(
      `INSERT IGNORE INTO follows (follower_id, following_id, status, created_at, updated_at)
       VALUES ${values.join(',')}`,
      params
    );

    followsCreated = batchEnd;
    process.stdout.write(`\r  ${followsCreated}/${aiUserIds.length} follows`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // ---- Step 4: React to @freeluma's posts ----
  console.log(`\n[4/6] Adding reactions to ${posts.length} posts (60-80% of users per post)...`);
  let totalReactions = 0;

  for (const post of posts) {
    const reactPercent = randomInt(60, 80) / 100;
    const numReactors = Math.floor(aiUserIds.length * reactPercent);
    // Shuffle and pick a subset
    const shuffled = [...aiUserIds].sort(() => Math.random() - 0.5);
    const reactors = shuffled.slice(0, numReactors);

    for (let batch = 0; batch < reactors.length; batch += BATCH_SIZE) {
      const batchEnd = Math.min(batch + BATCH_SIZE, reactors.length);
      const values = [];
      const params = [];

      for (let i = batch; i < batchEnd; i++) {
        const reactionType = weightedReaction();
        values.push('(?, ?, ?, NOW(), NOW())');
        params.push(reactors[i], post.id, reactionType);
      }

      await conn.query(
        `INSERT IGNORE INTO post_reactions (user_id, post_id, reaction_type, created_at, updated_at)
         VALUES ${values.join(',')}`,
        params
      );
    }

    totalReactions += numReactors;
    process.stdout.write(`\r  Post ${post.id}: ${numReactors} reactions (total: ${totalReactions})`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // ---- Step 5: Comment on @freeluma's posts ----
  const commentsPerPost = () => randomInt(20, 40);
  console.log(`\n[5/6] Adding 20-40 comments per post...`);
  let totalComments = 0;

  for (const post of posts) {
    const numComments = commentsPerPost();
    const values = [];
    const params = [];

    for (let c = 0; c < numComments; c++) {
      const userId = randomFrom(aiUserIds);
      const body = randomFrom(COMMENT_POOL);
      // Stagger timestamps within the post's created_at day
      const hourOffset = randomInt(1, 72); // spread across 3 days after post
      const minOffset = randomInt(0, 59);

      values.push('(?, ?, NULL, ?, 0, 0, 0, DATE_ADD(?, INTERVAL ? HOUR) + INTERVAL ? MINUTE, NOW())');
      params.push(userId, post.id, body, post.created_at, hourOffset, minOffset);
    }

    await conn.query(
      `INSERT INTO post_comments (user_id, post_id, parent_id, body, edited, flagged, hidden, created_at, updated_at)
       VALUES ${values.join(',')}`,
      params
    );

    totalComments += numComments;
    process.stdout.write(`\r  Post ${post.id}: ${numComments} comments (total: ${totalComments})`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // ---- Step 6: Impressions (views) ----
  console.log(`\n[6/6] Adding impressions on ${posts.length} posts (all ${aiUserIds.length} users per post)...`);
  let totalImpressions = 0;

  for (const post of posts) {
    for (let batch = 0; batch < aiUserIds.length; batch += BATCH_SIZE) {
      const batchEnd = Math.min(batch + BATCH_SIZE, aiUserIds.length);
      const values = [];
      const params = [];

      for (let i = batch; i < batchEnd; i++) {
        values.push('(?, ?, NOW())');
        params.push(post.id, aiUserIds[i]);
      }

      await conn.query(
        `INSERT IGNORE INTO post_impressions (post_id, user_id, created_at)
         VALUES ${values.join(',')}`,
        params
      );
    }

    totalImpressions += aiUserIds.length;
    process.stdout.write(`\r  Post ${post.id}: ${aiUserIds.length} impressions (total: ${totalImpressions})`);
  }
  console.log(` ✓ (${formatElapsed(startTime)})`);

  // ---- Summary ----
  console.log(`\n=== SUMMARY ===`);
  console.log(`AI Users:    ${aiUserIds.length}`);
  console.log(`Follows:     ${aiUserIds.length} (all → @freeluma)`);
  console.log(`Reactions:   ~${totalReactions}`);
  console.log(`Comments:    ${totalComments}`);
  console.log(`Impressions: ${totalImpressions}`);
  console.log(`Total time:  ${formatElapsed(startTime)}`);
  console.log(`\nTo remove everything: node scripts/seed-ai-followers.mjs --cleanup`);

  await conn.end();
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup(conn) {
  console.log('=== CLEANUP MODE ===\n');

  // Find all AI user IDs
  const [aiUsers] = await conn.query(
    `SELECT id FROM users WHERE email LIKE ?`,
    [`%${EMAIL_DOMAIN}`]
  );

  if (aiUsers.length === 0) {
    console.log('No AI follower users found. Nothing to clean up.');
    return;
  }

  const aiUserIds = aiUsers.map((u) => u.id);
  console.log(`Found ${aiUserIds.length} AI users to clean up.`);

  // Delete in dependency order (children first)
  const tables = [
    { name: 'post_impressions', col: 'user_id' },
    { name: 'post_reactions', col: 'user_id' },
    { name: 'post_comments', col: 'user_id' },
    { name: 'follows', col: 'follower_id' },
    { name: 'user_settings', col: 'user_id' },
  ];

  for (const table of tables) {
    // Delete in batches to avoid huge transactions
    let totalDeleted = 0;
    for (let batch = 0; batch < aiUserIds.length; batch += BATCH_SIZE) {
      const batchIds = aiUserIds.slice(batch, batch + BATCH_SIZE);
      const placeholders = batchIds.map(() => '?').join(',');
      const [result] = await conn.query(
        `DELETE FROM ${table.name} WHERE ${table.col} IN (${placeholders})`,
        batchIds
      );
      totalDeleted += result.affectedRows;
    }
    console.log(`  Deleted ${totalDeleted} rows from ${table.name}`);
  }

  // Finally delete users (they have soft deletes / paranoid, so force delete)
  let totalUsersDeleted = 0;
  for (let batch = 0; batch < aiUserIds.length; batch += BATCH_SIZE) {
    const batchIds = aiUserIds.slice(batch, batch + BATCH_SIZE);
    const placeholders = batchIds.map(() => '?').join(',');
    const [result] = await conn.query(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      batchIds
    );
    totalUsersDeleted += result.affectedRows;
  }
  console.log(`  Deleted ${totalUsersDeleted} users`);

  console.log('\nCleanup complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
