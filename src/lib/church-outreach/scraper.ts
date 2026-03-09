/**
 * Church Website Scraper — Cheerio-based HTML parser
 *
 * Scrapes the homepage PLUS key subpages (about, staff, leadership, contact,
 * ministries) to build a comprehensive data profile. Returns combined text,
 * emails, phones, and social media across all pages.
 */

import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_TEXT_PER_PAGE = 4000;
const MAX_TOTAL_BODY_TEXT = 15000;
const MAX_LINKS = 100;
const USER_AGENT = 'FreeLuma Church Outreach Bot/1.0';

// Subpages most likely to contain leadership, contact, and ministry info
const SUBPAGE_PATTERNS = [
  /\/(about|who-we-are|our-story)/i,
  /\/(staff|team|leadership|pastors?|elders?|our-team|our-staff|meet-the-team|our-leadership)/i,
  /\/(contact|connect|visit|get-in-touch)/i,
  /\/(ministr|youth|kids|children|students|young-adults|groups)/i,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedData {
  title: string;
  metaDescription: string;
  bodyText: string;       // combined text from homepage + subpages
  links: string[];        // up to 100 links from homepage
  emails: string[];       // deduplicated across all pages
  phones: string[];       // deduplicated across all pages
  socialMedia: Record<string, string>;
  pagesScraped: number;   // how many pages were successfully scraped
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

function cleanBodyText($: cheerio.CheerioAPI, maxLen: number): string {
  $('script, style, noscript, nav, footer, header').remove();

  const text = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, maxLen);
}

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
        break;
      }
    }
  }

  return social;
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Resolve a relative URL against a base URL, returning null if invalid.
 */
function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/**
 * Fetch a single page and return its HTML, or null on failure.
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Find subpage URLs from homepage links that match our target patterns.
 */
function findSubpageUrls(baseUrl: string, links: string[]): string[] {
  const baseOrigin = new URL(baseUrl).origin;
  const found = new Map<string, string>(); // pattern index → URL (first match wins)

  for (const href of links) {
    const resolved = resolveUrl(baseUrl, href);
    if (!resolved) continue;

    // Must be same origin
    try {
      if (new URL(resolved).origin !== baseOrigin) continue;
    } catch { continue; }

    const pathname = new URL(resolved).pathname;

    for (let i = 0; i < SUBPAGE_PATTERNS.length; i++) {
      if (!found.has(String(i)) && SUBPAGE_PATTERNS[i].test(pathname)) {
        found.set(String(i), resolved);
        break;
      }
    }
  }

  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a church website — homepage plus key subpages (about, staff,
 * contact, ministries). Returns combined data across all pages.
 *
 * Returns null on complete failure. Never throws.
 */
export async function scrapeChurchWebsite(
  websiteUrl: string
): Promise<ScrapedData | null> {
  try {
    // Step 1: Fetch and parse homepage
    const homeHtml = await fetchPage(websiteUrl);
    if (!homeHtml) return null;

    const $home = cheerio.load(homeHtml);

    const title = $home('title').text().trim();
    const metaDescription =
      $home('meta[name="description"]').attr('content')?.trim() || '';

    // Collect all links from homepage
    const links: string[] = [];
    $home('a[href]').each((_, el) => {
      const href = $home(el).attr('href');
      if (href && links.length < MAX_LINKS) links.push(href);
    });

    // Collect data from homepage
    const allEmails: string[] = homeHtml.match(EMAIL_REGEX) || [];
    const allPhones: string[] = homeHtml.match(PHONE_REGEX) || [];
    const socialMedia = extractSocialMedia($home);
    const bodyParts: string[] = [
      `[Homepage]\n${cleanBodyText($home, MAX_BODY_TEXT_PER_PAGE)}`,
    ];

    // Step 2: Find and scrape key subpages in parallel
    const subpageUrls = findSubpageUrls(websiteUrl, links);
    let pagesScraped = 1;

    if (subpageUrls.length > 0) {
      const subResults = await Promise.all(subpageUrls.map(fetchPage));

      for (let i = 0; i < subResults.length; i++) {
        const html = subResults[i];
        if (!html) continue;

        pagesScraped++;
        const $ = cheerio.load(html);

        // Extract page label from pathname
        const pathname = new URL(subpageUrls[i]).pathname;
        const label = pathname.replace(/^\//, '').replace(/\/$/, '') || 'page';

        bodyParts.push(`[${label}]\n${cleanBodyText($, MAX_BODY_TEXT_PER_PAGE)}`);

        // Merge emails, phones, social from subpages
        const pageEmails = html.match(EMAIL_REGEX) || [];
        const pagePhones = html.match(PHONE_REGEX) || [];
        allEmails.push(...pageEmails);
        allPhones.push(...pagePhones);

        // Merge social media (don't overwrite existing)
        const pageSocial = extractSocialMedia($);
        for (const [platform, url] of Object.entries(pageSocial)) {
          if (!socialMedia[platform]) socialMedia[platform] = url;
        }
      }
    }

    // Combine and truncate body text
    const bodyText = bodyParts.join('\n\n').slice(0, MAX_TOTAL_BODY_TEXT);

    return {
      title,
      metaDescription,
      bodyText,
      links,
      emails: dedup(allEmails),
      phones: dedup(allPhones),
      socialMedia,
      pagesScraped,
    };
  } catch {
    return null;
  }
}
