# Phase 3: Real-Time - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time communication infrastructure — users can chat 1:1 and in groups via Socket.IO, receive instant in-app notifications with a persistent activity feed, and get email notifications for key events when offline. No browser push notifications. Socket.IO provides the real-time transport layer for both chat and in-app notifications.

</domain>

<decisions>
## Implementation Decisions

### Chat access & layout
- Chat accessed via top bar icon (like Instagram DMs icon) — not a bottom nav tab
- Chat view is full-screen with back arrow — hides bottom nav, custom header with user name/avatar
- Conversation list is a single mixed list (1:1 and groups sorted by most recent message)
- Conversation list shows message content preview (truncated text, sender name in groups)
- Search bar at top of conversation list to filter by user name (conversation search, not full-text message search)
- Compose button + user picker to start new conversations from the chat list
- Green online status dot on user avatars in conversation list and inside chat
- Online/offline only — no "last active X ago" timestamps
- Separate unread red dot badge on chat icon in top bar (independent from bell notification badge)

### Chat interface style
- Instagram DM style: minimal bubbles, profile pics next to messages
- Full media support: text + images + video + voice messages
- Up to 10 media attachments per message via single "+" button (opens bottom sheet: Gallery, Camera, Voice)
- Emoji reactions on individual messages — same 6 reactions as posts (like, love, haha, wow, sad, pray)
- Swipe right to reply to a specific message (quote-reply inline)
- Long-press context menu with blur background: Reply, React, Copy text, Unsend
- Message status indicators: single check (sent), double check (delivered), blue (read)
- Typing indicator when other user is typing
- Plain text only — no bold/italic/markdown formatting
- Share posts to chat: rich card preview (author, text snippet, media thumbnail) — tappable to open post

### Voice messages
- Hold-to-record with live waveform visualization + timer
- Cancel button (tap) during recording to discard
- Playback at normal speed only (no 1x/1.5x/2x toggle)
- Max 60 seconds per voice message
- Separate mic button always visible alongside send button (not toggle)

### Group chat
- 1:1 AND group chat supported
- Max group size: 256 members
- Creator is sole admin — can add/remove members, change group name/photo
- Custom group photo upload (default is member avatar collage)
- Any member can leave voluntarily
- Only creator can add new members (from their followers only)
- Group member avatars tappable to navigate to their profile
- @mentions supported — type @ to see member list, mentioned user gets notification
- Group info screen: minimal (group name, member count — no individual member actions)
- No pinned messages

### Message management
- Unsend for everyone (message removed from both sides) — no "delete for me only"
- Delete conversation: removes from your list only — other party still sees it
- Deleted conversation restores with full history if new message received
- No disappearing/vanish messages — all messages persist until manually unsent
- No archive option — conversations stay in list until deleted
- No mute conversation option
- No media gallery view — media viewable inline only

### Notification activity feed
- Accessed via bell icon in top bar — current dropdown kept with latest 5-10 notifications + "See all" link to full /notifications page
- Full page uses liquid glass styling (bg-white/10 backdrop-blur-2xl)
- Chronological list with similar notifications collapsed ("John and 3 others reacted to your post")
- Filter tabs at top: All | Follows | Reactions | Comments | Prayer
- Each notification shows: user avatar with small icon overlay (heart, comment, follow, pray) + relative timestamp
- Unread notifications have subtle highlight background color difference
- Tapping navigates directly to the source (post, comment, profile, conversation)
- Context-aware inline action buttons (Follow back on follow notifications, Accept/Decline on follow requests)
- Follow request notifications appear in general feed (not a separate section)
- "Mark all as read" button — individual notifications read on tap
- Swipe left to delete/dismiss individual notifications
- "Clear all" button with confirmation dialog to wipe entire notification history
- Empty state: friendly illustration + "No notifications yet — interact with the community to see activity here"
- Red dot only on bell icon (no exact count number)
- Real-time updates via Socket.IO — new notifications appear automatically at top
- Infinite scroll for older notifications (cursor-based pagination)
- 30-day notification retention — auto-delete older notifications

### In-app notification toasts
- Real-time toast banner slides in from top for ALL notification types including chat messages
- Toast is tappable — navigates to the notification source
- Auto-dismiss after 3-4 seconds
- Color-coded subtle accent on toast border/icon by notification type
- Queue behavior: one toast at a time, next shows after current dismisses
- Chat message toasts suppressed when already viewing that conversation

### Email notification strategy
- NO browser push notifications — email only for offline users
- Email triggers: unread DMs (after 15 min), follow requests, prayer responses (someone prayed for you), daily content reminder
- DM emails batch per sender: "You have 3 unread messages from Sarah"
- Email includes message preview (~100 chars) with "Reply in app" CTA
- Daily content reminder email includes today's verse/quote text with "Read more" link
- User-configurable reminder time (default 8:00 AM local)
- Configurable quiet hours — emails queued and sent after quiet hours end
- Max 3-5 emails per hour per user (suppress/batch above limit)
- Per-category email toggles in settings: DM emails, Follow request emails, Prayer emails, Daily reminder
- Notification settings as a section in the existing /settings page (not a separate page)
- One-click unsubscribe link in each email footer (disables that category)
- Deep links in all email CTAs (link to specific conversation, post, prayer, profile)
- Branded HTML emails with FreeLuma logo and brand colors
- Full email tracking: sent, bounced, opened (tracking pixel) — surfaced in admin dashboard
- Global email notification toggle is NOT needed — quiet hours covers temporary silence

### Messaging access rules
- User-configurable messaging access: Everyone / Followers / Mutual / Nobody
- Default for new users: Mutual follows
- Message request system for non-mutuals: request appears in separate "Message Requests" section at top of chat list
- Requester can include actual message text visible in request — recipient accepts or declines
- Silent decline — sender NOT notified of rejection
- One attempt only — declined user cannot send another request (prevents harassment)
- Messaging access setting also applies to group chat invites
- Admin/moderators bypass messaging access settings for moderation purposes
- "Nobody" mode shows disabled message button on profile with tooltip: "This user doesn't accept messages"

### Block behavior in chat
- Blocking hides existing conversation from BOTH users (messages preserved in DB)
- Unblocking restores full conversation history for both
- In shared group chats: both users stay but each other's messages are hidden from the blocker
- Report option: long-press conversation to report to admin moderation queue
- Profanity filter (obscenity library from Phase 2) applies to chat messages

### Rate limiting & spam prevention
- Max ~30 messages per minute per conversation
- Conversation deletion: delete for me only (other party keeps their view)

### Claude's Discretion
- Socket.IO architecture decisions (namespaces, rooms, event naming)
- Database schema for conversations, messages, participants
- Message pagination strategy (cursor-based)
- Voice message encoding format and storage
- Typing indicator debounce timing
- Notification grouping algorithm
- Email job queue implementation
- Online presence tracking implementation
- Reconnection and offline message sync strategy

</decisions>

<specifics>
## Specific Ideas

- Chat should feel like Instagram DMs — minimal, profile pics next to bubbles, reactions on messages
- Voice messages inspired by WhatsApp — hold to record with waveform, cancel button
- Message status should use WhatsApp-style checkmarks (single/double/blue)
- Notification feed should have liquid glass styling consistent with prayer cards
- Toast notifications should be color-coded by type for quick visual identification
- Post sharing in chat should show rich card preview that's tappable

</specifics>

<deferred>
## Deferred Ideas

- Browser push notifications — explicitly not included in this phase
- Voice message playback speed (1x/1.5x/2x) — keep at normal speed for now
- Full-text message search — only conversation name search for now
- Chat media gallery view — viewable inline only
- Conversation archive — no archive feature
- Mute individual conversations — not included
- Pinned messages in groups — not included
- Message formatting (bold/italic/markdown) — plain text only
- Per-conversation notification settings — global category toggles only
- Disappearing/vanish messages — not included

</deferred>

---

*Phase: 03-real-time*
*Context gathered: 2026-02-13*
