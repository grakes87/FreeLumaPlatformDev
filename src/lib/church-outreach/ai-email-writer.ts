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
  templateHtml: string,
  stepContext: StepContext,
  freelumaContext: string,
  assets?: Record<string, string> | null,
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

  return `You are writing a personalized outreach email for Free Luma Bracelets to a church.

## About Free Luma
${freelumaContext}

## Church Profile
- **Name:** ${church.name}
- **Pastor:** ${church.pastor_name || 'Unknown'}
- **Denomination:** ${church.denomination || 'Unknown'}
- **Size:** ${church.congregation_size_estimate || 'Unknown'}
- **Location:** ${church.city || 'Unknown'}, ${church.state || ''}
- **Youth Programs:** ${youthPrograms}
- **Ministry Flags:** ${ministryFlags}
- **Fit Score:** ${church.outreach_fit_score ?? 'N/A'}/10
- **Fit Reason:** ${church.outreach_fit_reason || 'N/A'}
- **AI Summary:** ${church.ai_summary || 'No summary available'}

## Email Context
This is step ${stepContext.stepOrder} of ${stepContext.totalSteps} in the "${stepContext.sequenceName}" drip sequence.

## Reference Template (for tone and structure guidance)
Subject: ${templateSubject}
---
${templateHtml}
---

${assets && Object.keys(assets).length > 0 ? `## Asset URLs (use these exact URLs for images in the email)
${Object.entries(assets).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}

` : ''}## Instructions
Write a personalized email that:
1. References specific details about this church (pastor name, programs, denomination, community involvement)
2. Connects Free Luma's bracelet ministry to their specific needs and programs
3. Feels warm, genuine, and not mass-produced
4. Keeps a similar structure and length to the template above
5. Uses professional but friendly tone — church-to-church partnership feel
6. If pastor name is known, address them directly
7. For step 1: introduce Free Luma. For later steps: follow up naturally, reference the previous outreach

Return ONLY valid JSON with exactly two fields:
{
  "subject": "Personalized email subject line",
  "html": "<p>Full HTML email body...</p>"
}

Important:
- The html should use simple HTML (p, strong, br, a tags) suitable for email clients
- Do NOT include any header/footer/unsubscribe — those are added automatically
- Keep subject under 100 characters
- Return ONLY the JSON, no other text`;
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

    if (!parsed.subject || !parsed.html) {
      throw new Error('AI response missing subject or html fields');
    }

    return {
      subject: String(parsed.subject).slice(0, 500),
      html: String(parsed.html),
    };
  } catch (err) {
    console.warn(
      '[ai-email-writer] AI email generation failed, using template fallback:',
      err instanceof Error ? err.message : err
    );
    return { subject: templateSubject, html: templateHtml };
  }
}
