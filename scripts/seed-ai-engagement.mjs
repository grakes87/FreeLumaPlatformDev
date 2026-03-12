/**
 * Seed AI-generated engagement (reactions + comments) for daily bible content.
 *
 * Creates temporary AI user profiles, adds reactions and contextual comments,
 * and records all usernames for easy cleanup.
 *
 * Usage: node scripts/seed-ai-engagement.mjs
 * Cleanup: node scripts/seed-ai-engagement.mjs --cleanup
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

// ---------------------------------------------------------------------------
// AI User Profiles
// ---------------------------------------------------------------------------

const AI_USERS = [
  { display_name: 'Grace Thompson', username: 'fl_grace_t', avatar_color: '#7C3AED' },
  { display_name: 'Marcus Williams', username: 'fl_marcus_w', avatar_color: '#2563EB' },
  { display_name: 'Sarah Mitchell', username: 'fl_sarah_m', avatar_color: '#DC2626' },
  { display_name: 'David Chen', username: 'fl_david_c', avatar_color: '#059669' },
  { display_name: 'Olivia James', username: 'fl_olivia_j', avatar_color: '#D97706' },
  { display_name: 'Isaiah Brown', username: 'fl_isaiah_b', avatar_color: '#7C3AED' },
  { display_name: 'Hannah Rivera', username: 'fl_hannah_r', avatar_color: '#EC4899' },
  { display_name: 'Caleb Foster', username: 'fl_caleb_f', avatar_color: '#0891B2' },
  { display_name: 'Naomi Scott', username: 'fl_naomi_s', avatar_color: '#9333EA' },
  { display_name: 'Elijah Moore', username: 'fl_elijah_m', avatar_color: '#16A34A' },
  { display_name: 'Abigail Cruz', username: 'fl_abigail_c', avatar_color: '#E11D48' },
  { display_name: 'Joshua Kim', username: 'fl_joshua_k', avatar_color: '#1D4ED8' },
  { display_name: 'Leah Patterson', username: 'fl_leah_p', avatar_color: '#CA8A04' },
  { display_name: 'Micah Turner', username: 'fl_micah_t', avatar_color: '#0D9488' },
  { display_name: 'Ruth Gonzalez', username: 'fl_ruth_g', avatar_color: '#BE185D' },
  { display_name: 'Ethan Brooks', username: 'fl_ethan_b', avatar_color: '#4F46E5' },
  { display_name: 'Lydia Hayes', username: 'fl_lydia_h', avatar_color: '#DB2777' },
  { display_name: 'Noah Carter', username: 'fl_noah_c', avatar_color: '#0284C7' },
  { display_name: 'Miriam Patel', username: 'fl_miriam_p', avatar_color: '#7C2D12' },
  { display_name: 'Samuel Reed', username: 'fl_samuel_r', avatar_color: '#15803D' },
  { display_name: 'Rachel Adams', username: 'fl_rachel_a', avatar_color: '#8B5CF6' },
  { display_name: 'Daniel Wright', username: 'fl_daniel_w', avatar_color: '#0369A1' },
  { display_name: 'Faith Morgan', username: 'fl_faith_m', avatar_color: '#E11D48' },
  { display_name: 'Luke Harrison', username: 'fl_luke_h', avatar_color: '#047857' },
  { display_name: 'Joy Campbell', username: 'fl_joy_c', avatar_color: '#C026D3' },
  { display_name: 'Aaron Phillips', username: 'fl_aaron_p', avatar_color: '#1E40AF' },
  { display_name: 'Hope Jenkins', username: 'fl_hope_j', avatar_color: '#BE123C' },
  { display_name: 'Nathan Diaz', username: 'fl_nathan_d', avatar_color: '#0F766E' },
  { display_name: 'Esther Lee', username: 'fl_esther_l', avatar_color: '#A21CAF' },
  { display_name: 'Timothy Ross', username: 'fl_timothy_r', avatar_color: '#1D4ED8' },
  { display_name: 'Charity Evans', username: 'fl_charity_e', avatar_color: '#DB2777' },
  { display_name: 'Peter Grant', username: 'fl_peter_g', avatar_color: '#166534' },
];

// ---------------------------------------------------------------------------
// Daily Content Targets (bible mode, Feb 21-28, English only)
// ---------------------------------------------------------------------------

const DAILY_CONTENT = [
  {
    id: 730,
    date: '2026-02-21',
    ref: 'Daniel 11:25',
    text: 'And he shall stir up his power and his courage against the king of the south with a great army...',
  },
  {
    id: 732,
    date: '2026-02-22',
    ref: 'Matthew 4:8',
    text: 'Again, the devil taketh him up into an exceeding high mountain, and sheweth him all the kingdoms of the world, and the glory of them;',
  },
  {
    id: 734,
    date: '2026-02-23',
    ref: 'Zechariah 6:7',
    text: 'And the bay went forth, and sought to go that they might walk to and fro through the earth...',
  },
  {
    id: 736,
    date: '2026-02-24',
    ref: '1 Corinthians 13:11',
    text: 'When I was a child, I spake as a child, I understood as a child, I thought as a child: but when I became a man, I put away childish things.',
  },
  {
    id: 738,
    date: '2026-02-25',
    ref: 'Colossians 1:11',
    text: 'Strengthened with all might, according to his glorious power, unto all patience and longsuffering with joyfulness;',
  },
  {
    id: 740,
    date: '2026-02-26',
    ref: 'Mark 1:30',
    text: "But Simon's wife's mother lay sick of a fever, and anon they tell him of her.",
  },
  {
    id: 742,
    date: '2026-02-27',
    ref: '1 Timothy 6:16',
    text: 'Who only hath immortality, dwelling in the light which no man can approach unto; whom no man hath seen, nor can see: to whom be honour and power everlasting. Amen.',
  },
  {
    id: 744,
    date: '2026-02-28',
    ref: 'Proverbs 7:17',
    text: 'I have perfumed my bed with myrrh, aloes, and cinnamon.',
  },
];

// ---------------------------------------------------------------------------
// Contextual Comments (per daily_content_id)
// ---------------------------------------------------------------------------

const COMMENTS_BY_CONTENT = {
  730: [ // Daniel 11:25
    "This reminds me that no matter how powerful the opposition seems, God's plan always prevails.",
    "Daniel's prophecies are so detailed. It's amazing how God reveals the future to His people.",
    "Even when armies rise against us, we can trust that God fights our battles.",
    "Such a powerful reminder that courage comes from the Lord, not from our own strength.",
    "Reading Daniel always strengthens my faith. God is sovereign over every nation and ruler.",
    "This verse speaks to the spiritual battles we face daily. God is always in control.",
    "Praying for courage today, just like God gave courage to His people in Daniel's time.",
  ],
  732: [ // Matthew 4:8
    "Jesus showed us exactly how to resist temptation - with the Word of God.",
    "The devil offered everything the world has, but Jesus knew His Father's kingdom was greater.",
    "This is such a relevant verse for today. So many distractions trying to pull us away from God.",
    "No amount of worldly glory compares to walking with Christ. Thank you for this reminder.",
    "The temptation of Jesus gives me hope that we too can overcome through His strength.",
    "What a powerful example of staying focused on God's purpose instead of earthly riches.",
    "I needed this today. Been struggling with distractions but this puts it in perspective.",
  ],
  734: [ // Zechariah 6:7
    "God's messengers go throughout the whole earth. Nothing escapes His notice.",
    "This is a beautiful picture of how God's will is carried out across the entire world.",
    "Zechariah's visions are so vivid. God's authority extends to every corner of the earth.",
    "Reminds me that God is always working, even when we can't see it.",
    "His purposes move forward with certainty. What a comfort in uncertain times.",
    "I love how this shows God's active involvement in the world. He never stops working.",
  ],
  736: [ // 1 Corinthians 13:11
    "One of my favorite verses. Growing in faith means letting go of old ways of thinking.",
    "This verse challenges me to examine what 'childish things' I still need to put away.",
    "Spiritual maturity is a journey. Thank God for His patience with us as we grow.",
    "Such a beautiful reminder that growth requires change. Lord help me grow today.",
    "Paul's words here are so simple yet so profound. Maturity in Christ changes everything.",
    "I've been reflecting on this lately. God is calling me to a deeper level of faith.",
    "Putting away childish things isn't easy, but it's worth it when you see what God has ahead.",
    "This spoke directly to my heart today. Time to step into the fullness God has for me.",
  ],
  738: [ // Colossians 1:11
    "Strengthened with ALL might! God doesn't give us partial strength - He gives us everything we need.",
    "Patience and longsuffering WITH JOYFULNESS. That's the part that challenges me most.",
    "What a beautiful prayer from Paul. I'm claiming this over my life today.",
    "His glorious power is what sustains us through every trial. Amen!",
    "I needed this encouragement so much today. Feeling strengthened just reading it.",
    "Joy in the midst of suffering - only possible through God's power working in us.",
    "This is my verse for the week. Printing it out and putting it on my mirror.",
  ],
  740: [ // Mark 1:30
    "Jesus cares about our everyday struggles, even something as simple as a fever.",
    "I love that they immediately told Jesus about her. We should bring everything to Him in prayer.",
    "No problem is too small for Jesus. He cares about every detail of our lives.",
    "This shows the importance of community - they told Jesus and He responded.",
    "The compassion of Christ is endless. He heals, He restores, He cares.",
    "Praying for healing for everyone in this community who is going through illness right now.",
  ],
  742: [ // 1 Timothy 6:16
    "Dwelling in unapproachable light - what an incredible description of our God!",
    "To whom be honour and power everlasting. Amen! This verse gives me chills.",
    "The majesty of God described here is beyond human comprehension. So humbling.",
    "Only God has immortality. Everything else is temporary. What a perspective shift.",
    "This verse makes me want to worship. His glory is beyond anything we can imagine.",
    "Reading this fills me with awe. How amazing that this God loves us personally.",
    "Amen! All honor and power belong to Him forever. What a mighty God we serve.",
  ],
  744: [ // Proverbs 7:17
    "Proverbs is full of wisdom about guarding our hearts and minds. Important lesson here.",
    "This chapter is a warning about temptation disguised as something beautiful.",
    "God wants us to be discerning, not deceived by surface-level attractiveness.",
    "Wisdom from Proverbs is so practical for everyday life. Thank you for sharing this.",
    "A good reminder to seek wisdom and discernment in all areas of life.",
    "Solomon's writings always make me think deeper about the choices I make daily.",
  ],
};

// Reaction types (no sad, no haha)
const REACTION_TYPES = ['like', 'love', 'wow', 'pray'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isCleanup = process.argv.includes('--cleanup');
  const conn = await mysql.createConnection(DB_CONFIG);

  if (isCleanup) {
    console.log('--- CLEANUP MODE ---');
    const usernames = AI_USERS.map((u) => u.username);
    const placeholders = usernames.map(() => '?').join(',');

    // Get user IDs
    const [users] = await conn.query(
      `SELECT id, username FROM users WHERE username IN (${placeholders})`,
      usernames
    );

    if (users.length === 0) {
      console.log('No AI users found. Nothing to clean up.');
      await conn.end();
      return;
    }

    const userIds = users.map((u) => u.id);
    const idPlaceholders = userIds.map(() => '?').join(',');

    // Delete reactions
    const [rxnResult] = await conn.query(
      `DELETE FROM daily_reactions WHERE user_id IN (${idPlaceholders})`,
      userIds
    );
    console.log(`Deleted ${rxnResult.affectedRows} reactions`);

    // Delete comments
    const [cmtResult] = await conn.query(
      `DELETE FROM daily_comments WHERE user_id IN (${idPlaceholders})`,
      userIds
    );
    console.log(`Deleted ${cmtResult.affectedRows} comments`);

    // Delete users (soft delete — set deleted_at)
    const [usrResult] = await conn.query(
      `DELETE FROM users WHERE id IN (${idPlaceholders})`,
      userIds
    );
    console.log(`Deleted ${usrResult.affectedRows} AI users`);

    console.log('Cleanup complete.');
    await conn.end();
    return;
  }

  // ---- SEED MODE ----
  console.log('--- SEED AI ENGAGEMENT ---');

  // 1. Create AI users
  console.log(`\nCreating ${AI_USERS.length} AI user profiles...`);
  const userIdMap = {}; // username -> id

  for (const u of AI_USERS) {
    const email = `${u.username}@ai-seed.freeluma.internal`;
    try {
      const [result] = await conn.query(
        `INSERT INTO users (email, display_name, username, avatar_color, mode, email_verified, onboarding_complete, has_seen_tutorial, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'bible', 1, 1, 1, NOW(), NOW())`,
        [email, u.display_name, u.username, u.avatar_color]
      );
      userIdMap[u.username] = result.insertId;
      console.log(`  Created: ${u.display_name} (@${u.username}) -> ID ${result.insertId}`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [u.username]);
        userIdMap[u.username] = existing[0].id;
        console.log(`  Exists: ${u.display_name} (@${u.username}) -> ID ${existing[0].id}`);
      } else {
        throw err;
      }
    }
  }

  const allUserIds = Object.values(userIdMap);

  // 2. Distribute reactions: 200-250 total across 8 days
  const totalReactions = randomInt(200, 250);
  console.log(`\nAdding ${totalReactions} reactions across ${DAILY_CONTENT.length} days...`);

  let reactionCount = 0;
  const contentIds = DAILY_CONTENT.map((c) => c.id);

  // Distribute roughly evenly with some variance
  const reactionsPerDay = [];
  let remaining = totalReactions;
  for (let i = 0; i < contentIds.length; i++) {
    if (i === contentIds.length - 1) {
      reactionsPerDay.push(remaining);
    } else {
      const avg = remaining / (contentIds.length - i);
      const count = randomInt(Math.floor(avg * 0.7), Math.ceil(avg * 1.3));
      reactionsPerDay.push(Math.min(count, remaining, allUserIds.length));
      remaining -= reactionsPerDay[i];
    }
  }

  for (let i = 0; i < contentIds.length; i++) {
    const contentId = contentIds[i];
    const numReactions = Math.min(reactionsPerDay[i], allUserIds.length);
    const shuffledUsers = shuffle(allUserIds).slice(0, numReactions);

    for (const userId of shuffledUsers) {
      const reactionType = randomFrom(REACTION_TYPES);
      try {
        await conn.query(
          `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [userId, contentId, reactionType]
        );
        reactionCount++;
      } catch {
        // skip duplicates
      }
    }
    console.log(`  ${DAILY_CONTENT[i].date} (${DAILY_CONTENT[i].ref}): ${numReactions} reactions`);
  }

  // 3. Add contextual comments: 40-65 total
  const totalComments = randomInt(40, 65);
  console.log(`\nAdding ~${totalComments} comments across ${DAILY_CONTENT.length} days...`);

  let commentCount = 0;
  const allCommentPool = [];

  for (const content of DAILY_CONTENT) {
    const comments = COMMENTS_BY_CONTENT[content.id] || [];
    for (const body of comments) {
      allCommentPool.push({ contentId: content.id, body, date: content.date, ref: content.ref });
    }
  }

  // Shuffle and pick totalComments
  const selectedComments = shuffle(allCommentPool).slice(0, totalComments);

  // Sort by content date for natural ordering
  selectedComments.sort((a, b) => a.contentId - b.contentId);

  for (const comment of selectedComments) {
    const userId = randomFrom(allUserIds);
    // Stagger timestamps slightly within the day
    const hourOffset = randomInt(6, 22);
    const minOffset = randomInt(0, 59);

    try {
      await conn.query(
        `INSERT INTO daily_comments (user_id, daily_content_id, parent_id, body, edited, created_at, updated_at)
         VALUES (?, ?, NULL, ?, 0, DATE_ADD(?, INTERVAL ? HOUR) + INTERVAL ? MINUTE, NOW())`,
        [userId, comment.contentId, comment.body, comment.date, hourOffset, minOffset]
      );
      commentCount++;
    } catch (err) {
      console.error(`  Error adding comment: ${err.message}`);
    }
  }

  // Group comment counts by date for logging
  const commentsByDate = {};
  for (const c of selectedComments) {
    commentsByDate[c.date] = (commentsByDate[c.date] || 0) + 1;
  }
  for (const [date, count] of Object.entries(commentsByDate).sort()) {
    const content = DAILY_CONTENT.find((d) => d.date === date);
    console.log(`  ${date} (${content?.ref}): ${count} comments`);
  }

  // 4. Summary
  console.log(`\n--- SUMMARY ---`);
  console.log(`AI Users created: ${allUserIds.length}`);
  console.log(`Reactions added: ${reactionCount}`);
  console.log(`Comments added: ${commentCount}`);
  console.log(`\nAI usernames (for cleanup):`);
  for (const u of AI_USERS) {
    console.log(`  @${u.username} (ID: ${userIdMap[u.username]})`);
  }
  console.log(`\nTo remove all AI engagement: node scripts/seed-ai-engagement.mjs --cleanup`);

  await conn.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
