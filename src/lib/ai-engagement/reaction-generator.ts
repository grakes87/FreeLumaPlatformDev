/**
 * Reaction Generator — distributes random reactions according to weighted distribution.
 *
 * No AI needed — purely random selection from a weighted pool.
 */

import type {
  ReactionWeights,
  ReactionType,
  EngagementTargetType,
  SeedUser,
  StagedReaction,
} from './types';

/**
 * Pick a random reaction type using weighted distribution.
 */
function weightedRandom(
  weights: ReactionWeights,
  allowedTypes: readonly ReactionType[]
): ReactionType {
  const entries = allowedTypes.map((type) => ({
    type,
    weight: (weights as unknown as Record<string, number>)[type] ?? 0,
  }));

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return allowedTypes[0];

  let rand = Math.random() * totalWeight;
  for (const entry of entries) {
    rand -= entry.weight;
    if (rand <= 0) return entry.type;
  }
  return entries[entries.length - 1].type;
}

/**
 * Generate reactions for a single content item.
 * Each seed user can only react once per content item.
 */
export function generateReactions(
  type: EngagementTargetType,
  contentId: number,
  count: number,
  weights: ReactionWeights,
  seedUsers: SeedUser[]
): StagedReaction[] {
  const allowedTypes: readonly ReactionType[] =
    type === 'daily'
      ? (['like', 'love', 'haha', 'wow', 'sad', 'pray'] as const)
      : (['like', 'love', 'wow', 'sad', 'pray'] as const);

  // Shuffle users and pick up to `count` (can't exceed available users)
  const shuffled = [...seedUsers].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map((user) => ({
    user_id: user.id,
    content_id: contentId,
    reaction_type: weightedRandom(weights, allowedTypes),
  }));
}

/**
 * Default reaction weight presets.
 */
export const REACTION_PRESETS = {
  balanced: {
    like: 20,
    love: 30,
    haha: 0,
    wow: 10,
    sad: 5,
    pray: 35,
  } as ReactionWeights,
  'love-heavy': {
    like: 15,
    love: 45,
    haha: 0,
    wow: 5,
    sad: 5,
    pray: 30,
  } as ReactionWeights,
  'pray-heavy': {
    like: 10,
    love: 20,
    haha: 0,
    wow: 5,
    sad: 5,
    pray: 60,
  } as ReactionWeights,
} as const;
