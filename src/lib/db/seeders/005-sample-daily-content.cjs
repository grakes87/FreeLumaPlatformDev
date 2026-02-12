'use strict';

/**
 * Seeder: Sample daily content for 8 days (today + 7 past days).
 * Creates bible and positivity mode content with KJV translations.
 */
module.exports = {
  async up(queryInterface) {
    // Generate dates for today and the past 7 days
    const dates = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // Bible mode daily content (8 days)
    const bibleContent = [
      {
        title: 'Daily Verse',
        content_text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        verse_reference: 'John 3:16',
        chapter_reference: 'John 3',
      },
      {
        title: 'Daily Verse',
        content_text: 'The Lord is my shepherd; I shall not want.',
        verse_reference: 'Psalm 23:1',
        chapter_reference: 'Psalm 23',
      },
      {
        title: 'Daily Verse',
        content_text: 'I can do all things through Christ which strengtheneth me.',
        verse_reference: 'Philippians 4:13',
        chapter_reference: 'Philippians 4',
      },
      {
        title: 'Daily Verse',
        content_text: 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.',
        verse_reference: 'Proverbs 3:5',
        chapter_reference: 'Proverbs 3',
      },
      {
        title: 'Daily Verse',
        content_text: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.',
        verse_reference: 'Joshua 1:9',
        chapter_reference: 'Joshua 1',
      },
      {
        title: 'Daily Verse',
        content_text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
        verse_reference: 'Romans 8:28',
        chapter_reference: 'Romans 8',
      },
      {
        title: 'Daily Verse',
        content_text: 'But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
        verse_reference: 'Isaiah 40:31',
        chapter_reference: 'Isaiah 40',
      },
      {
        title: 'Daily Verse',
        content_text: 'The Lord bless thee, and keep thee: The Lord make his face shine upon thee, and be gracious unto thee.',
        verse_reference: 'Numbers 6:24-25',
        chapter_reference: 'Numbers 6',
      },
    ];

    // Positivity mode daily content (8 days)
    const positivityContent = [
      {
        title: 'Daily Inspiration',
        content_text: 'The only way to do great work is to love what you do.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'Believe you can and you are halfway there.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'In the middle of every difficulty lies opportunity.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'The future belongs to those who believe in the beauty of their dreams.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'Happiness is not something ready made. It comes from your own actions.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'What you get by achieving your goals is not as important as what you become by achieving your goals.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'Start where you are. Use what you have. Do what you can.',
      },
      {
        title: 'Daily Inspiration',
        content_text: 'Every moment is a fresh beginning. Take a deep breath, smile, and start again.',
      },
    ];

    const now = new Date();

    // Insert bible mode content
    const bibleRecords = dates.map((date, i) => ({
      post_date: date,
      mode: 'bible',
      title: bibleContent[i].title,
      content_text: bibleContent[i].content_text,
      verse_reference: bibleContent[i].verse_reference,
      chapter_reference: bibleContent[i].chapter_reference,
      video_background_url: '',
      audio_url: null,
      audio_srt_url: null,
      lumashort_video_url: null,
      language: 'en',
      published: true,
      created_at: now,
      updated_at: now,
    }));

    // Insert positivity mode content
    const positivityRecords = dates.map((date, i) => ({
      post_date: date,
      mode: 'positivity',
      title: positivityContent[i].title,
      content_text: positivityContent[i].content_text,
      verse_reference: null,
      chapter_reference: null,
      video_background_url: '',
      audio_url: null,
      audio_srt_url: null,
      lumashort_video_url: null,
      language: 'en',
      published: true,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('daily_content', [
      ...bibleRecords,
      ...positivityRecords,
    ]);

    // Now insert KJV translations for bible content
    // We need to fetch the IDs of the just-inserted records
    const [insertedBible] = await queryInterface.sequelize.query(
      "SELECT id, post_date, content_text FROM daily_content WHERE mode = 'bible' AND language = 'en' ORDER BY post_date ASC"
    );

    const translationRecords = insertedBible.map((record) => ({
      daily_content_id: record.id,
      translation_code: 'KJV',
      translated_text: record.content_text,
      verse_reference: null,
      source: 'database',
      created_at: now,
      updated_at: now,
    }));

    if (translationRecords.length > 0) {
      await queryInterface.bulkInsert('daily_content_translations', translationRecords);
    }
  },

  async down(queryInterface) {
    // Remove translations first (FK constraint)
    await queryInterface.bulkDelete('daily_content_translations', null, {});
    await queryInterface.bulkDelete('daily_content', null, {});
  },
};
