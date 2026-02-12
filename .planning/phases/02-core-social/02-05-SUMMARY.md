---
phase: 02-core-social
plan: 05
subsystem: social-comments
tags: [api, comments, hooks, ui, bottom-sheet, profanity, blocks, cursor-pagination]
depends_on:
  requires: ["02-01"]
  provides: ["post-comment-api", "post-comment-hook", "post-comment-ui"]
  affects: ["02-06", "02-07", "02-08"]
tech-stack:
  added: []
  patterns: ["cursor-pagination", "2-level-threading", "profanity-checkAndFlag", "block-exclusion", "bottom-sheet-portal"]
key-files:
  created:
    - src/app/api/post-comments/route.ts
    - src/app/api/post-comments/[id]/route.ts
    - src/hooks/usePostComments.ts
    - src/components/social/PostCommentSheet.tsx
    - src/components/social/PostCommentThread.tsx
  modified:
    - src/lib/utils/constants.ts
decisions:
  - id: post-comment-cursor-pagination
    decision: "Use cursor-based pagination (id > cursor) instead of offset pagination for post comments"
    reason: "Cursor pagination handles concurrent inserts correctly and avoids duplicates on load-more"
  - id: 2-level-thread-flattening
    decision: "Reply-to-reply flattens to root comment (enforced server-side)"
    reason: "Plan specifies 2-level depth limit; deep nesting is UX-hostile on mobile"
  - id: post-comment-max-length
    decision: "POST_COMMENT_MAX_LENGTH = 2000 (separate from daily COMMENT_MAX_LENGTH = 1000)"
    reason: "Plan specifies body(1-2000) for post comments; daily comments stay at 1000"
  - id: top-2-reply-previews
    decision: "GET root comments includes top 2 replies per root inline"
    reason: "Reduces round trips; shows reply preview before user expands"
metrics:
  duration: 5 min
  completed: 2026-02-12
---

# Phase 2 Plan 5: Post Comments System Summary

**One-liner:** Threaded post comment system with cursor pagination, profanity filtering, block exclusion, and liquid glass bottom sheet UI.

## What Was Built

### Task 1: Post Comments API Routes (2 files)

**GET /api/post-comments** (`src/app/api/post-comments/route.ts`)
- Cursor-based pagination with `cursor` + `limit` params
- Filters by `post_id` and optional `parent_id` (null for root, number for replies)
- Block exclusion via `getBlockedUserIds()` -- excludes both directions
- Reply count subquery per root comment
- Top 2 replies per root comment fetched inline to reduce client round-trips
- Returns `{ comments, has_more, next_cursor }`

**POST /api/post-comments** (`src/app/api/post-comments/route.ts`)
- Zod validation: `{ post_id, body(1-2000), parent_id? }`
- Verifies post exists via `Post.findByPk`
- 2-level depth enforcement: if parent has a parent, flatten to root
- Runs `checkAndFlag()` profanity filter, sets `flagged` boolean
- Returns created comment with user data + reply_count: 0

**PUT /api/post-comments/[id]** (`src/app/api/post-comments/[id]/route.ts`)
- Owner-only (user_id match)
- No time limit on editing
- Re-runs profanity `checkAndFlag()` on new body
- Sets `edited: true` and updates `flagged` status

**DELETE /api/post-comments/[id]** (`src/app/api/post-comments/[id]/route.ts`)
- Owner or admin (lazy User model import for admin check)
- Hard delete with cascade: deletes all child replies first
- Returns `{ deleted: true }`

### Task 2: Hook and UI Components (3 files)

**usePostComments hook** (`src/hooks/usePostComments.ts`)
- Mirrors `useComments` pattern with cursor pagination instead of offset
- State: comments, hasMore, loading, submitting
- Actions: fetchComments, loadMore, loadReplies, addComment, editComment, deleteComment
- `loadReplies(commentId)` for lazy-loading nested replies

**PostCommentSheet** (`src/components/social/PostCommentSheet.tsx`)
- Bottom sheet at 80% viewport height (vs 65% for daily)
- Liquid glass styling: `bg-white/10 backdrop-blur-2xl border-white/20`
- Portal rendering via `createPortal(el, document.body)`
- Drag-to-dismiss with touch handlers (100px threshold)
- Escape key to close, body scroll lock
- Header with comment count and close button
- Composes `PostCommentThread` inside

**PostCommentThread** (`src/components/social/PostCommentThread.tsx`)
- Root comment list with cursor-based load-more
- Each comment: Avatar (image or initials), display name, relative time, edited badge
- Reply button (root only), edit/delete (owner only)
- ReplySection: expand/collapse with lazy-loaded replies, "Load more replies" link
- InlineReplyInput: appears below comment on "Reply" click
- Liquid glass comment bubbles with `border-white/15` reply indent lines
- Empty state: "No comments yet. Be the first!"
- Sign-in prompt for unauthenticated users

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] POST_COMMENT_MAX_LENGTH constant**
- Plan specifies body(1-2000) but only COMMENT_MAX_LENGTH (1000) existed
- Added POST_COMMENT_MAX_LENGTH = 2000 to constants.ts
- Used consistently in API validation and UI maxLength

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Cursor pagination for post comments | Handles concurrent inserts; avoids offset duplication on load-more |
| 2 | Reply-to-reply flattens to root | 2-level depth limit per plan; prevents deep mobile nesting |
| 3 | POST_COMMENT_MAX_LENGTH = 2000 | Plan specifies body(1-2000); separate from daily's 1000 |
| 4 | Top 2 reply previews inline | Reduces network round-trips; shows context before expand |
| 5 | 80% viewport height sheet | More room than daily's 65% since post discussions are longer |

## Notes

Task 2 files (usePostComments.ts, PostCommentSheet.tsx, PostCommentThread.tsx) were created by this plan execution but were inadvertently included in the parallel 02-02 docs commit (9ccb5f6). The content is correct and complete.
