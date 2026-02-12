# Phase 1: Foundation - Research

**Researched:** 2026-02-11
**Domain:** Next.js full-stack foundation with auth, database, daily content delivery, and mobile-first UI
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire platform foundation: Next.js project scaffolding with custom server, MySQL/Sequelize database layer, invite-only authentication (email/password + Google + Apple OAuth), guided onboarding, a 3-slide immersive daily content experience (video background + audio player + video player), mobile-first responsive UI with bottom tab navigation, dark mode, basic profile with avatar crop/upload, settings, and push notification infrastructure.

The standard approach uses Next.js 16 App Router with a custom `server.js` (for future Socket.IO), Sequelize v6 with CLI migrations, `jose` for JWT in HTTP-only cookies, `@react-oauth/google` + `apple-signin-auth` for social OAuth, Swiper for the 3-slide carousel, `react-easy-crop` for avatar cropping, `@aws-sdk/client-s3` for Backblaze B2 uploads, `next-themes` with Tailwind v4 for dark mode, and `web-push` with a minimal service worker for push notifications. API.Bible serves as the fallback Bible translation source.

Key decisions from CONTEXT.md constrain the research: standard web app (NOT a PWA), invite-only via activation codes, 3-slide swipeable daily post, email/password + Google + Apple Sign-In, bottom tab navigation (icons only), and all daily content served from own database with bible.api fallback.

**Primary recommendation:** Build the custom server + database layer + auth system first, then the app shell + daily content experience, then profile/settings/push infrastructure. Use presigned URLs for all B2 uploads. Service worker is REQUIRED for push notifications even without PWA -- deploy a minimal push-only service worker.

## Standard Stack

### Core (Locked from PROJECT.md and prior research)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16.1.x | Full-stack framework | All-in-one with SSR, API routes, proxy.ts. `output: 'standalone'` NOT used (custom server). **HIGH confidence** |
| React | 19.2.x | UI library | Ships with Next.js 16. React Compiler for auto-memoization. **HIGH confidence** |
| MySQL/MariaDB | 8.0+ / 10.6+ | Database | Locked decision. XAMPP-installed. **HIGH confidence** |
| Sequelize | 6.37.x | ORM | Stable, mature. v7 still alpha. CLI migrations mandatory. **HIGH confidence** |
| mysql2 | 3.17.x | MySQL driver | Required by Sequelize. Prepared statements, connection pooling. **HIGH confidence** |
| Tailwind CSS | 4.1.x | Utility-first CSS | Zero-config in v4. CSS-based configuration. **HIGH confidence** |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (minimum 5.1.0). **HIGH confidence** |

### Authentication & Security

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | 6.1.x | JWT signing/verification | Edge-runtime compatible (proxy.ts). Zero-dependency. Next.js recommended. **HIGH confidence** |
| bcryptjs | 3.0.x | Password hashing | Pure JS bcrypt. No native compilation. $2b$ format. **HIGH confidence** |
| @react-oauth/google | 0.13.x | Google Sign-In (client) | Google Identity Services for React. 580K+ weekly downloads. Renders Sign-In button, returns credential. **HIGH confidence** |
| apple-signin-auth | latest | Apple Sign-In (server) | Verifies Apple identity tokens server-side. Fetches Apple public keys, validates JWT. Requires Node.js >= 18. **MEDIUM confidence** (smaller package, but well-documented API) |

### Daily Content Experience

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swiper | 12.1.x | 3-slide swipeable carousel | 2.6M+ weekly downloads. React components (`Swiper`, `SwiperSlide`). Touch-optimized, hardware-accelerated transitions. Modules: Pagination, Navigation, Keyboard. **HIGH confidence** |
| srt-parser-2 | latest | SRT subtitle parsing | Parses .srt files into arrays with start/end times and text. Simple API for karaoke highlighting. **MEDIUM confidence** (small package but stable, well-tested) |
| html-to-image | latest | Share card image generation | Captures DOM element as PNG/JPEG. Faster and lighter than html2canvas. 1.6M+ monthly downloads. For verse share cards. **MEDIUM confidence** |

### UI & Theming

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | 0.4.x | Theme management (dark/light/system) | 2-line setup. Prevents flash of unstyled content. Works with App Router + Tailwind v4 via `data-theme` attribute. **HIGH confidence** |
| lucide-react | 0.563.x | Icon library | Tree-shakable. Fork of Feather Icons. Active maintenance. **HIGH confidence** |
| react-easy-crop | 5.5.x | Avatar crop/zoom tool | 500K+ weekly downloads. Drag, zoom, pinch-to-zoom. Returns crop area in pixels. Mobile-friendly. **HIGH confidence** |

### Media & Storage

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-s3 | 3.x | Backblaze B2 uploads (S3-compatible) | Official AWS SDK. B2 is S3-compatible. PutObject, GetObject, presigned URLs. **HIGH confidence** |
| @aws-sdk/s3-request-presigner | 3.x | Presigned upload/download URLs | Generate time-limited URLs for direct browser-to-B2 uploads. Avoids proxying through API routes. **HIGH confidence** |
| sharp | 0.34.x | Server-side image processing | Avatar resizing, optimization. Required by Next.js for production image optimization. **HIGH confidence** |

### Notifications

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| web-push | 3.6.x | Push notifications (VAPID) | Server-side push via VAPID keys. Free, self-hosted. Requires a service worker on the client (even without PWA). **MEDIUM confidence** (package not updated in ~2 years but Web Push API is stable) |

### Forms & Validation

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.71.x | Form state management | All forms: registration, login, onboarding, profile, settings. Minimal re-renders. **HIGH confidence** |
| zod | 4.3.x | Schema validation | Shared validation client + server. Auto-generates TypeScript types. **HIGH confidence** |
| @hookform/resolvers | latest | Bridge RHF + Zod | Connects Zod schemas to react-hook-form. **HIGH confidence** |

### Utilities

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | 4.1.x | Date manipulation | Timezone-aware date operations. Tree-shakable. **HIGH confidence** |
| date-fns-tz | latest | Timezone support | `utcToZonedTime`, `zonedTimeToUtc` for user-local midnight content switching. **HIGH confidence** |
| nodemailer | 8.0.x | Email sending | Password reset emails, verification emails. Works with any SMTP. **HIGH confidence** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-oauth/google | Auth.js / NextAuth | Auth.js handles full OAuth flow but adds complexity for custom JWT; @react-oauth/google is lighter for just the Sign-In button + credential |
| apple-signin-auth | Auth.js Apple provider | Same tradeoff -- Auth.js manages session differently than custom JWT |
| swiper | Embla Carousel | Embla is lighter but Swiper has richer touch handling, pagination modules, and 3-slide carousel is its sweet spot |
| html-to-image | html2canvas / html2canvas-pro | html2canvas is more popular but html-to-image is faster, lighter, and more actively maintained |
| srt-parser-2 | subtitle.js | subtitle.js is stream-based (overkill for single SRT files); srt-parser-2 is simpler synchronous parse |
| react-easy-crop | react-image-crop | react-easy-crop has better mobile touch support (pinch-zoom) which is critical for mobile-first |
| next-themes | Custom ThemeProvider | next-themes handles SSR flash prevention, localStorage, system detection -- all hard to get right manually |

**Installation:**

```bash
# Core framework
npx create-next-app@latest freeluma --typescript --tailwind --app --src-dir

# Database
npm install sequelize@6 mysql2

# Authentication
npm install jose bcryptjs @react-oauth/google apple-signin-auth
npm install -D @types/bcryptjs

# Daily content experience
npm install swiper srt-parser-2 html-to-image

# UI & theming
npm install next-themes lucide-react react-easy-crop

# Media storage
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp

# Push notifications
npm install web-push
npm install -D @types/web-push

# Forms & validation
npm install react-hook-form @hookform/resolvers zod

# Utilities
npm install date-fns date-fns-tz nodemailer
npm install -D @types/nodemailer

# Development
npm install -D eslint prettier @types/node
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)

```
freeluma/
├── server.js                    # Custom Node server (Next.js handler, future Socket.IO)
├── next.config.ts               # Next.js configuration (reactCompiler: true)
├── package.json
├── tsconfig.json
├── .env.local                   # Secrets (DB, JWT, OAuth, B2, VAPID keys)
├── .sequelizerc                 # Sequelize CLI paths
│
├── public/
│   ├── sw.js                    # Minimal push notification service worker
│   └── icons/                   # App icons, favicon
│
├── src/
│   ├── app/                     # -------- NEXT.JS APP ROUTER --------
│   │   ├── layout.tsx           # Root layout (providers: ThemeProvider, AuthProvider)
│   │   ├── loading.tsx          # Global loading skeleton
│   │   ├── error.tsx            # Global error boundary
│   │   ├── not-found.tsx        # 404 page
│   │   │
│   │   ├── (public)/            # Route group: unauthenticated pages
│   │   │   ├── layout.tsx       # No nav shell
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx  # Activation code + credentials
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── bible/page.tsx   # Entry point for /bible path (NFC bracelets)
│   │   │   └── positivity/page.tsx  # Entry point for /positivity path
│   │   │
│   │   ├── onboarding/          # Route group: post-signup guided flow
│   │   │   ├── layout.tsx       # Step indicator, no bottom nav
│   │   │   ├── mode/page.tsx    # Step 1: Faith/Positivity selection
│   │   │   ├── profile/page.tsx # Step 2: Name, username, avatar, bio
│   │   │   ├── interests/page.tsx  # Step 3: Category selection
│   │   │   └── follow/page.tsx  # Step 4: Suggested accounts
│   │   │
│   │   ├── (app)/               # Route group: authenticated app shell
│   │   │   ├── layout.tsx       # Main layout (top bar + bottom tab nav)
│   │   │   ├── page.tsx         # Daily post (home / default tab)
│   │   │   ├── prayer-wall/page.tsx  # Placeholder tab
│   │   │   ├── feed/page.tsx         # Placeholder tab
│   │   │   ├── bible-studies/page.tsx # Placeholder tab
│   │   │   ├── animations/page.tsx   # Placeholder tab (faith mode only)
│   │   │   ├── profile/
│   │   │   │   └── page.tsx     # Basic profile card + settings
│   │   │   ├── settings/
│   │   │   │   └── page.tsx     # Settings page
│   │   │   └── daily/
│   │   │       └── [date]/page.tsx  # Historical daily posts
│   │   │
│   │   └── api/                 # -------- API ROUTES --------
│   │       ├── auth/
│   │       │   ├── register/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── forgot-password/route.ts
│   │       │   ├── reset-password/route.ts
│   │       │   ├── google/route.ts       # Google OAuth callback
│   │       │   ├── apple/route.ts        # Apple OAuth callback
│   │       │   └── me/route.ts           # GET current user from JWT
│   │       ├── activation-codes/
│   │       │   └── validate/route.ts     # POST validate code
│   │       ├── users/
│   │       │   ├── route.ts              # POST create profile (onboarding)
│   │       │   └── [id]/route.ts         # GET/PUT profile
│   │       ├── daily-posts/
│   │       │   ├── route.ts              # GET today's content
│   │       │   └── [date]/route.ts       # GET historical content
│   │       ├── translations/
│   │       │   └── route.ts              # GET verse in specific translation
│   │       ├── upload/
│   │       │   ├── presigned/route.ts    # GET presigned URL for B2
│   │       │   └── avatar/route.ts       # POST process cropped avatar
│   │       ├── push/
│   │       │   └── subscribe/route.ts    # POST push subscription
│   │       ├── settings/
│   │       │   └── route.ts              # GET/PUT user settings
│   │       └── admin/
│   │           ├── activation-codes/route.ts  # POST bulk generate codes
│   │           └── daily-content/route.ts     # POST/PUT schedule content
│   │
│   ├── components/              # -------- UI COMPONENTS --------
│   │   ├── ui/                  # Button, Card, Input, Modal, Skeleton, Toast
│   │   ├── layout/              # TopBar, BottomNav, AppShell
│   │   ├── auth/                # LoginForm, SignupForm, GoogleButton, AppleButton
│   │   ├── onboarding/          # ModeSelector, ProfileSetup, InterestPicker, FollowSuggestions
│   │   ├── daily/               # DailyPostSlide, AudioPlayer, SubtitleDisplay, VideoSlide, TranslationSwitcher, ShareButton
│   │   ├── profile/             # ProfileCard, AvatarUpload, AvatarCrop, InitialsAvatar, SettingsList
│   │   └── common/              # VerifyEmailBanner, LoadingSpinner, EmptyState
│   │
│   ├── lib/                     # -------- SERVER-SIDE LIBRARIES --------
│   │   ├── db/
│   │   │   ├── index.ts         # Sequelize singleton (globalThis pattern)
│   │   │   ├── models/
│   │   │   │   ├── index.ts     # Model registry + associations
│   │   │   │   ├── User.ts
│   │   │   │   ├── ActivationCode.ts
│   │   │   │   ├── DailyContent.ts
│   │   │   │   ├── DailyContentTranslation.ts
│   │   │   │   ├── BibleTranslation.ts
│   │   │   │   ├── Category.ts
│   │   │   │   ├── UserCategory.ts
│   │   │   │   ├── UserSetting.ts
│   │   │   │   └── PushSubscription.ts
│   │   │   ├── migrations/      # Sequelize CLI migration files
│   │   │   └── seeders/         # Initial categories, admin user, sample content
│   │   │
│   │   ├── auth/
│   │   │   ├── jwt.ts           # Sign, verify with jose. Cookie helpers.
│   │   │   ├── password.ts      # bcryptjs hash/compare
│   │   │   ├── google.ts        # Verify Google credential server-side
│   │   │   ├── apple.ts         # Verify Apple identity token
│   │   │   └── middleware.ts    # withAuth() wrapper for API routes
│   │   │
│   │   ├── storage/
│   │   │   ├── b2.ts            # S3Client configured for Backblaze B2
│   │   │   └── presign.ts       # Generate presigned upload/download URLs
│   │   │
│   │   ├── push/
│   │   │   └── index.ts         # web-push VAPID configuration + send helper
│   │   │
│   │   ├── bible-api/
│   │   │   └── index.ts         # API.Bible fallback fetcher + cache-to-DB
│   │   │
│   │   └── utils/
│   │       ├── api.ts           # API response helpers, error formatting
│   │       ├── validation.ts    # Shared Zod schemas (auth, profile, settings)
│   │       ├── timezone.ts      # User timezone detection, midnight calculation
│   │       └── constants.ts     # App-wide constants (translations, modes, limits)
│   │
│   ├── hooks/                   # -------- CLIENT-SIDE HOOKS --------
│   │   ├── useAuth.ts           # Auth state, login/logout, current user
│   │   ├── useTheme.ts          # Theme toggle (wraps next-themes)
│   │   └── useDailyContent.ts   # Fetch/cache daily content
│   │
│   ├── context/
│   │   └── AuthContext.tsx       # Auth state provider (JWT-based)
│   │
│   └── styles/
│       └── globals.css          # Tailwind v4 import + custom variant + theme vars
```

### Pattern 1: Custom Server (Phase 1 Foundation)

**What:** A `server.js` at project root creates an HTTP server, passes it to Next.js for request handling. Socket.IO attachment deferred to Phase 3 but the server structure is established now.

**When to use:** Always for this project. Custom server is the foundation for future real-time features.

**Example:**
```typescript
// server.js
import { createServer } from "node:http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Socket.IO will be attached here in Phase 3:
  // const io = new Server(httpServer, { ... });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```
**Confidence:** HIGH -- Socket.IO official guide + Next.js custom server docs.

### Pattern 2: Invite-Only Activation Code Flow

**What:** Activation codes are one-time-use strings stored in DB. Validated before registration. Can be passed via URL `?activation_code=XXX` or entered manually.

**When to use:** Every signup attempt must validate an activation code first.

**Example:**
```typescript
// Activation code validation API
// POST /api/activation-codes/validate
import { NextRequest, NextResponse } from "next/server";
import { ActivationCode } from "@/lib/db/models";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  const activation = await ActivationCode.findOne({
    where: { code, used: false, expires_at: { [Op.gt]: new Date() } }
  });

  if (!activation) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  return NextResponse.json({ valid: true, mode_hint: activation.mode_hint });
}
```

**Confidence:** HIGH -- standard database lookup pattern. No library needed.

### Pattern 3: Google + Apple OAuth with Custom JWT

**What:** Social login returns an identity token (Google credential / Apple identity token). Server verifies it, creates or finds user, issues own JWT in HTTP-only cookie. No session managed by Google/Apple.

**When to use:** Google Sign-In button click and Apple Sign-In button click.

**Flow:**
```
1. Client: @react-oauth/google renders "Sign in with Google" button
2. User clicks, Google popup opens, user consents
3. Google returns a credential (JWT) to the client callback
4. Client sends credential to POST /api/auth/google
5. Server verifies credential with Google's public keys (google-auth-library or jose)
6. Server extracts email, name, avatar URL from verified payload
7. Server finds or creates User record
8. Server issues own JWT in HTTP-only cookie (same as email/password flow)
9. Client receives user data + redirect

Apple flow is similar:
1. Client loads Apple JS SDK or uses <AppleLogin> component
2. User clicks "Sign in with Apple", Apple popup opens
3. Apple returns authorization code + identity token to callback URL
4. Server exchanges code for tokens, verifies identity token with apple-signin-auth
5. Same find-or-create + issue JWT flow
```

**Example (Google server-side):**
```typescript
// POST /api/auth/google
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  const { credential } = await req.json();

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { email, name, picture, sub: googleId } = ticket.getPayload()!;

  // Find or create user
  let user = await User.findOne({ where: { google_id: googleId } });
  if (!user) {
    user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ google_id: googleId });
    }
    // If no user exists, this is a new signup -- check activation code requirement
  }

  // Issue JWT cookie
  const token = await signJWT({ id: user.id, email: user.email });
  // Set cookie...
}
```

**Note:** `google-auth-library` is the official Google library for server-side token verification. Add to install: `npm install google-auth-library`.

**Confidence:** HIGH for Google (official library, well-documented). MEDIUM for Apple (requires Apple Developer account setup, Service ID configuration, and private key management).

### Pattern 4: Dark Mode with Tailwind v4 + next-themes

**What:** Tailwind v4 uses CSS-based dark mode configuration via `@custom-variant`. `next-themes` manages the theme state, localStorage persistence, and system preference detection. Three-way toggle: light / dark / system.

**When to use:** Global theme system, configured once in root layout.

**CSS Configuration (globals.css):**
```css
@import "tailwindcss";

/* Enable class-based dark mode via data-theme attribute */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

**Root Layout:**
```tsx
// src/app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Theme Toggle Component:**
```tsx
"use client";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

**Confidence:** HIGH -- Verified via Tailwind v4 official docs + next-themes GitHub + multiple community guides.

### Pattern 5: 3-Slide Daily Post with Swiper

**What:** Full-screen swipeable 3-slide experience. Slide 1: verse/quote on video background. Slide 2: audio player with SRT karaoke. Slide 3: LumaShort video. Horizontal swipe navigation.

**When to use:** Daily post page (home tab, default view).

**Example:**
```tsx
"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

export function DailyPostCarousel({ content }: { content: DailyContent }) {
  return (
    <Swiper
      modules={[Pagination]}
      slidesPerView={1}
      pagination={{ clickable: true }}
      className="h-screen w-full"
      keyboard={{ enabled: true }}
    >
      <SwiperSlide>
        <DailyPostSlide content={content} />
      </SwiperSlide>
      <SwiperSlide>
        <AudioPlayerSlide content={content} />
      </SwiperSlide>
      <SwiperSlide>
        <LumaShortSlide content={content} />
      </SwiperSlide>
    </Swiper>
  );
}
```

**Confidence:** HIGH -- Swiper React docs verified, widely used for this exact pattern.

### Pattern 6: Presigned URL Upload to Backblaze B2

**What:** Server generates a time-limited presigned URL. Client uploads directly to B2 via PUT request. No proxying through API routes (avoids request size limits and server memory pressure).

**When to use:** All file uploads -- avatar images, video backgrounds, audio files.

**Example:**
```typescript
// src/lib/storage/b2.ts
import { S3Client } from "@aws-sdk/client-s3";

export const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  region: process.env.B2_REGION!, // e.g., "us-west-004"
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
});

// src/lib/storage/presign.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Client } from "./b2";

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(b2Client, command, { expiresIn: 3600 });
}
```

**CDN Delivery:** Files uploaded to B2 are served via Cloudflare CDN. Configure a CNAME (e.g., `cdn.freeluma.com`) pointing to the B2 bucket with Cloudflare proxy. Zero egress fees via Bandwidth Alliance.

**Confidence:** HIGH -- Backblaze official documentation for AWS SDK V3 + S3-compatible API + presigned URLs.

### Pattern 7: SRT Karaoke-Style Subtitle Highlighting

**What:** Parse SRT file into timed entries. During audio playback, highlight the current subtitle entry (and optionally individual words) based on the `timeupdate` event from the HTML5 audio element.

**When to use:** Slide 2 (Full Chapter Audio) of the daily post.

**Example:**
```typescript
// Parse SRT
import SrtParser from "srt-parser-2";

const parser = new SrtParser();
const srtContent = await fetch(srtUrl).then(r => r.text());
const subtitles = parser.fromSrt(srtContent);
// subtitles = [{ id: "1", startTime: "00:00:01,000", startSeconds: 1, endTime: "00:00:04,000", endSeconds: 4, text: "In the beginning..." }, ...]

// Sync with audio
function onTimeUpdate(currentTime: number) {
  const active = subtitles.find(
    (sub) => currentTime >= sub.startSeconds && currentTime <= sub.endSeconds
  );
  setActiveSub(active);
}
```

**Note:** For true word-level karaoke highlighting, the SRT file needs word-level timestamps (non-standard SRT extension) or use WebVTT with cue settings. The simpler approach is line-level highlighting (entire subtitle entry lights up during its time range), which is standard SRT.

**Confidence:** MEDIUM -- SRT parsing is straightforward, but word-level karaoke requires custom SRT format or WebVTT with `<c>` tags. Line-level highlighting is HIGH confidence; word-level is MEDIUM.

### Anti-Patterns to Avoid

- **Using Auth.js/NextAuth for everything:** Auth.js is designed for OAuth session management. For custom JWT + social login, it adds unnecessary abstraction. Use `jose` for JWT + social provider libraries directly.
- **Proxying file uploads through API routes:** Next.js API routes have body size limits (default 4MB). Presigned URLs let the browser upload directly to B2, bypassing this entirely.
- **Using `sequelize.sync()` anywhere near production:** Use Sequelize CLI migrations exclusively. Add a startup guard that throws if sync() is called in production.
- **Storing theme preference only in localStorage:** Use next-themes which syncs localStorage + cookie (for SSR) + system preference. Manual implementation gets SSR flash wrong.
- **Rendering Swiper in server components:** Swiper uses browser APIs. Must use `"use client"` directive on any component importing from `swiper/react`.
- **Using `<video autoplay>` without `muted` and `playsinline`:** Mobile browsers block autoplay unless video is muted. The daily post video background MUST have `autoplay muted loop playsinline` attributes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme toggle (dark/light/system) | Custom localStorage + useEffect + SSR hydration | `next-themes` | Flash of unstyled content prevention, system preference listener, cookie for SSR -- 5+ edge cases |
| Image cropping with touch support | Custom canvas manipulation | `react-easy-crop` | Pinch-to-zoom on mobile, aspect ratio enforcement, crop area calculation in pixels |
| JWT signing/verification | Custom crypto implementation | `jose` | Edge-runtime compatibility, JWK support, standards compliance |
| Google identity verification | Manual JWT decode + key fetch | `google-auth-library` (server) + `@react-oauth/google` (client) | Google's keys rotate; library handles key rotation, audience verification, nonce validation |
| SRT parsing | Custom regex parser | `srt-parser-2` | Edge cases: multi-line subtitles, HTML tags in SRT, time format variations |
| Presigned URL generation | Custom S3 signing algorithm | `@aws-sdk/s3-request-presigner` | AWS Signature V4 algorithm is complex; library handles it correctly |
| DOM-to-image (share cards) | Custom canvas rendering | `html-to-image` | Font rendering, CSS support, cross-browser issues -- library handles all of this |
| Form validation | Custom validation functions | `react-hook-form` + `zod` | Re-render optimization, error state management, shared schemas between client and server |
| Swipeable carousel | Custom touch event handling | `swiper` | Touch velocity, snap behavior, pagination, keyboard nav, hardware acceleration |
| Rate limiting | Custom counter per IP | `express-rate-limit` or API route middleware | IP tracking, sliding windows, configurable limits, bypass for trusted origins |

**Key insight:** Phase 1 has enormous surface area (auth + OAuth + database + daily content + media + UI + push). Every hour saved by using a library instead of hand-rolling pays dividends given the scope.

## Common Pitfalls

### Pitfall 1: Video Autoplay Blocked on Mobile

**What goes wrong:** The MP4 video background on Slide 1 does not play on mobile devices. Users see a black screen or frozen frame.
**Why it happens:** Mobile browsers (especially iOS Safari) block video autoplay unless the video is muted AND has the `playsinline` attribute. Some browsers also require user interaction before any media plays.
**How to avoid:** Always use `<video autoplay muted loop playsinline>`. Provide a poster frame (first frame of video) as fallback. Test on real iOS and Android devices, not just desktop Chrome.
**Warning signs:** "Video works in development but not on my phone."

### Pitfall 2: Push Notifications Require a Service Worker (Even Without PWA)

**What goes wrong:** Push notification subscription fails because there is no service worker registered.
**Why it happens:** The user decided "standard web app, NOT a PWA" and developers interpret this as "no service worker at all." But the Web Push API fundamentally requires a service worker to receive push events, even for a standard website.
**How to avoid:** Deploy a minimal `public/sw.js` that ONLY handles push events. Do NOT add offline caching, install prompts, or manifest.json. This is a push-only service worker, not a PWA.
**Warning signs:** `PushManager.subscribe()` throws "No active Service Worker."

**Minimal push-only service worker:**
```javascript
// public/sw.js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Free Luma", {
      body: data.body,
      icon: "/icons/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
```

**Register in app (client-side):**
```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

**Platform limitations:**
- Desktop browsers (Chrome, Firefox, Edge, Safari 16+): Push works on standard websites
- Android Chrome: Push works on standard websites
- iOS Safari: Push ONLY works for PWAs installed to home screen (iOS 16.4+). Standard websites on iOS Safari CANNOT receive push. This is a fundamental Apple limitation.

### Pitfall 3: Apple Sign-In Requires HTTPS and Apple Developer Setup

**What goes wrong:** Apple Sign-In fails silently or shows invalid domain errors during development.
**Why it happens:** Apple requires: (1) An Apple Developer account ($99/year), (2) A Service ID registered with your domain, (3) The return URL must be HTTPS (even in development), (4) A private key for generating client secrets.
**How to avoid:** Set up Apple Developer account and Service ID early. Use ngrok or a similar HTTPS tunnel for local development testing. Generate the client secret JWT server-side using the private key + team ID + key ID.
**Warning signs:** "Google login works but Apple doesn't." Apple Sign-In cannot be tested on localhost without HTTPS.

### Pitfall 4: Activation Code Race Condition

**What goes wrong:** Two users submit the same activation code simultaneously, both pass validation, and the code is used twice.
**Why it happens:** Check-then-act pattern without transaction isolation. Both requests read the code as `used: false`, then both set it to `used: true`.
**How to avoid:** Use a database transaction with row-level locking: `SELECT ... FOR UPDATE` in Sequelize transaction, or use an atomic `UPDATE activation_codes SET used = true, used_by = :userId WHERE code = :code AND used = false` and check `affectedRows === 1`.
**Warning signs:** More users registered than activation codes generated.

### Pitfall 5: Timezone-Aware Daily Content Switch at Midnight

**What goes wrong:** Users in different timezones see yesterday's content or tomorrow's content at the wrong time.
**Why it happens:** Server stores/returns daily content based on UTC date, but user expects it to change at their local midnight. If the server just uses `new Date()` for "today," a user in UTC-8 sees tomorrow's content 8 hours early.
**How to avoid:** Store user's timezone in their profile (detected during onboarding via `Intl.DateTimeFormat().resolvedOptions().timeZone`). When fetching daily content, calculate "today" in the user's timezone using `date-fns-tz`. The API endpoint should accept the user's timezone or calculate it from the stored preference.
**Warning signs:** "The daily verse changed too early" or "I still see yesterday's verse."

### Pitfall 6: Cloudflare Caching MP4 Video and CDN Configuration

**What goes wrong:** Video files are not cached by Cloudflare, resulting in direct B2 requests and slow load times. Or worse, stale cached content after an update.
**Why it happens:** Cloudflare has specific rules about caching large files and video content. By default, Cloudflare may not cache files over 512MB. Also, the free plan has limitations on video streaming (Cloudflare's ToS section 2.8 prohibits using CDN primarily for video delivery on free/pro plans).
**How to avoid:** (1) Keep video files under 512MB (daily background videos should be short clips -- 10-30 seconds). (2) Use appropriate cache-control headers. (3) Be aware of Cloudflare ToS regarding video content -- if video delivery is primary, may need Cloudflare Stream or a Business/Enterprise plan. (4) For Phase 1, looping background videos (10-30s, optimized) should be well within acceptable use.
**Warning signs:** 403 errors from Cloudflare, unexpectedly high B2 bandwidth bills, Cloudflare ToS violation notice.

### Pitfall 7: NIV and Other Copyrighted Bible Translations

**What goes wrong:** The platform serves copyrighted Bible translation text without proper licensing, leading to legal issues.
**Why it happens:** KJV is public domain, but NIV, NRSV, and NAB are copyrighted. Teams assume "the API provides it, so we can use it" without checking licensing terms.
**How to avoid:** API.Bible provides licensed access to copyrighted translations, but requires attribution and compliance with each publisher's terms. Review the metadata for each Bible version on API.Bible. Display required attribution (e.g., "Scripture quotations taken from the Holy Bible, New International Version"). Some translations have usage quotas (e.g., NIV allows up to 500 verses in a product without explicit permission from Zondervan).
**Warning signs:** No attribution displayed, no licensing review documented.

## Code Examples

### JWT Authentication with HTTP-Only Cookies

```typescript
// src/lib/auth/jwt.ts
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signJWT(payload: { id: number; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // Long-lived -- user stays logged in until explicit logout
    .sign(secret);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: number; email: string };
  } catch {
    return null;
  }
}

// Cookie helpers
export function setAuthCookie(token: string): HeadersInit {
  return {
    "Set-Cookie": `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
  };
}
```

### Sequelize Model with TypeScript (User)

```typescript
// src/lib/db/models/User.ts
import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../index";

interface UserAttributes {
  id: number;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  apple_id: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string; // For initials-based default
  bio: string | null;
  date_of_birth: Date | null;
  mode: "bible" | "positivity";
  timezone: string;
  preferred_translation: string;
  language: string;
  email_verified: boolean;
  onboarding_complete: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes,
  "id" | "password_hash" | "google_id" | "apple_id" | "avatar_url" | "bio" |
  "date_of_birth" | "deleted_at" | "created_at" | "updated_at" |
  "email_verified" | "onboarding_complete"
> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare email: string;
  // ... all attributes
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: true }, // null for OAuth-only users
    google_id: { type: DataTypes.STRING(255), unique: true, allowNull: true },
    apple_id: { type: DataTypes.STRING(255), unique: true, allowNull: true },
    display_name: { type: DataTypes.STRING(100), allowNull: false },
    username: { type: DataTypes.STRING(30), unique: true, allowNull: false },
    avatar_url: { type: DataTypes.STRING(500), allowNull: true },
    avatar_color: { type: DataTypes.STRING(7), allowNull: false }, // hex color for initials
    bio: { type: DataTypes.STRING(150), allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    mode: { type: DataTypes.ENUM("bible", "positivity"), defaultValue: "bible" },
    timezone: { type: DataTypes.STRING(50), defaultValue: "America/New_York" },
    preferred_translation: { type: DataTypes.STRING(10), defaultValue: "KJV" },
    language: { type: DataTypes.ENUM("en", "es"), defaultValue: "en" },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    onboarding_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
    underscored: true,
    paranoid: true, // soft delete via deleted_at
  }
);

export { User };
```

### Activation Code Model

```typescript
// src/lib/db/models/ActivationCode.ts
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../index";

class ActivationCode extends Model {
  declare id: number;
  declare code: string;
  declare used: boolean;
  declare used_by: number | null;
  declare mode_hint: "bible" | "positivity" | null;
  declare expires_at: Date;
}

ActivationCode.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(12), unique: true, allowNull: false },
    used: { type: DataTypes.BOOLEAN, defaultValue: false },
    used_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: "users", key: "id" } },
    mode_hint: { type: DataTypes.ENUM("bible", "positivity"), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: "activation_codes", timestamps: true, underscored: true }
);
```

### DailyContent Model

```typescript
// src/lib/db/models/DailyContent.ts
// Stores admin-scheduled daily content with matched video background
class DailyContent extends Model {
  declare id: number;
  declare post_date: string; // YYYY-MM-DD
  declare mode: "bible" | "positivity";
  declare title: string;
  declare content_text: string; // verse reference or quote text
  declare verse_reference: string | null; // e.g., "John 3:16" (faith mode)
  declare chapter_reference: string | null; // e.g., "John 3" for full chapter audio
  declare video_background_url: string; // B2/CDN URL for MP4
  declare audio_url: string | null; // B2/CDN URL for chapter audio
  declare audio_srt_url: string | null; // B2/CDN URL for SRT subtitles
  declare lumashort_video_url: string | null; // B2/CDN URL for LumaShort
  declare language: string;
}
```

### API Route Auth Wrapper

```typescript
// src/lib/auth/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "./jwt";
import { cookies } from "next/headers";

export type AuthenticatedRequest = NextRequest & {
  user: { id: number; email: string };
};

export function withAuth(
  handler: (req: NextRequest, context: { params: Promise<any>; user: { id: number; email: string } }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<any> }) => {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyJWT(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return handler(req, { ...context, user });
  };
}
```

### Initials-Based Default Avatar

```typescript
// src/components/profile/InitialsAvatar.tsx
"use client";

interface InitialsAvatarProps {
  name: string;
  color: string; // hex color assigned at signup (permanent)
  size?: number;
}

export function InitialsAvatar({ name, color, size = 48 }: InitialsAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}

// Color generation at signup (random from curated palette)
const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 (Oct 2025) | Renamed. `middleware.ts` still works but deprecated. Use `proxy.ts` for route interception. |
| `tailwind.config.js` darkMode | `@custom-variant dark (...)` in CSS | Tailwind v4 (2025) | Configuration moved to CSS. No JS config file needed for dark mode. |
| `next lint` | Direct ESLint CLI | Next.js 16 | `next lint` removed. Use `eslint .` directly with `@next/eslint-plugin-next`. |
| Webpack | Turbopack (default) | Next.js 16 | Turbopack is now default bundler. 2-5x faster builds. |
| `jsonwebtoken` | `jose` | Ongoing (2024+) | `jsonwebtoken` does not work in Edge runtime. `jose` is zero-dependency and Next.js-recommended. |
| Google Sign-In Platform Library | Google Identity Services (`@react-oauth/google`) | 2023 | Old GSI library deprecated. New library uses one-tap and button-based flows. |
| `output: 'standalone'` + custom server | Custom server WITHOUT standalone | Next.js (ongoing) | Cannot use standalone mode with custom server. They are mutually exclusive. |

**Deprecated/outdated:**
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16. Still works but will be removed.
- `next lint`: Removed in Next.js 16. Run ESLint directly.
- Google Platform Library (old gapi.auth2): Deprecated. Use Google Identity Services.
- `tailwind.config.js` for dark mode: Tailwind v4 uses CSS-based configuration exclusively.

## Open Questions

1. **Apple Sign-In private key management**
   - What we know: Apple requires a private key (.p8 file) to generate client secrets. The key is downloaded once from Apple Developer portal.
   - What's unclear: Best practice for storing the .p8 key content in environment variables on VPS vs. file path reference. Key rotation policy.
   - Recommendation: Store the key content as a base64-encoded environment variable. Parse it in the auth helper. Document the Apple Developer setup steps as part of deployment guide.

2. **Cloudflare video ToS compliance**
   - What we know: Cloudflare's ToS (Section 2.8) on free/pro plans prohibits using CDN "primarily" for serving video content. Short looping background clips may be acceptable.
   - What's unclear: Whether daily 10-30 second background videos + LumaShort videos constitute "primarily" video delivery.
   - Recommendation: Start with short, heavily compressed background clips via Cloudflare CDN. If video becomes the primary bandwidth consumer, evaluate Cloudflare Stream ($1/1000 min stored + $5/1000 min delivered) or serve videos directly from B2 with Cloudflare's caching for other assets.

3. **SRT word-level karaoke precision**
   - What we know: Standard SRT format supports line-level timing. Word-level timing requires either custom SRT extension or WebVTT format.
   - What's unclear: Whether the content team will provide word-level timing in their SRT files or just line-level.
   - Recommendation: Build line-level highlighting first (standard SRT). If the content provides word-level timing, extend the parser. WebVTT with `<c>` tags is the standard format for word-level karaoke and could be supported later.

4. **iOS Safari push notification limitation**
   - What we know: iOS Safari only supports push notifications for PWAs installed to the home screen (iOS 16.4+). Since the project is NOT a PWA, iOS users will not receive push notifications.
   - What's unclear: Whether this is acceptable to the product owner, or if a fallback (email, SMS) is needed for iOS users.
   - Recommendation: Implement web push for desktop + Android. For iOS, show a banner explaining that notifications require adding the site to the home screen (which the user rejected by choosing "not a PWA"). Alternatively, use email notifications as the iOS fallback. This decision should be made explicitly.

5. **Bible translation copyright compliance for NIV, NRSV, NAB**
   - What we know: KJV is public domain. NIV (Zondervan/HarperCollins), NRSV (National Council of Churches), NAB (USCCB) are copyrighted. API.Bible provides licensed API access but downstream usage may still require attribution.
   - What's unclear: Exact attribution requirements for displaying verses in-app and in generated share images.
   - Recommendation: Display attribution per API.Bible's metadata for each version. Limit verse quotes per session/page to stay within fair use guidelines. Consult the specific copyright holder guidelines for each translation.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Dark Mode Docs](https://tailwindcss.com/docs/dark-mode) -- `@custom-variant dark` syntax, system vs class-based
- [Swiper React Components](https://swiperjs.com/react) -- Swiper/SwiperSlide API, modules, hooks
- [Backblaze B2 AWS SDK V3 Guide](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2) -- S3Client endpoint, presigned URLs
- [Backblaze Cloudflare Integration](https://www.backblaze.com/docs/cloud-storage-cloudflare-integrations) -- Bandwidth Alliance zero egress
- [Socket.IO + Next.js Guide](https://socket.io/how-to/use-with-nextjs) -- Custom server pattern
- [Next.js Auth Guide](https://nextjs.org/docs/pages/building-your-application/authentication) -- jose recommendation, JWT in cookies
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) -- Service worker requirement for push
- [Apple Safari Push Notification Support](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) -- macOS Ventura+ standard websites, iOS PWA-only
- [API.Bible](https://scripture.api.bible/) -- Bible translation API with licensed access to NIV, KJV, NRSV

### Secondary (MEDIUM confidence)
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- App Router compatibility, data-theme attribute
- [Tailwind v4 + Next.js Dark Mode Guide](https://www.thingsaboutweb.dev/en/posts/dark-mode-with-tailwind-v4-nextjs) -- Complete setup walkthrough
- [@react-oauth/google npm](https://www.npmjs.com/package/@react-oauth/google) -- v0.13.4, 580K weekly downloads
- [apple-signin-auth npm](https://www.npmjs.com/package/apple-signin-auth) -- Node.js Apple token verification
- [react-easy-crop npm](https://www.npmjs.com/package/react-easy-crop) -- v5.5.6, 500K+ weekly downloads
- [srt-parser-2 npm](https://www.npmjs.com/package/srt-parser-2) -- SRT to array parser
- [html-to-image npm](https://www.npmjs.com/package/html-to-image) -- DOM-to-image library, 1.6M+ monthly downloads
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server) -- Authorization code flow
- [idownloadblog: Safari Declarative Web Push](https://www.idownloadblog.com/2025/05/13/safari-mac-declarative-web-push-macos-15-5-support/) -- Safari 18.5 Declarative Web Push

### Tertiary (LOW confidence)
- Community blog posts on Next.js + Tailwind v4 dark mode integration (multiple sources agree on `@custom-variant` approach)
- Stack Overflow discussions on activation code patterns (validated against standard DB transaction patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All core libraries verified via npm, official docs, and prior STACK.md research
- Architecture: HIGH -- Custom server pattern verified via Socket.IO official guide; project structure follows Next.js App Router conventions
- Authentication (email/password + JWT): HIGH -- jose + bcryptjs are well-established patterns
- Authentication (Google OAuth): HIGH -- @react-oauth/google is the official Google Identity Services wrapper
- Authentication (Apple OAuth): MEDIUM -- Requires Apple Developer account setup that cannot be verified without access; apple-signin-auth is smaller ecosystem
- Daily content (Swiper + video): HIGH -- Swiper is dominant carousel library; video autoplay constraints well-documented
- Daily content (SRT karaoke): MEDIUM -- Line-level highlighting is straightforward; word-level karaoke depends on content format
- Dark mode: HIGH -- Tailwind v4 docs + next-themes verified, multiple community implementations confirm approach
- Push notifications: MEDIUM -- Web Push API is stable but iOS limitation is a significant gap for a mobile-first app
- Backblaze B2: HIGH -- Official S3-compatible API documentation with JavaScript V3 SDK examples
- Pitfalls: HIGH -- Documented from official sources and prior PITFALLS.md research

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable technologies, no fast-moving dependencies)
