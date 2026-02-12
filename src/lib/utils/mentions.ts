/**
 * Parse @mentions and #hashtags from post/comment text.
 */

/**
 * Extract unique @username mentions from text.
 * Matches @followed by 3-30 alphanumeric/underscore characters
 * (matching the username constraints in the User model).
 */
export function parseMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_]{3,30})\b/g;
  const mentions = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    mentions.add(match[1].toLowerCase());
  }

  return Array.from(mentions);
}

/**
 * Extract unique #hashtags from text.
 * Matches # followed by 1-50 alphanumeric/underscore characters.
 */
export function parseHashtags(text: string): string[] {
  const regex = /#([a-zA-Z0-9_]{1,50})\b/g;
  const hashtags = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    hashtags.add(match[1].toLowerCase());
  }

  return Array.from(hashtags);
}
