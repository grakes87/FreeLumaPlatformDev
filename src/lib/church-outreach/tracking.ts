const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.app';

/**
 * Rewrite all href links in email HTML for click tracking.
 * Skips mailto: links and unsubscribe links.
 */
export function rewriteLinksForTracking(html: string, emailId: number): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url: string) => {
      // Don't rewrite unsubscribe or mailto links
      if (url.includes('unsubscribe') || url.startsWith('mailto:')) {
        return match;
      }
      const trackUrl = `${APP_URL}/api/church-outreach/click?id=${emailId}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    }
  );
}

/**
 * Generate tracking pixel HTML for open tracking.
 */
export function getTrackingPixel(trackingId: string): string {
  const pixelUrl = `${APP_URL}/api/church-outreach/track?id=${trackingId}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
}
