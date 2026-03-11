/**
 * AI Email Writer — Claude-powered personalized outreach email generation
 *
 * Takes a church profile, email template (as tone/structure reference), and step
 * context, then uses Claude to write a warm, personalized email referencing
 * specific details about the church.
 *
 * Falls back to template-rendered version if Claude API is unavailable.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurchProfile {
  name: string;
  pastor_name: string | null;
  denomination: string | null;
  congregation_size_estimate: string | null;
  city: string | null;
  state: string | null;
  youth_programs: string[] | string | null;
  ai_summary: string | null;
  outreach_fit_score: number | null;
  outreach_fit_reason: string | null;
  has_youth_ministry: boolean;
  has_young_adult_ministry: boolean;
  has_small_groups: boolean;
  has_missions_focus: boolean;
}

export interface StepContext {
  stepOrder: number;
  totalSteps: number;
  sequenceName: string;
}

export interface AIEmailResult {
  subject: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildEmailPrompt(
  church: ChurchProfile,
  templateSubject: string,
  _templateHtml: string,
  _stepContext: StepContext,
  freelumaContext: string,
  _assets?: Record<string, string> | null,
): string {
  const youthPrograms = Array.isArray(church.youth_programs)
    ? church.youth_programs.join(', ')
    : (church.youth_programs || 'None listed');

  const ministryFlags = [
    church.has_youth_ministry && 'Youth Ministry',
    church.has_young_adult_ministry && 'Young Adult Ministry',
    church.has_small_groups && 'Small Groups',
    church.has_missions_focus && 'Missions Focus',
  ].filter(Boolean).join(', ') || 'None identified';

  return `Write a personalized paragraph (3-5 sentences) explaining why Free Luma Bracelets would be a great fit for this specific church. This paragraph will be inserted into an existing email template right after the greeting — you are NOT writing the full email.

## About Free Luma
${freelumaContext}

## Church Research
- **Name:** ${church.name}
- **Pastor:** ${church.pastor_name || 'Unknown'}
- **Denomination:** ${church.denomination || 'Unknown'}
- **Size:** ${church.congregation_size_estimate || 'Unknown'}
- **Location:** ${church.city || 'Unknown'}, ${church.state || ''}
- **Youth Programs:** ${youthPrograms}
- **Ministries:** ${ministryFlags}
${church.ai_summary ? `- **AI Research Summary:** ${church.ai_summary}` : ''}
${church.outreach_fit_reason ? `- **Why They're a Good Fit:** ${church.outreach_fit_reason}` : ''}

## Instructions
Write a paragraph that:
1. **Mentions specific things you know about this church** — reference their programs by name (e.g. "your AWANA program", "your student ministry", "your small groups"), their denomination or values, their community involvement, or anything from the summary.
2. **Connects those specifics to Free Luma** — explain how the bracelets with daily scripture would complement what they already do.
3. **Sounds personal and genuine** — like someone who actually researched this church, not a mail merge.

BAD example (too generic): "I believe Free Luma Bracelets could be a meaningful addition to your ministry."
GOOD example: "I noticed your church runs an active youth group and AWANA program — Free Luma bracelets give students a daily touchpoint with scripture right on their wrist, which could be a perfect complement to what you're already building into their lives."

Return ONLY valid JSON:
{"subject": "${templateSubject}", "paragraph": "Your personalized paragraph here."}

- Keep subject as-is or personalize slightly (under 100 chars)
- The paragraph is plain text, no HTML
- 3-5 sentences
- You MUST reference at least one specific detail about the church
- Return ONLY the JSON`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a personalized outreach email using Claude AI.
 *
 * Falls back to template-rendered content if ANTHROPIC_API_KEY is not set
 * or if the AI call fails.
 */
export async function generatePersonalizedEmail(
  church: ChurchProfile,
  templateSubject: string,
  templateHtml: string,
  stepContext: StepContext,
  assets?: Record<string, string> | null,
): Promise<AIEmailResult> {
  const { PlatformSetting } = await import('@/lib/db/models');

  // Load FreeLuma context from platform settings
  const freelumaContext = await PlatformSetting.get('outreach_freeluma_context') ||
    'Free Luma is a faith-based bracelet ministry that has distributed over 600,000 bracelets worldwide with QR codes connecting wearers to daily inspirational content.';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[ai-email-writer] ANTHROPIC_API_KEY not configured. Using template fallback.');
    return { subject: templateSubject, html: templateHtml };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: buildEmailPrompt(church, templateSubject, templateHtml, stepContext, freelumaContext, assets),
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON — strip markdown code fences if present
    const raw = block.text.trim();
    const jsonStr = raw.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);

    if (!parsed.subject || !parsed.paragraph) {
      throw new Error('AI response missing subject or paragraph fields');
    }

    // Insert the personalized paragraph into the template HTML.
    // Find the <!-- Hero image --> marker and insert right before it.
    const heroMarker = '<!-- Hero image -->';
    const heroIdx = templateHtml.indexOf(heroMarker);

    const pTag = `<p style="line-height:1.7;font-size:15px;">${parsed.paragraph}</p>`;

    let aiHtml: string;
    if (heroIdx !== -1) {
      // Insert personalized paragraph just before the hero image
      aiHtml = templateHtml.slice(0, heroIdx) + pTag + '\n\n    ' + templateHtml.slice(heroIdx);
    } else {
      // Fallback: append after the second </p> (after generic intro)
      let secondP = templateHtml.indexOf('</p>');
      if (secondP !== -1) secondP = templateHtml.indexOf('</p>', secondP + 4);
      if (secondP !== -1) {
        const insertAt = secondP + 4;
        aiHtml = templateHtml.slice(0, insertAt) + '\n\n    ' + pTag + templateHtml.slice(insertAt);
      } else {
        aiHtml = templateHtml;
      }
    }

    return {
      subject: String(parsed.subject).slice(0, 500),
      html: aiHtml,
    };
  } catch (err) {
    console.warn(
      '[ai-email-writer] AI email generation failed, using template fallback:',
      err instanceof Error ? err.message : err
    );
    return { subject: templateSubject, html: templateHtml };
  }
}
