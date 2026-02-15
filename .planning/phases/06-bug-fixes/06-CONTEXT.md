# Phase 6: Bug Fixes & Polish - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix accumulated bugs, TypeScript errors, UI inconsistencies, and UX issues across Phases 1–5. The platform must compile cleanly (`next build` zero errors), all pages render without runtime errors, and key user flows work end-to-end. No new features — strictly fixing what's broken.

</domain>

<decisions>
## Implementation Decisions

### Discovery approach
- Start with `npx next build` to surface all TypeScript/compile errors
- Then work through the known bug list below by module
- Check both TikTok and Instagram feed modes for each feed-related fix
- Claude investigates media caching setup (B2 presigned URLs vs Cloudflare CDN) and advises

### Priority order
- Build errors first (blocking deployment)
- Known user-reported bugs second (listed below)
- Runtime console errors third (discovered during fix verification)

### Claude's Discretion
- Technical approach for each fix
- Order of fixes within each module
- Whether to refactor vs. patch
- Mobile responsiveness verification scope

</decisions>

<specifics>
## Known Bug List

### Daily Content
1. **Guest snap scroll broken** — When not logged in, scrolling to previous day's content does not snap (missing scroll-snap on guest/unauthenticated view)

### Feed (TikTok mode confirmed, check Instagram too)
2. **Media carousel swipe blocked** — Posts with multiple images/videos cannot swipe left/right in TikTok mode (gesture conflict likely)
3. **Video tap-to-pause does nothing** — Tapping video in TikTok feed has zero effect, no pause/play toggle (possibly useImmersive interaction conflict)
4. **Repost verified badges missing** — When viewing a repost, the verified badge does not display on verified users
5. **Video upload no thumbnail** — When creating a new feed post with video, the completed upload shows no thumbnail preview

### Prayer Wall — Cards/Listing
6. **Reaction not highlighted** — After selecting a reaction on prayer cards, the selected reaction is not visually highlighted
7. **Video not loading in cards** — Videos on prayer request cards don't load in the card video player; no thumbnail either
8. **New request not appearing** — After saving a new prayer request, the "My Requests" section doesn't update with the new request (requires manual refresh or doesn't show at all)
9. **Default reaction should be heart outline** — All prayer request cards should show an outlined heart as the default reaction icon (not current icon)
10. **Answered prayers not showing** — When marking a prayer request as answered, it doesn't appear in the "Answered" section regardless of refresh

### Prayer Request Composer
11. **Simplify media picker** — Remove separate camera & gallery icons; replace with single "Photo/Video" link that opens native media picker (camera + gallery combined)
12. **Theme not respected** — New prayer request composer shows dark theme when user has light theme selected (not picking up profile appearance)
13. **Video upload no thumbnail** — Same as feed: video uploads in prayer request composer show no thumbnail preview

### Media & Performance
14. **Media caching investigation** — Claude to audit current media delivery setup (presigned URLs vs CDN), check Cloudflare configuration, and ensure proper caching headers for faster media loading

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-bug-fixes*
*Context gathered: 2026-02-14*
