/**
 * AI Church Researcher — Claude-powered structured profile generation
 *
 * Takes scraped website data + Google Places data and uses Claude to
 * extract a structured church profile (pastor, staff, denomination,
 * programs, service times, contacts, summary).
 *
 * Falls back to scraped data only when ANTHROPIC_API_KEY is not set.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedData } from './scraper';
import type { PlacesResult } from './google-places';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurchResearchResult {
  pastor_name: string | null;
  staff_names: string[];
  denomination: string | null;
  congregation_size_estimate: string | null;
  youth_programs: string[];
  service_times: string[];
  social_media: Record<string, string>;
  contact_email: string | null;
  contact_phone: string | null;
  summary: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildResearchPrompt(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): string {
  return `Analyze this church's website content and produce a structured profile.

Church name: ${placesData.name}
Address: ${placesData.address}
Google rating: ${placesData.rating ?? 'N/A'} (${placesData.ratingCount ?? 0} reviews)

Website content:
${scrapedData.bodyText}

Found emails: ${scrapedData.emails.join(', ') || 'None found'}
Found phones: ${scrapedData.phones.join(', ') || 'None found'}
Social media links: ${Object.entries(scrapedData.socialMedia).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None found'}

Extract and return as JSON:
{
  "pastor_name": "string or null — senior/lead pastor name only",
  "staff_names": ["other staff member names found"],
  "denomination": "string or null — e.g., Baptist, Methodist, Non-denominational",
  "congregation_size_estimate": "string or null — e.g., 'small (<100)', 'medium (100-500)', 'large (500+)'",
  "youth_programs": ["specific youth program names like AWANA, VBS, Youth Night, etc."],
  "service_times": ["e.g., 'Sunday 9:00 AM', 'Sunday 11:00 AM', 'Wednesday 7:00 PM'"],
  "social_media": {"facebook": "url", "instagram": "url", "twitter": "url", "youtube": "url"},
  "contact_email": "string or null — primary contact email",
  "contact_phone": "string or null — primary contact phone",
  "summary": "2-3 sentence summary of church's focus areas, community involvement, and ministry style"
}

Important:
- Use null for data that is NOT clearly stated on the website. Be conservative.
- Only extract information that is explicitly mentioned, do not infer or guess.
- For youth_programs, specifically look for: AWANA, VBS (Vacation Bible School), Youth Night, Sunday School, Kids Ministry, Student Ministry.
- Return ONLY valid JSON, no other text.`;
}

// ---------------------------------------------------------------------------
// Fallback (no API key)
// ---------------------------------------------------------------------------

/**
 * Build a minimal research result from scraped data when AI is unavailable.
 */
function buildFallbackResult(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): ChurchResearchResult {
  return {
    pastor_name: null,
    staff_names: [],
    denomination: null,
    congregation_size_estimate: null,
    youth_programs: [],
    service_times: [],
    social_media: scrapedData.socialMedia,
    contact_email: scrapedData.emails[0] || null,
    contact_phone: scrapedData.phones[0] || placesData.phone || null,
    summary: scrapedData.metaDescription || `${placesData.name} located at ${placesData.address}.`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Research a church using Claude AI to generate a structured profile.
 *
 * If ANTHROPIC_API_KEY is not set, returns a minimal profile from scraped data.
 * If AI response parsing fails, falls back to scraped data.
 */
export async function researchChurch(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): Promise<ChurchResearchResult> {
  // Graceful degradation: skip AI if no API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      '[ai-researcher] ANTHROPIC_API_KEY not configured. Returning scraped data only.'
    );
    return buildFallbackResult(scrapedData, placesData);
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: buildResearchPrompt(scrapedData, placesData),
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

    // Validate and normalize the parsed result
    return {
      pastor_name: parsed.pastor_name ?? null,
      staff_names: Array.isArray(parsed.staff_names) ? parsed.staff_names.map(String) : [],
      denomination: parsed.denomination ?? null,
      congregation_size_estimate: parsed.congregation_size_estimate ?? null,
      youth_programs: Array.isArray(parsed.youth_programs) ? parsed.youth_programs.map(String) : [],
      service_times: Array.isArray(parsed.service_times) ? parsed.service_times.map(String) : [],
      social_media: typeof parsed.social_media === 'object' && parsed.social_media !== null
        ? parsed.social_media
        : scrapedData.socialMedia,
      contact_email: parsed.contact_email ?? scrapedData.emails[0] ?? null,
      contact_phone: parsed.contact_phone ?? scrapedData.phones[0] ?? placesData.phone ?? null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch (err) {
    // Fallback on any error (API failure, JSON parse, etc.)
    console.warn(
      '[ai-researcher] AI research failed, returning scraped data only:',
      err instanceof Error ? err.message : err
    );
    return buildFallbackResult(scrapedData, placesData);
  }
}
