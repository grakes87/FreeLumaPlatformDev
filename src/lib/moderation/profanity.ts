import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
  asteriskCensorStrategy,
} from 'obscenity';

/**
 * Profanity detection and censoring using the obscenity library.
 * Uses the English dataset with recommended transformers for
 * leet-speak, confusables, and duplicate character handling.
 */

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

/**
 * Check if text contains profanity.
 */
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

/**
 * Censor profane words in text, replacing them with asterisks.
 */
export function censorText(text: string): string {
  const matches = matcher.getAllMatches(text);
  return censor.applyTo(text, matches);
}

/**
 * Check text for profanity and return both the flag status and censored version.
 * Used by post creation/editing to flag and optionally censor content.
 */
export function checkAndFlag(text: string): { flagged: boolean; censored: string } {
  const matches = matcher.getAllMatches(text);
  const flagged = matches.length > 0;
  const censored = flagged ? censor.applyTo(text, matches) : text;
  return { flagged, censored };
}
