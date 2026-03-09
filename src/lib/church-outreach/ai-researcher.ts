/**
 * AI Church Researcher — Claude-powered deep profile generation
 *
 * Takes scraped website data (homepage + subpages) + Google Places data and
 * uses Claude to build a comprehensive church profile including leadership,
 * denomination, programs, demographics, and outreach fit assessment.
 *
 * Falls back to scraped data only when ANTHROPIC_API_KEY is not set.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedData } from './scraper';
import type { PlacesResult } from './google-places';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 3000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurchResearchResult {
  pastor_name: string | null;
  pastor_email: string | null;
  staff_members: { name: string; role: string }[];
  denomination: string | null;
  congregation_size_estimate: string | null;
  youth_programs: string[];
  service_times: string[];
  social_media: Record<string, string>;
  contact_email: string | null;
  contact_phone: string | null;
  website_quality: 'professional' | 'basic' | 'outdated' | 'unknown';
  has_youth_ministry: boolean;
  has_young_adult_ministry: boolean;
  has_small_groups: boolean;
  has_missions_focus: boolean;
  community_involvement: string[];
  outreach_fit_score: number; // 1-10 how good a fit for FreeLuma bracelet partnership
  outreach_fit_reason: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildResearchPrompt(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): string {
  return `You are a church outreach researcher for FreeLuma, a Christian bracelet ministry app. Analyze this church's website content thoroughly and produce a detailed profile to help us decide if this church is a good outreach partner.

## Church Basic Info
- **Name:** ${placesData.name}
- **Address:** ${placesData.address}
- **Google Rating:** ${placesData.rating ?? 'N/A'} (${placesData.ratingCount ?? 0} reviews)
- **Phone from Google:** ${placesData.phone ?? 'None'}
- **Website:** ${placesData.website ?? 'None'}

## Website Content (${scrapedData.pagesScraped} pages scraped)
${scrapedData.bodyText}

## Contact Info Found on Website
- **Emails:** ${scrapedData.emails.join(', ') || 'None found'}
- **Phones:** ${scrapedData.phones.join(', ') || 'None found'}
- **Social Media:** ${Object.entries(scrapedData.socialMedia).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None found'}

## Your Task
Extract as much as you can. Use context clues — if the website mentions "Pastor John leads our congregation of 200 families", extract the pastor name AND estimate congregation size. If there's a staff page with names and titles, list ALL of them. Look for clues about church culture, programs, and community involvement.

Return JSON:
{
  "pastor_name": "Full name of lead/senior pastor, or null",
  "pastor_email": "Pastor's direct email if found, or null",
  "staff_members": [{"name": "Full Name", "role": "Their title/role"}],
  "denomination": "e.g. Baptist, Methodist, Non-denominational, Pentecostal, Catholic, etc. Infer from affiliations, network membership, or doctrinal statements if not explicit",
  "congregation_size_estimate": "e.g. 'Small (~50-100)', 'Medium (~200-500)', 'Large (~500-1000)', 'Mega (1000+)'. Infer from building photos, number of services, staff size, parking lot mentions, campus descriptions",
  "youth_programs": ["List ALL youth/children programs: VBS, AWANA, Youth Group, Kids Church, Student Ministry, Sunday School, etc."],
  "service_times": ["e.g. 'Sunday 9:00 AM', 'Sunday 11:00 AM', 'Wednesday 7:00 PM'"],
  "social_media": {"facebook": "url", "instagram": "url", "twitter": "url", "youtube": "url"},
  "contact_email": "Best general contact email",
  "contact_phone": "Best contact phone",
  "website_quality": "professional | basic | outdated | unknown — based on content freshness, design mentions, recent dates",
  "has_youth_ministry": true/false,
  "has_young_adult_ministry": true/false,
  "has_small_groups": true/false,
  "has_missions_focus": true/false,
  "community_involvement": ["List community activities: food bank, homeless outreach, prison ministry, etc."],
  "outreach_fit_score": 1-10,
  "outreach_fit_reason": "2-3 sentences explaining why this church is/isn't a good fit for FreeLuma bracelet ministry partnership. Consider: do they have youth programs, are they community-focused, do they seem open to partnerships, how active are they?",
  "summary": "3-5 sentence comprehensive summary of this church — who they are, what they focus on, their size and vibe, what makes them unique. Write this as if briefing someone who's about to call them."
}

Important:
- Fill in EVERY field. Use your best inference when data isn't explicit — a church with 5 staff members and 3 Sunday services is probably medium-to-large.
- For staff_members, include EVERYONE you can find — pastors, worship leaders, youth directors, office managers, etc.
- For denomination, look for network affiliations (SBC, AG, EFCA, etc.), doctrinal clues, or worship style hints.
- The outreach_fit_score should be higher for churches with active youth programs, community involvement, and a welcoming culture.
- Return ONLY valid JSON, no other text.`;
}

// ---------------------------------------------------------------------------
// Fallback (no API key)
// ---------------------------------------------------------------------------

function buildFallbackResult(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): ChurchResearchResult {
  return {
    pastor_name: null,
    pastor_email: null,
    staff_members: [],
    denomination: null,
    congregation_size_estimate: null,
    youth_programs: [],
    service_times: [],
    social_media: scrapedData.socialMedia,
    contact_email: scrapedData.emails[0] || null,
    contact_phone: scrapedData.phones[0] || placesData.phone || null,
    website_quality: 'unknown',
    has_youth_ministry: false,
    has_young_adult_ministry: false,
    has_small_groups: false,
    has_missions_focus: false,
    community_involvement: [],
    outreach_fit_score: 5,
    outreach_fit_reason: 'AI research unavailable — manual review needed.',
    summary: scrapedData.metaDescription || `${placesData.name} located at ${placesData.address}.`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Research a church using Claude AI to generate a comprehensive profile.
 *
 * If ANTHROPIC_API_KEY is not set, returns a minimal profile from scraped data.
 * If AI response parsing fails, falls back to scraped data.
 */
export async function researchChurch(
  scrapedData: ScrapedData,
  placesData: PlacesResult
): Promise<ChurchResearchResult> {
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

    // Validate and normalize
    return {
      pastor_name: parsed.pastor_name ?? null,
      pastor_email: parsed.pastor_email ?? null,
      staff_members: Array.isArray(parsed.staff_members)
        ? parsed.staff_members.map((s: { name?: string; role?: string }) => ({
            name: String(s.name || ''),
            role: String(s.role || ''),
          }))
        : [],
      denomination: parsed.denomination ?? null,
      congregation_size_estimate: parsed.congregation_size_estimate ?? null,
      youth_programs: Array.isArray(parsed.youth_programs) ? parsed.youth_programs.map(String) : [],
      service_times: Array.isArray(parsed.service_times) ? parsed.service_times.map(String) : [],
      social_media: typeof parsed.social_media === 'object' && parsed.social_media !== null
        ? parsed.social_media
        : scrapedData.socialMedia,
      contact_email: parsed.contact_email ?? scrapedData.emails[0] ?? null,
      contact_phone: parsed.contact_phone ?? scrapedData.phones[0] ?? placesData.phone ?? null,
      website_quality: ['professional', 'basic', 'outdated', 'unknown'].includes(parsed.website_quality)
        ? parsed.website_quality
        : 'unknown',
      has_youth_ministry: Boolean(parsed.has_youth_ministry),
      has_young_adult_ministry: Boolean(parsed.has_young_adult_ministry),
      has_small_groups: Boolean(parsed.has_small_groups),
      has_missions_focus: Boolean(parsed.has_missions_focus),
      community_involvement: Array.isArray(parsed.community_involvement)
        ? parsed.community_involvement.map(String)
        : [],
      outreach_fit_score: typeof parsed.outreach_fit_score === 'number'
        ? Math.max(1, Math.min(10, Math.round(parsed.outreach_fit_score)))
        : 5,
      outreach_fit_reason: typeof parsed.outreach_fit_reason === 'string'
        ? parsed.outreach_fit_reason
        : '',
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch (err) {
    console.warn(
      '[ai-researcher] AI research failed, returning scraped data only:',
      err instanceof Error ? err.message : err
    );
    return buildFallbackResult(scrapedData, placesData);
  }
}
