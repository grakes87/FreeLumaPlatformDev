/**
 * Seed heavy AI engagement for all verse-by-category content.
 *
 * Creates 1500 AI user profiles, adds 500-1500 reactions per verse,
 * and 15-40 comments per verse with casual + contextual mix.
 *
 * Usage: node scripts/seed-verse-category-engagement.mjs
 * Cleanup: node scripts/seed-verse-category-engagement.mjs --cleanup
 */

import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: '10.0.0.3',
  user: 'freeluma_app',
  password: 'FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1',
  database: 'freeluma_prod',
};

const REACTION_TYPES = ['like', 'love', 'wow', 'pray'];

// ---------------------------------------------------------------------------
// Generate 1500 AI users programmatically
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Grace','Marcus','Sarah','David','Olivia','Isaiah','Hannah','Caleb','Naomi','Elijah',
  'Abigail','Joshua','Leah','Micah','Ruth','Ethan','Lydia','Noah','Miriam','Samuel',
  'Rachel','Daniel','Faith','Luke','Joy','Aaron','Hope','Nathan','Esther','Timothy',
  'Charity','Peter','Rebecca','James','Priscilla','Andrew','Deborah','Benjamin','Anna','Stephen',
  'Mary','John','Martha','Paul','Eve','Silas','Tabitha','Levi','Phoebe','Titus',
  'Chloe','Seth','Dina','Abel','Gloria','Gideon','Selah','Jesse','Eden','Judah',
  'Mercy','Ezra','Zara','Malachi','Serenity','Josiah','Trinity','Eli','Haven','Asher',
  'Harmony','Liam','Bethany','Owen','Autumn','Kai','Summer','Cole','Winter','Blake',
  'Crystal','Drew','Diamond','Finn','Ember','Grant','Ivy','Heath','Jade','Kent',
  'Luna','Miles','Nora','Oscar','Pearl','Quinn','Ruby','Scott','Tara','Wade',
  'Violet','Axel','Brielle','Chase','Daisy','Evan','Fiona','Hugo','Iris','Jake',
  'Kira','Lance','Mila','Nate','Opal','Reed','Sage','Troy','Uma','Vince',
  'Wren','Xander','Yara','Zane',
];

const LAST_NAMES = [
  'Thompson','Williams','Mitchell','Chen','James','Brown','Rivera','Foster','Scott','Moore',
  'Cruz','Kim','Patterson','Turner','Gonzalez','Brooks','Hayes','Carter','Patel','Reed',
  'Adams','Wright','Morgan','Harrison','Campbell','Phillips','Jenkins','Diaz','Lee','Ross',
  'Evans','Grant','Baker','Clark','Davis','Edwards','Fisher','Garcia','Hill','Irving',
  'Jackson','Kelly','Lopez','Martin','Nelson','Ortiz','Parker','Quinn','Roberts','Stewart',
  'Taylor','Underwood','Vasquez','Walker','Young','Zimmerman','Anderson','Bell','Cooper','Dean',
  'Ellis','Fleming','Gibson','Hart','Ingram','Jones','Knox','Lambert','Mason','Norris',
  'Owens','Perry','Reese','Shaw','Torres','Upton','Vargas','Webb','Yates','Ziegler',
];

const COLORS = [
  '#7C3AED','#2563EB','#DC2626','#059669','#D97706','#EC4899','#0891B2','#9333EA',
  '#16A34A','#E11D48','#1D4ED8','#CA8A04','#0D9488','#BE185D','#4F46E5','#DB2777',
  '#0284C7','#7C2D12','#15803D','#8B5CF6','#0369A1','#047857','#C026D3','#1E40AF',
  '#BE123C','#0F766E','#A21CAF','#166534',
];

function generateUsers(count) {
  const users = [];
  const usedUsernames = new Set();
  let fi = 0, li = 0;

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[fi % FIRST_NAMES.length];
    const last = LAST_NAMES[li % LAST_NAMES.length];
    let username = `fl_${first.toLowerCase()}_${last.toLowerCase().slice(0,3)}${i}`;
    // Ensure unique and <=30 chars
    username = username.slice(0, 30);
    while (usedUsernames.has(username)) {
      username = `fl_${first.toLowerCase().slice(0,4)}${i}`;
    }
    usedUsernames.add(username);

    users.push({
      display_name: `${first} ${last}`,
      username,
      avatar_color: COLORS[i % COLORS.length],
    });

    fi++;
    if (fi % FIRST_NAMES.length === 0) li++;
  }
  return users;
}

const AI_USERS = generateUsers(1500);

// ---------------------------------------------------------------------------
// Generic casual comments (work with any verse)
// ---------------------------------------------------------------------------

const CASUAL_COMMENTS = [
  "Amen!",
  "Amen 🙏",
  "AMEN!",
  "Amen amen amen!",
  "Praise God!",
  "Praise the Lord!",
  "Yes Lord!",
  "Yes!",
  "So good!",
  "So powerful!",
  "Wow.",
  "This hit different today.",
  "Needed this.",
  "Needed this today!",
  "Needed this so much today.",
  "Right on time.",
  "God is good!",
  "God is so good!",
  "God is good all the time!",
  "All the time God is good!",
  "Thank you Jesus!",
  "Thank You Lord!",
  "Thank God for this.",
  "Glory to God!",
  "Hallelujah!",
  "What a word!",
  "This right here!",
  "Say that again!",
  "Read that again!",
  "Louder for the people in the back!",
  "Claiming this!",
  "Claiming this over my life!",
  "Speaking this over my family.",
  "Sharing this with everyone I know.",
  "Sent this to my mom.",
  "Sent this to my prayer group.",
  "Screenshot saved.",
  "This is going on my wall.",
  "Bookmarked!",
  "This is my verse for the day.",
  "This is my verse for the week.",
  "Been meditating on this all day.",
  "Can't stop thinking about this verse.",
  "This spoke to my soul.",
  "My heart is full.",
  "Tears reading this.",
  "Crying right now. This is exactly what I needed.",
  "Goosebumps.",
  "The Word never fails!",
  "His Word is alive!",
  "The Bible is the best book ever written.",
  "God knew I needed this today.",
  "How does God always know exactly what I need to hear?",
  "God's timing is perfect.",
  "No coincidence I saw this today.",
  "God literally put this in front of me right when I needed it.",
  "Praying for everyone reading this.",
  "Blessings to all!",
  "Love this community!",
  "So grateful for FreeLuma.",
  "Best way to start my morning.",
  "Starting my day with this truth.",
  "Ending my day with this. Goodnight family.",
  "Good morning FreeLuma fam!",
  "This is why I open this app every day.",
  "Fire!",
  "This is everything.",
  "Nothing but truth.",
  "Facts.",
  "Truth!",
  "Real talk.",
  "Preach!",
  "Say less. God said it all.",
  "Period.",
  "That part!",
  "The whole verse is gold.",
  "Every word hits.",
  "Let the church say amen!",
  "Can I get an amen?",
];

// ---------------------------------------------------------------------------
// Category-specific contextual comments
// ---------------------------------------------------------------------------

const CATEGORY_COMMENTS = {
  'Hope & Encouragement': [
    "This fills my heart with so much hope today.",
    "God's promises never fail. What an encouragement!",
    "I really needed this reminder that God is with me.",
    "Sharing this with someone who needs hope right now.",
    "What a beautiful promise from the Lord.",
    "This gives me strength to keep going.",
    "Reading this brought tears to my eyes. So encouraging.",
    "Hope is never lost when we trust in the Lord.",
    "Every time I read verses like this my faith grows stronger.",
    "God's encouragement meets us right where we are.",
    "His Word always lifts me up when I'm down.",
    "Holding onto this promise tightly today.",
    "The Lord is our refuge and strength. Always.",
    "Nothing is impossible with God. Believe that!",
    "His mercies are new every morning. There's always hope.",
    "Don't give up! God hasn't given up on you!",
    "This verse has gotten me through some dark days.",
    "Encouragement straight from heaven.",
    "When I feel hopeless I come back to verses like this.",
    "God always shows up right when we need Him most.",
    "There is ALWAYS hope in Christ.",
    "This is the hope that anchors my soul.",
    "Keep going. God sees your struggle and He has a plan.",
    "Brighter days ahead. God promised it.",
    "He makes beauty from ashes. Hold on to hope.",
  ],
  'Anxiety & Stress': [
    "Cast all your anxiety on Him. He truly cares.",
    "This is my go-to verse when anxiety hits hard.",
    "God's peace surpasses all understanding.",
    "Needed this badly today. Work has been overwhelming.",
    "When I feel stressed I come back to verses like this.",
    "Giving my worries to God right now.",
    "Be still and know that He is God. Breathing that in.",
    "Anxiety doesn't get the final word. God does.",
    "Taking a deep breath and trusting God with this.",
    "Perfect timing. Going through a lot right now.",
    "Stress is real but so is God's faithfulness.",
    "My anxious thoughts are quieted by His promises.",
    "Come to me all who are weary. I'm coming Lord.",
    "Releasing every worry into His hands right now.",
    "The enemy wants us anxious. God wants us at peace.",
    "Peace over panic. Choosing God today.",
    "Anxiety tried to win today but this verse said no.",
    "Deep breath. God's got this. God's got me.",
    "Stop worrying and start praying. Working on it.",
    "This verse is literally medicine for my mind.",
    "Anyone else feeling anxious today? This verse helps.",
    "Worry changes nothing. Prayer changes everything.",
    "He didn't bring me this far to leave me stressed.",
    "My peace is not dependent on my circumstances. It's in Him.",
    "Laying every burden at His feet tonight.",
  ],
  'Faith & Trust': [
    "Trust in the Lord with all your heart. Working on that daily.",
    "Faith is the substance of things hoped for. So powerful.",
    "Walk by faith not by sight. Easier said than done but so true.",
    "God has never let me down. My trust grows every day.",
    "Faith like a mustard seed can move mountains.",
    "Lord I believe. Help my unbelief!",
    "Trusting God even when I can't see the path ahead.",
    "He is faithful who promised.",
    "When fear creeps in faith pushes it out.",
    "I'm choosing faith over fear today.",
    "His track record proves He can be trusted.",
    "My faith has been tested but never broken.",
    "The righteous shall live by faith. That's my anthem.",
    "Sometimes faith means trusting what you can't see.",
    "God is faithful even when we're faithless.",
    "Building my faith one verse at a time.",
    "Blind faith isn't blind when you know who you're trusting.",
    "Every trial has made my faith stronger.",
    "I don't need to understand. I just need to trust.",
    "Faith over feelings today and every day.",
    "My faith isn't perfect but my God is.",
    "Stepping out in faith this week. Prayers appreciated!",
    "If God said it I believe it. End of story.",
    "Trust the process. Trust the One who started it.",
    "Walking by faith even when the road is dark.",
  ],
  'Healing & Strength': [
    "By His stripes we are healed. Claiming that.",
    "God is our healer and our strength. Always.",
    "Praying for healing for everyone reading this.",
    "His strength is made perfect in our weakness.",
    "I've seen God's healing power firsthand. He is real.",
    "When I am weak then I am strong. Through Christ.",
    "God renews our strength like eagles.",
    "This verse is medicine for the soul.",
    "The Lord is close to the brokenhearted.",
    "I can do all things through Christ who strengthens me.",
    "His healing touch changes everything.",
    "Every day God gives me new strength.",
    "He heals the broken in heart and binds up their wounds.",
    "Believing for breakthrough and healing today.",
    "The Great Physician makes no mistakes.",
    "Drawing strength from His Word this morning.",
    "Praying healing over my family right now.",
    "God's power is greater than any sickness.",
    "Strength for today. Hope for tomorrow.",
    "He carried my pain so I don't have to.",
    "Still healing. Still trusting. Still believing.",
    "Recovery is a journey but God walks with me through it.",
    "Physical healing or spiritual healing — He does both.",
    "Lord strengthen me today. I'm running on empty.",
    "His strength never runs out even when mine does.",
  ],
  'Love & Relationships': [
    "God's love is unfailing and unconditional. What a gift.",
    "Love is patient love is kind. Lord help me love like You.",
    "The greatest of these is love.",
    "God loved us first. That changes everything.",
    "His love never fails never gives up never runs out.",
    "For God so loved the world. The WHOLE world.",
    "Love covers a multitude of sins.",
    "There is no fear in love. Perfect love casts out fear.",
    "Let everything you do be done in love.",
    "Above all love each other deeply.",
    "A cord of three strands is not easily broken.",
    "His love endures forever.",
    "Choosing to love even when it's difficult.",
    "God's love is the foundation of everything good.",
    "I'm so undeserving but so loved.",
    "Love is not a feeling it's a choice. Choosing it today.",
    "Praying for love and unity in my family.",
    "This verse changed how I see relationships.",
    "We love because He first loved us.",
    "Real love looks like Jesus on the cross.",
    "Marriage, family, friendship — love makes it all work.",
    "Lord teach me to love like You do.",
    "We don't deserve His love but He gives it freely.",
    "The world needs more of this kind of love.",
    "Loving people is the best thing we can do.",
  ],
  'Gratitude & Thanksgiving': [
    "Give thanks in all circumstances. Even the hard ones.",
    "My heart is overflowing with gratitude today.",
    "Thank you Lord for every blessing seen and unseen.",
    "A grateful heart changes your whole perspective.",
    "Enter His gates with thanksgiving!",
    "So much to be thankful for.",
    "Every good gift comes from above.",
    "O give thanks unto the Lord for He is good!",
    "Gratitude is the best attitude.",
    "Today I choose gratitude over grumbling.",
    "His faithfulness deserves our thanksgiving every day.",
    "I will bless the Lord at all times.",
    "Thankfulness turns what we have into enough.",
    "Thank you God for another day.",
    "Count your blessings name them one by one.",
    "Praise God from whom all blessings flow!",
    "Woke up thankful. Going to bed thankful.",
    "Even in the hard times there's something to be grateful for.",
    "My gratitude list is longer than my worry list today.",
    "Thank You Father for Your goodness.",
    "A thankful heart is a magnet for miracles.",
    "Grateful doesn't even begin to describe it.",
    "Starting a gratitude journal because of verses like this.",
    "The more I thank God the more I see His blessings.",
    "Thanksgiving isn't just a holiday. It's a lifestyle.",
  ],
  'Forgiveness & Mercy': [
    "His mercies are new every morning.",
    "Forgive as the Lord forgave you. That's the standard.",
    "God's mercy is bigger than any mistake.",
    "Forgiveness isn't easy but it sets us free.",
    "As far as the east is from the west.",
    "Lord help me extend the same mercy You've shown me.",
    "Forgiveness is a daily choice.",
    "If we confess our sins He is faithful and just to forgive.",
    "Mercy triumphs over judgment. Beautiful truth.",
    "Blessed are the merciful.",
    "Forgiveness isn't about them. It's about freedom.",
    "Seventy times seven. That's radical forgiveness.",
    "His compassion never fails.",
    "Who is a God like ours who pardons sin?",
    "I don't deserve mercy but God gives it anyway.",
    "This verse broke chains of unforgiveness in my life.",
    "Letting go of bitterness starting today.",
    "God's forgiveness is complete. Stop revisiting what He's forgiven.",
    "Praying for a heart that forgives quickly.",
    "Forgiveness is a superpower. God gives it freely.",
    "The cross is the ultimate picture of forgiveness.",
    "Holding grudges only hurts us. Time to let go.",
    "Grace upon grace upon grace.",
    "He removes our sins as far as the east is from the west.",
    "Grateful for second chances and a God who gives them.",
  ],
  'Peace & Comfort': [
    "The peace of God guards my heart and mind.",
    "He is our Prince of Peace.",
    "When the storms come His peace anchors me.",
    "Peace I leave with you. Thank you Jesus.",
    "In His presence there is fullness of peace.",
    "God is our comfort in every trouble.",
    "This verse is like a warm blanket for my soul.",
    "Be still and know. Finding peace in the stillness.",
    "Let not your heart be troubled.",
    "The Lord is my shepherd. I have everything I need.",
    "Peace that passes understanding. It's real.",
    "He leads me beside still waters. He restores my soul.",
    "In a chaotic world His peace is my anchor.",
    "Come to me all who are weary. I will give you rest.",
    "So grateful for the Comforter who never leaves.",
    "His peace isn't like the world's peace. It's supernatural.",
    "Finding comfort in knowing God sees everything.",
    "This is my bedtime prayer every night.",
    "Rest for the weary. That's what He offers.",
    "The world gives temporary peace. God gives eternal peace.",
    "Peaceful sleep tonight because of this verse.",
    "When anxiety says panic this verse says peace.",
    "Still waters. Green pastures. A Good Shepherd. Everything I need.",
    "Lord be my peace in this storm.",
    "Breathing in peace. Breathing out worry.",
  ],
  'Wisdom & Guidance': [
    "If any of you lacks wisdom let him ask God.",
    "Lord direct my steps today.",
    "The fear of the Lord is the beginning of wisdom.",
    "Your Word is a lamp to my feet and a light to my path.",
    "Trust in the Lord and lean not on your own understanding.",
    "He will make your paths straight.",
    "Asking for wisdom for some big decisions ahead.",
    "Godly wisdom looks so different from the world's wisdom.",
    "Lord give me eyes to see and ears to hear.",
    "Seeking God first changes how I see everything.",
    "Wisdom is more precious than gold.",
    "When I don't know what to do His Word shows the way.",
    "Praying for discernment in this season.",
    "God's guidance comes through His Word prayer and wise counsel.",
    "Walking in wisdom means walking in obedience.",
    "This verse is my prayer before every big decision.",
    "I need God's wisdom more than my own.",
    "Get wisdom get understanding. Best life advice.",
    "He guides the humble in what is right.",
    "Slow down. Listen. He's speaking.",
    "The wisest thing I ever did was follow Jesus.",
    "Solomon had it right. Wisdom above all else.",
    "Lord show me which way to go.",
    "His counsel stands forever.",
    "Making decisions with His Word as my guide.",
  ],
  'Courage & Overcoming Fear': [
    "Be strong and courageous! The Lord goes before you.",
    "God has not given us a spirit of fear.",
    "I can face anything with God on my side.",
    "Fear not for I am with you.",
    "When I am afraid I put my trust in You.",
    "This verse is my battle cry against fear.",
    "Greater is He who is in me.",
    "Courage isn't the absence of fear. It's trusting God in the fear.",
    "The Lord is my light and my salvation. Whom shall I fear?",
    "Be strong in the Lord and in His mighty power.",
    "No weapon formed against me shall prosper.",
    "God didn't bring me this far to leave me now.",
    "Fear is a liar. God's truth is louder.",
    "If God is for us who can be against us?",
    "The battle belongs to the Lord.",
    "He is my shield my fortress my deliverer.",
    "Perfect love casts out fear.",
    "Have I not commanded you? Be strong and courageous!",
    "Fear knocked at the door. Faith answered. No one was there.",
    "Standing firm on the promises of God.",
    "Scared but doing it anyway because God said go.",
    "The enemy wants me afraid. God wants me bold.",
    "Taking one brave step at a time with Him.",
    "I refuse to let fear steal my destiny.",
    "Brave isn't feeling no fear. Brave is trusting God through it.",
  ],
};

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
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isCleanup = process.argv.includes('--cleanup');
  const conn = await mysql.createConnection(DB_CONFIG);

  if (isCleanup) {
    console.log('--- CLEANUP MODE ---');

    // Get all AI seed users by email pattern
    const [users] = await conn.query(
      "SELECT id FROM users WHERE email LIKE '%@ai-seed.freeluma.internal'"
    );

    if (users.length === 0) {
      console.log('No AI seed users found.');
      await conn.end();
      return;
    }

    const userIds = users.map((u) => u.id);
    console.log(`Found ${userIds.length} AI seed users`);

    // Batch delete in chunks
    const CHUNK = 100;
    let totalRxn = 0, totalCmt = 0;

    for (let i = 0; i < userIds.length; i += CHUNK) {
      const chunk = userIds.slice(i, i + CHUNK);
      const ph = chunk.map(() => '?').join(',');

      const [rxn] = await conn.query(
        `DELETE FROM verse_category_reactions WHERE user_id IN (${ph})`, chunk
      );
      totalRxn += rxn.affectedRows;

      const [cmt] = await conn.query(
        `DELETE FROM verse_category_comments WHERE user_id IN (${ph})`, chunk
      );
      totalCmt += cmt.affectedRows;
    }

    console.log(`Deleted ${totalRxn} verse category reactions`);
    console.log(`Deleted ${totalCmt} verse category comments`);

    // Optionally delete the extra users (not the original 32)
    if (process.argv.includes('--delete-users')) {
      const [del] = await conn.query(
        "DELETE FROM users WHERE email LIKE '%@ai-seed.freeluma.internal' AND id > 31674"
      );
      console.log(`Deleted ${del.affectedRows} extra AI users`);
    }

    console.log('Cleanup complete.');
    await conn.end();
    return;
  }

  // ---- SEED MODE ----
  console.log('--- SEED VERSE CATEGORY ENGAGEMENT (HEAVY) ---');

  // 1. Create AI users
  console.log(`\nCreating ${AI_USERS.length} AI users...`);
  const userIds = [];

  // Batch insert users
  for (const u of AI_USERS) {
    const email = `${u.username}@ai-seed.freeluma.internal`;
    try {
      const [result] = await conn.query(
        `INSERT INTO users (email, display_name, username, avatar_color, mode, email_verified, onboarding_complete, has_seen_tutorial, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())`,
        [email, u.display_name, u.username, u.avatar_color, 'bible']
      );
      userIds.push(result.insertId);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [u.username]);
        if (existing.length) userIds.push(existing[0].id);
      } else {
        console.error(`Error creating ${u.username}: ${err.message}`);
      }
    }
  }

  // Also include the original 32 users
  const [origUsers] = await conn.query(
    "SELECT id FROM users WHERE email LIKE '%@ai-seed.freeluma.internal' AND id BETWEEN 31643 AND 31674"
  );
  for (const u of origUsers) {
    if (!userIds.includes(u.id)) userIds.push(u.id);
  }

  console.log(`Total AI users available: ${userIds.length}`);

  // 2. Get all verses grouped by category
  const [allVerses] = await conn.query(`
    SELECT vcc.id, vcc.category_id, vc.name as category_name
    FROM verse_category_content vcc
    JOIN verse_categories vc ON vc.id = vcc.category_id
    ORDER BY vcc.category_id, vcc.id
  `);

  console.log(`Total verses to seed: ${allVerses.length}`);

  const byCategory = {};
  for (const v of allVerses) {
    if (!byCategory[v.category_name]) byCategory[v.category_name] = [];
    byCategory[v.category_name].push(v.id);
  }

  let totalReactions = 0;
  let totalComments = 0;

  for (const [catName, verseIds] of Object.entries(byCategory)) {
    const catComments = CATEGORY_COMMENTS[catName] || CATEGORY_COMMENTS['Hope & Encouragement'];
    // Merge casual + category-specific for this category
    const allComments = [...CASUAL_COMMENTS, ...catComments];
    let catRxnCount = 0;
    let catCmtCount = 0;

    console.log(`\n[${catName}] — ${verseIds.length} verses`);

    const BATCH_SIZE = 25;

    for (let b = 0; b < verseIds.length; b += BATCH_SIZE) {
      const batch = verseIds.slice(b, b + BATCH_SIZE);

      // --- REACTIONS: 500-1500 per verse ---
      const rxnValues = [];
      const rxnParams = [];

      for (const verseId of batch) {
        const numReactions = randomInt(500, 1500);
        const selectedUsers = shuffle(userIds).slice(0, Math.min(numReactions, userIds.length));

        for (const userId of selectedUsers) {
          const type = randomFrom(REACTION_TYPES);
          rxnValues.push('(?, ?, ?, NOW(), NOW())');
          rxnParams.push(userId, verseId, type);
        }
      }

      // Insert reactions in sub-batches
      if (rxnValues.length > 0) {
        const SUB = 1000;
        for (let s = 0; s < rxnValues.length; s += SUB) {
          const subVals = rxnValues.slice(s, s + SUB);
          const paramStart = s * 3;
          const paramEnd = Math.min((s + SUB) * 3, rxnParams.length);
          const subParams = rxnParams.slice(paramStart, paramEnd);
          try {
            const [result] = await conn.query(
              `INSERT IGNORE INTO verse_category_reactions (user_id, verse_category_content_id, reaction_type, created_at, updated_at) VALUES ${subVals.join(',')}`,
              subParams
            );
            catRxnCount += result.affectedRows;
          } catch (err) {
            console.error(`  Reaction error: ${err.message}`);
          }
        }
      }

      // --- COMMENTS: 15-40 per verse (mix of casual + contextual) ---
      const cmtValues = [];
      const cmtParams = [];

      for (const verseId of batch) {
        const numComments = randomInt(15, 40);
        const usedComments = new Set();

        for (let c = 0; c < numComments; c++) {
          const userId = randomFrom(userIds);
          // Pick a unique comment for this verse
          let body;
          let attempts = 0;
          do {
            body = randomFrom(allComments);
            attempts++;
          } while (usedComments.has(body) && attempts < 50);
          usedComments.add(body);

          cmtValues.push('(?, ?, NULL, ?, 0, NOW(), NOW())');
          cmtParams.push(userId, verseId, body);
        }
      }

      if (cmtValues.length > 0) {
        const SUB = 500;
        for (let s = 0; s < cmtValues.length; s += SUB) {
          const subVals = cmtValues.slice(s, s + SUB);
          const paramStart = s * 3;
          const paramEnd = Math.min((s + SUB) * 3, cmtParams.length);
          const subParams = cmtParams.slice(paramStart, paramEnd);
          try {
            const [result] = await conn.query(
              `INSERT INTO verse_category_comments (user_id, verse_category_content_id, parent_id, body, edited, created_at, updated_at) VALUES ${subVals.join(',')}`,
              subParams
            );
            catCmtCount += result.affectedRows;
          } catch (err) {
            console.error(`  Comment error: ${err.message}`);
          }
        }
      }

      const progress = Math.min(b + BATCH_SIZE, verseIds.length);
      process.stdout.write(`  ${progress}/${verseIds.length} (${catRxnCount.toLocaleString()} rxns, ${catCmtCount.toLocaleString()} cmts)\r`);
    }

    console.log(`  Done: ${catRxnCount.toLocaleString()} reactions, ${catCmtCount.toLocaleString()} comments              `);
    totalReactions += catRxnCount;
    totalComments += catCmtCount;
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`AI users: ${userIds.length}`);
  console.log(`Total reactions: ${totalReactions.toLocaleString()}`);
  console.log(`Total comments: ${totalComments.toLocaleString()}`);
  console.log(`\nCleanup: node scripts/seed-verse-category-engagement.mjs --cleanup`);
  console.log(`Cleanup + delete extra users: node scripts/seed-verse-category-engagement.mjs --cleanup --delete-users`);

  await conn.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
