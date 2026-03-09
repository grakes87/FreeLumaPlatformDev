/**
 * Church Website Scraper — Cheerio-based HTML parser
 *
 * Extracts structured data from church websites:
 * title, description, body text, links, emails, phones, and social media URLs.
 *
 * Returns null on any failure (timeout, fetch error, parse error).
 */

import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_TEXT_LENGTH = 5000;
const MAX_LINKS = 50;
const USER_AGENT = 'FreeLuma Church Outreach Bot/1.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedData {
  title: string;
  metaDescription: string;
  bodyText: string;       // cleaned body text, truncated to 5000 chars
  links: string[];        // up to 50 links
  emails: string[];       // extracted via regex
  phones: string[];       // extracted via regex
  socialMedia: Record<string, string>; // facebook, instagram, twitter, youtube URLs
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w{2,}/g;
const PHONE_REGEX = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/i,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clean body text: remove excessive whitespace, script/style content,
 * and truncate to a reasonable length.
 */
function cleanBodyText($: cheerio.CheerioAPI): string {
  // Remove script and style elements before extracting text
  $('script, style, noscript').remove();

  const text = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, MAX_BODY_TEXT_LENGTH);
}

/**
 * Extract social media URLs from all <a href> attributes.
 */
function extractSocialMedia($: cheerio.CheerioAPI): Record<string, string> {
  const social: Record<string, string> = {};
  const hrefs: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) hrefs.push(href);
  });

  for (const [platform, regex] of Object.entries(SOCIAL_PATTERNS)) {
    for (const href of hrefs) {
      const match = href.match(regex);
      if (match) {
        social[platform] = match[0];
        break; // first match per platform
      }
    }
  }

  return social;
}

/**
 * Deduplicate an array of strings (case-insensitive).
 */
function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a church website and extract structured data.
 *
 * Returns null on any error (network, timeout, parse failure).
 * Never throws.
 */
export async function scrapeChurchWebsite(
  websiteUrl: string
): Promise<ScrapedData | null> {
  try {
    const response = await fetch(websiteUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract basic metadata
    const title = $('title').text().trim();
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || '';

    // Extract body text (after removing scripts/styles)
    const bodyText = cleanBodyText($);

    // Extract links (up to MAX_LINKS)
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && links.length < MAX_LINKS) {
        links.push(href);
      }
    });

    // Extract emails and phones from the raw HTML
    const emails = dedup(html.match(EMAIL_REGEX) || []);
    const phones = dedup(html.match(PHONE_REGEX) || []);

    // Extract social media URLs
    const socialMedia = extractSocialMedia($);

    return {
      title,
      metaDescription,
      bodyText,
      links,
      emails,
      phones,
      socialMedia,
    };
  } catch {
    // Return null on any error (timeout, network, parse)
    return null;
  }
}
