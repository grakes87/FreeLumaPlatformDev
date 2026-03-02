/**
 * Shared types for the Admin AI Engagement feature.
 *
 * Supports both daily content (bible/positivity) and verse-by-category
 * engagement generation (comments + reactions).
 */

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

export type EngagementTargetType = 'daily' | 'verse-category';

export interface ContentItem {
  id: number;
  /** For daily: post_date (YYYY-MM-DD); for verse-category: verse_reference */
  label: string;
  /** Verse text or positivity quote */
  content_text: string;
  verse_reference: string | null;
  mode?: 'bible' | 'positivity';
  category_name?: string;
  existing_comment_count: number;
  existing_reaction_count: number;
}

// ---------------------------------------------------------------------------
// Reaction types (daily has 6, verse-category has 5 — no 'haha')
// ---------------------------------------------------------------------------

export const DAILY_REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'pray'] as const;
export type DailyReactionType = (typeof DAILY_REACTION_TYPES)[number];

export const VERSE_REACTION_TYPES = ['like', 'love', 'wow', 'sad', 'pray'] as const;
export type VerseReactionType = (typeof VERSE_REACTION_TYPES)[number];

export type ReactionType = DailyReactionType | VerseReactionType;

export interface ReactionWeights {
  like: number;
  love: number;
  haha?: number; // only for daily
  wow: number;
  sad: number;
  pray: number;
}

// ---------------------------------------------------------------------------
// Generation request / response
// ---------------------------------------------------------------------------

export interface GenerateTarget {
  content_id: number;
  content_text: string;
  verse_reference: string | null;
  mode?: 'bible' | 'positivity';
  category_name?: string;
}

export interface GenerateRequest {
  type: EngagementTargetType;
  targets: GenerateTarget[];
  comments_per_item: number;
  reactions_per_item: number;
  reaction_weights: ReactionWeights;
}

export interface StagedComment {
  user_id: number;
  user_display_name: string;
  user_avatar_color: string;
  content_id: number;
  body: string;
}

export interface StagedReaction {
  user_id: number;
  content_id: number;
  reaction_type: ReactionType;
}

export interface GenerateResponse {
  comments: StagedComment[];
  reactions: StagedReaction[];
}

// ---------------------------------------------------------------------------
// Publish request / response
// ---------------------------------------------------------------------------

export interface PublishComment {
  user_id: number;
  content_id: number;
  body: string;
}

export interface PublishReaction {
  user_id: number;
  content_id: number;
  reaction_type: ReactionType;
}

export interface PublishRequest {
  type: EngagementTargetType;
  comments: PublishComment[];
  reactions: PublishReaction[];
}

export interface PublishResponse {
  comments_inserted: number;
  reactions_inserted: number;
}

// ---------------------------------------------------------------------------
// Seed user (queried from DB)
// ---------------------------------------------------------------------------

export interface SeedUser {
  id: number;
  display_name: string;
  avatar_color: string;
}
