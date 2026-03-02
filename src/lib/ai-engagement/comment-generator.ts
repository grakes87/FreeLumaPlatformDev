/**
 * AI Comment Generator — uses Claude to produce realistic engagement comments.
 *
 * Batches multiple content items per Claude call for efficiency.
 * Returns raw comment strings; caller assigns users and timestamps.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GenerateTarget, EngagementTargetType } from './types';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured.');
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildBiblePrompt(targets: GenerateTarget[], commentsPerItem: number): string {
  const items = targets
    .map(
      (t, i) =>
        `Item ${i + 1} (id=${t.content_id}): ${t.verse_reference} — "${t.content_text}"`
    )
    .join('\n');

  return `Generate ${commentsPerItem} unique social media comments for EACH of the following Bible verses. These comments will appear on a faith-based daily devotional app.

${items}

For each item, produce a mix of:
- Short casual reactions: "Amen!", "So good!", "Needed this today.", "This verse hits different"
- Contextual comments referencing the specific verse meaning (1-2 sentences)
- Occasional personal testimony style: "I was going through a tough time and this verse reminded me..."

Requirements:
- Vary length: some very short (2-5 words), some medium (1 sentence), some longer (2 sentences max)
- Sound like real people on social media, not formal or academic
- Use natural language with occasional emojis (sparingly, max 1-2 per comment)
- Each comment should be unique — no duplicates across items
- Do NOT use hashtags

Return a JSON object where keys are the item IDs and values are arrays of comment strings.
Example: {"730": ["Amen! 🙏", "This verse speaks to me deeply..."], "732": ["So powerful!", ...]}

Return ONLY the JSON, no other text.`;
}

function buildPositivityPrompt(targets: GenerateTarget[], commentsPerItem: number): string {
  const items = targets
    .map(
      (t, i) =>
        `Item ${i + 1} (id=${t.content_id}): "${t.content_text}"`
    )
    .join('\n');

  return `Generate ${commentsPerItem} unique social media comments for EACH of the following motivational/positivity quotes. These comments will appear on an inspirational daily content app.

${items}

For each item, produce a mix of:
- Short casual reactions: "So true!", "This hit different 💯", "Needed to hear this", "Facts!"
- Thoughtful reflections connecting the quote to real life (1-2 sentences)
- Personal resonance: "I've been struggling with this lately and this is exactly what I needed"

Requirements:
- Vary length: some very short (2-5 words), some medium (1 sentence), some longer (2 sentences max)
- Sound like real people on social media, NOT religious (this is positivity, not faith content)
- Use natural language with occasional emojis (sparingly, max 1-2 per comment)
- Each comment should be unique — no duplicates across items
- Do NOT use hashtags

Return a JSON object where keys are the item IDs and values are arrays of comment strings.
Example: {"730": ["So true!", "This really speaks to where I am right now..."], "732": ["Love this!", ...]}

Return ONLY the JSON, no other text.`;
}

function buildVerseCategoryPrompt(targets: GenerateTarget[], commentsPerItem: number): string {
  const items = targets
    .map(
      (t, i) =>
        `Item ${i + 1} (id=${t.content_id}): ${t.verse_reference} — "${t.content_text}" [Category: ${t.category_name}]`
    )
    .join('\n');

  return `Generate ${commentsPerItem} unique social media comments for EACH of the following Bible verses organized by life topic/category. These comments will appear on a faith-based app under category pages (e.g., Hope, Anxiety, Love).

${items}

For each item, produce a mix of:
- Short reactions: "Amen!", "This is beautiful 🙏", "Bookmarked!"
- Comments connecting the verse to the category theme (e.g., if the category is "Anxiety", comment about finding peace)
- Personal application: "When I feel anxious, I come back to this verse..."

Requirements:
- Vary length: some very short (2-5 words), some medium (1 sentence), some longer (2 sentences max)
- Sound like real people on social media, not formal
- Connect comments to both the verse AND its category theme
- Use natural language with occasional emojis (sparingly, max 1-2 per comment)
- Each comment should be unique
- Do NOT use hashtags

Return a JSON object where keys are the item IDs and values are arrays of comment strings.
Example: {"5": ["This verse gives me so much hope 🙏", "Exactly what I needed..."], "12": ["Beautiful!", ...]}

Return ONLY the JSON, no other text.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate comments for a batch of content items (max ~3 items per call for quality).
 * Returns a map of content_id → string[].
 */
export async function generateComments(
  type: EngagementTargetType,
  targets: GenerateTarget[],
  commentsPerItem: number
): Promise<Map<number, string[]>> {
  const client = getClient();

  let prompt: string;
  if (type === 'verse-category') {
    prompt = buildVerseCategoryPrompt(targets, commentsPerItem);
  } else if (targets[0]?.mode === 'positivity') {
    prompt = buildPositivityPrompt(targets, commentsPerItem);
  } else {
    prompt = buildBiblePrompt(targets, commentsPerItem);
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude response did not contain a text block.');
  }

  const raw = block.text.trim();

  // Parse JSON — try direct parse first, then extract from markdown code block
  const result = new Map<number, string[]>();
  try {
    const parsed = JSON.parse(raw.replace(/^```json?\s*/, '').replace(/\s*```$/, ''));
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result.set(Number(key), value.map(String));
      }
    }
  } catch {
    // Fallback: split by newlines and assign evenly
    console.warn('[comment-generator] JSON parse failed, falling back to text split');
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^[-*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('{') && !l.startsWith('}'));

    const perItem = Math.max(1, Math.floor(lines.length / targets.length));
    targets.forEach((t, i) => {
      result.set(t.content_id, lines.slice(i * perItem, (i + 1) * perItem));
    });
  }

  return result;
}
