/**
 * AI Text Generation Module
 *
 * Uses Claude API (Anthropic) to generate all text content for the daily
 * content pipeline: positivity quotes, devotional reflections, camera scripts,
 * meditation scripts, and background video prompts.
 *
 * Each function is a focused, testable unit that the pipeline runner orchestrates.
 * API key comes from process.env.ANTHROPIC_API_KEY (env-level, not PlatformSetting).
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

/**
 * Create an Anthropic client using the ANTHROPIC_API_KEY env var.
 * Throws if the key is not set.
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not configured. Set it in your environment variables.'
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Extract text content from Claude's response.
 */
function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude response did not contain a text block.');
  }
  return block.text.trim();
}

/**
 * Generate an original positivity/motivational quote.
 *
 * Returns 1-3 sentences of original, uplifting content suitable for
 * a daily devotional app. Draws thematic inspiration from famous
 * motivational speakers and thought leaders. Checks existing quotes
 * to ensure uniqueness.
 *
 * @param existingQuotes - Previously generated quotes to avoid repetition
 */
export async function generatePositivityQuote(
  existingQuotes: string[] = []
): Promise<string> {
  const client = getClient();

  // Build dedup context — include up to 30 recent quotes so the model avoids them
  const dedupBlock =
    existingQuotes.length > 0
      ? `\n\nIMPORTANT — The following quotes have ALREADY been used. Your new quote must be completely DIFFERENT in both wording and theme from ALL of these:\n\n${existingQuotes
          .slice(-30)
          .map((q, i) => `${i + 1}. "${q}"`)
          .join('\n')}\n`
      : '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `Write an original motivational and inspirational message (1-3 sentences).

Draw thematic inspiration from the teachings and styles of motivational speakers and thought leaders like:
- Tony Robbins (personal power, taking massive action, state management)
- Brené Brown (vulnerability, courage, worthiness, shame resilience)
- Les Brown (believing in yourself, overcoming limitations, "it's possible")
- Simon Sinek (purpose, starting with why, leadership)
- Mel Robbins (the 5-second rule, confidence, habits)
- Jay Shetty (mindfulness, purpose, relationships, monk wisdom)
- Inky Johnson (perseverance through adversity, gratitude, purpose)
- Lisa Nichols (self-worth, abundance mindset, personal transformation)
- Eric Thomas (hustle, discipline, "when you want to succeed as bad as you want to breathe")
- Brendon Burchard (high performance, clarity, energy, productivity)
- Oprah Winfrey (living your best life, self-discovery, gratitude)
- Wayne Dyer (intention, manifesting, inner peace)
- Deepak Chopra (mindfulness, consciousness, inner healing)

Each day, pick a DIFFERENT theme. Rotate through topics like:
discipline, self-belief, gratitude, resilience, taking action, vulnerability,
purpose, mindfulness, letting go, courage, growth mindset, abundance,
self-love, perseverance, living in the present, relationships, forgiveness,
leadership, habit building, overcoming fear, inner peace, compassion.
${dedupBlock}
Requirements:
- Must be ORIGINAL — do NOT copy or closely paraphrase any famous quotes
- Capture the SPIRIT and energy of motivational speaking, not exact words
- Positive, uplifting, and encouraging tone
- Suitable for a daily inspirational app (NOT religious — this is about positivity)
- Simple and accessible language — not academic or preachy
- Each message should feel fresh and cover a different angle than previous days
- Return ONLY the quote text, no attribution, no quotation marks, no preamble`,
      },
    ],
  });

  return extractText(response);
}

/**
 * Generate a devotional reflection on a Bible verse.
 *
 * Returns 4-6 sentences with a warm, accessible tone suitable for
 * daily meditation and spiritual growth.
 */
export async function generateDevotionalReflection(
  verseReference: string,
  verseText: string
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `Write a devotional reflection on this Bible verse:

${verseReference}: "${verseText}"

Requirements:
- 4-6 sentences
- Warm, accessible, and encouraging tone
- Suitable for daily meditation and spiritual growth
- Connect the verse to everyday life experiences
- Offer practical encouragement or insight
- Do NOT start with "This verse..." -- vary your openings
- Return ONLY the reflection text, no headings or labels`,
      },
    ],
  });

  return extractText(response);
}

/**
 * Generate a ~45-second camera/talking-head script.
 *
 * For 'bible' mode: provides context and insight on the verse.
 * For 'positivity' mode: expands on the motivational quote.
 * Target: ~110-120 words (approximately 45 seconds when read aloud).
 */
export async function generateCameraScript(
  mode: 'bible' | 'positivity',
  content: {
    verseReference?: string;
    verseText?: string;
    quote?: string;
  }
): Promise<string> {
  const client = getClient();

  const contextBlock =
    mode === 'bible'
      ? `Bible verse -- ${content.verseReference}: "${content.verseText}"`
      : `Positivity quote: "${content.quote}"`;

  const focusBlock =
    mode === 'bible'
      ? 'Provide deeper context on this verse -- historical background, what it meant to the original audience, and why it matters today.'
      : 'Expand on this quote -- unpack its meaning, share a relatable scenario, and leave the viewer with an actionable takeaway.';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `Write a spoken camera script (~45 seconds, approximately 110-120 words).

Content: ${contextBlock}

Focus: ${focusBlock}

Requirements:
- Conversational and warm tone, like a friend sharing an insight over coffee
- Written for SPEAKING, not reading -- use natural speech patterns
- No stage directions, no "[pause]" markers, no formatting
- Start with a hook that grabs attention (question, surprising fact, or bold statement)
- End with a memorable closing thought
- Approximately 110-120 words (45 seconds read aloud)
- Return ONLY the script text, nothing else`,
      },
    ],
  });

  return extractText(response);
}

/**
 * Generate a ~1-minute guided meditation script.
 *
 * Structure: opening breath -> visualization -> affirmation -> closing.
 * Target: ~150-160 words (approximately 1 minute when read aloud slowly).
 */
export async function generateMeditationScript(
  mode: 'bible' | 'positivity',
  content: {
    verseReference?: string;
    verseText?: string;
    quote?: string;
  }
): Promise<string> {
  const client = getClient();

  const contextBlock =
    mode === 'bible'
      ? `Bible verse -- ${content.verseReference}: "${content.verseText}"`
      : `Positivity quote: "${content.quote}"`;

  const themeBlock =
    mode === 'bible'
      ? 'Draw the meditation theme from the spiritual truth in this verse.'
      : 'Draw the meditation theme from the core message of this quote.';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `Write a guided meditation script (~1 minute, approximately 150-160 words).

Content: ${contextBlock}

${themeBlock}

Structure (follow this order):
1. OPENING BREATH: Gentle instruction to close eyes and take a deep breath
2. VISUALIZATION: Paint a calming mental image connected to the theme
3. AFFIRMATION: A positive declaration the listener can internalize
4. CLOSING: Gentle return to awareness with encouragement

Requirements:
- Slow, soothing, contemplative tone
- Written for spoken delivery -- natural pauses between sections
- No section labels or headings in the output
- No stage directions like "[breathe]" or "[pause]"
- Use "you" to speak directly to the listener
- Approximately 150-160 words (1 minute when read slowly)
- Return ONLY the meditation script text, nothing else`,
      },
    ],
  });

  return extractText(response);
}

/**
 * Generate a cinematic background video prompt.
 *
 * Returns a detailed prompt suitable for AI video generation (Sora/Veo).
 * Must NOT include people -- scenery and nature only.
 */
export async function generateBackgroundPrompt(
  mode: 'bible' | 'positivity',
  content: {
    verseReference?: string;
    verseText?: string;
    quote?: string;
  }
): Promise<string> {
  const client = getClient();

  const contextBlock =
    mode === 'bible'
      ? `Bible verse -- ${content.verseReference}: "${content.verseText}"`
      : `Positivity quote: "${content.quote}"`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `Write a detailed cinematic video prompt for an AI video generator (like Sora or Veo).

The video should evoke the mood and theme of this content:
${contextBlock}

Requirements:
- Describe a beautiful, cinematic SCENERY shot (nature, landscapes, architecture, sky)
- ABSOLUTELY NO PEOPLE -- no faces, no hands, no silhouettes, no crowds
- Include specific details: camera movement (slow dolly, aerial, tracking), lighting (golden hour, misty dawn, soft backlight), color palette, mood
- Describe motion: flowing water, rustling leaves, drifting clouds, flickering candles, etc.
- 2-4 sentences, vivid and precise
- Suitable as a looping or slow background video behind text overlay
- Return ONLY the video prompt, no preamble or explanation`,
      },
    ],
  });

  return extractText(response);
}
