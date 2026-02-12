# Free Luma Platform

## What This Is

A faith-based social platform where users consume daily inspirational content (Bible verses, positivity posts) and connect with each other through posts, prayer requests, live workshops, chat, and video content. Complete ground-up rewrite of the existing Free Luma platform with modern architecture and a clean, mobile-first UI.

## Core Value

Daily inspirational content delivery and faith-based community connection — users come back every day for their daily post and stay to engage with their community.

## Requirements

### Validated

- ✓ Daily post system with Bible/Positivity categories — existing
- ✓ Multi-translation Bible verse support (KJV, NIV, NRSV, NAB) — existing
- ✓ English/Spanish language support — existing
- ✓ User registration and authentication (email/password) — existing
- ✓ User profiles with avatars, bio, stats — existing
- ✓ Social feed with posts, likes, comments — existing
- ✓ Prayer wall (dedicated prayer request feed) — existing
- ✓ Follow/unfollow users — existing
- ✓ Live workshops with video/audio (Agora) — existing
- ✓ Real-time chat via WebSockets — existing
- ✓ Video library with listen tracking — existing
- ✓ Personal notes — existing
- ✓ Push notifications (web push, email, SMS) — existing
- ✓ Daily chapters — existing
- ✓ Bookmarks — existing
- ✓ Search friends — existing
- ✓ Workshop invitations and scheduling — existing
- ✓ Home screen tiles with category content — existing
- ✓ Settings management — existing

### Active

- [ ] Complete rewrite with Next.js (all-in-one: frontend + API routes)
- [ ] MySQL/MariaDB database with Sequelize ORM
- [ ] Mobile-first, card-based UI inspired by ZOX design
- [ ] Bottom tab navigation (Feed, Groups/Categories, Create, Video Library, Account)
- [ ] Clean white card layout with subtle shadows, rounded corners
- [ ] Initials-based avatar system with photo upload
- [ ] System/light/dark mode appearance toggle
- [ ] Sort/filter on feed (Newest, etc.)
- [ ] Post composer ("What's on your mind?")
- [ ] Category tags on posts (Prayer Requests, etc.)
- [ ] Profile page with stats (Posts, Comments, Groups)
- [ ] Real-time features (chat, workshop, notifications) via Socket.IO
- [ ] JWT authentication with secure token handling
- [ ] Proper password hashing (bcrypt, no plaintext)
- [ ] All old features rebuilt with proper security (no hardcoded credentials, no PHP dependencies)

### Out of Scope

- Shop / e-commerce — not part of Free Luma's core value
- Redeem codes / physical product tie-ins — ZOX-specific feature
- User-created groups (ZOX-style) — Free Luma uses admin-defined categories
- Mobile native app — web-first, responsive mobile design
- OAuth/SSO login (Google, Facebook) — email/password sufficient for v1
- Real-time chat video calls outside workshops — workshop-only video

## Context

- Existing platform is live with real users (10,000+ user IDs in database)
- Old codebase has two versions: legacy PHP/SQLite (`freeluma-prod`) and newer Node.js/React/MySQL (`FreeLumaDev-new`)
- The newer version (Express + React CRA) is the primary reference for features
- Old code has significant security issues: hardcoded API keys, plaintext password emails, no CSRF protection
- External dependencies: Agora for live video, external PHP API at kindredsplendorapi.com for daily content, email/SMS gateways
- UI reference: ZOX community app (clean card-based, bottom nav, mobile-first)
- Screenshots saved for reference during UI build phases
- Platform serves both content consumers (daily verse readers) and content creators (workshop hosts, post authors)

## Constraints

- **Tech stack**: Next.js (all-in-one), MySQL/MariaDB, Sequelize, Socket.IO, Tailwind CSS
- **Deployment**: Self-hosted (VPS) — not serverless
- **Database**: Must support migration of existing user data from old platform
- **Design**: Mobile-first responsive, inspired by ZOX screenshots (card-based, bottom nav, light/dark mode)
- **Security**: No hardcoded credentials, proper JWT handling, bcrypt passwords, input validation on all endpoints
- **Compatibility**: Must support the same external integrations (Agora, email/SMS gateways, daily content API)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js all-in-one (frontend + API routes) | Simpler than separate Express backend, one codebase, one deploy | — Pending |
| MySQL/MariaDB over PostgreSQL | Team familiarity, existing data in MySQL format | — Pending |
| Self-hosted over Vercel | Real-time features (Socket.IO, workshops) need persistent server | — Pending |
| Complete rewrite over incremental migration | Old code quality too poor to build on, UI needs total redesign | — Pending |
| Tailwind CSS for styling | Utility-first approach matches card-based UI, dark mode support built-in | — Pending |

---
*Last updated: 2026-02-11 after initialization*
