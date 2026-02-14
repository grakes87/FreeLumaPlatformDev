# Cloudflare Integration Checklist

Pre-launch checklist tracking all Cloudflare caching, security, and CDN requirements.
Updated as new features are added.

---

## API Caching (Code-Level — DONE)

All API responses now include `Cache-Control: private, no-store` via `successResponse()`, `errorResponse()`, and `serverError()` in `src/lib/utils/api.ts`. This prevents Cloudflare from caching any personalized JSON response.

- [x] `successResponse()` — `Cache-Control: private, no-store`
- [x] `errorResponse()` — `Cache-Control: private, no-store`
- [x] `serverError()` — `Cache-Control: private, no-store`

### API Routes Covered

| Route | Auth | Personalized | Cache Header |
|-------|------|-------------|--------------|
| `GET /api/daily-posts` | Optional | Yes (mode, language, timezone) | `private, no-store` |
| `GET /api/daily-posts/[date]` | Optional | Yes (mode, language) | `private, no-store` |
| `GET /api/translations` | Required | Yes (per user) | `private, no-store` |
| `POST /api/listen-log` | Required | Yes | `private, no-store` |
| `GET /api/settings` | Required | Yes | `private, no-store` |
| `PUT /api/settings` | Required | Yes | `private, no-store` |
| `GET /api/categories` | Required | No | `private, no-store` |
| `POST /api/auth/*` | Public | N/A | `private, no-store` |
| `GET /api/health` | Public | No | `private, no-store` |
| `POST /api/upload/*` | Required | Yes | `private, no-store` |
| `* /api/admin/*` | Admin | Yes | `private, no-store` |

---

## Static Asset CDN (Backblaze B2)

Media files are stored in Backblaze B2 and served via direct B2 URLs or a Cloudflare CNAME (when `CDN_BASE_URL` is configured).

### Assets to Cache (Long TTL)

- [ ] **Audio files** (`.mp3`, `.m4a`) — chapter audio per translation. Immutable once uploaded. Recommended: `Cache-Control: public, max-age=31536000, immutable`
- [ ] **SRT subtitle files** (`.srt`) — per translation. Immutable once uploaded. Same policy as audio.
- [ ] **Video backgrounds** (`.mp4`) — daily content video loops. Immutable once uploaded. Same policy.
- [ ] **LumaShort videos** (`.mp4`) — slide 3 short videos, one per language (not per translation). Immutable once uploaded. Same policy as audio.
- [ ] **User avatars** (`.jpg`, `.png`, `.webp`) — profile images. May change on re-upload. Recommended: `Cache-Control: public, max-age=86400` (1 day) or use cache-busting filenames.
- [ ] **Presigned upload URLs** — NOT cacheable (time-limited tokens)

### Cloudflare Dashboard Setup for B2 CDN

- [ ] Create CNAME record pointing `cdn.yourdomain.com` to B2 bucket (`f005.backblazeb2.com`)
- [ ] Set `CDN_BASE_URL` env var to `https://cdn.yourdomain.com`
- [ ] Configure Cloudflare Page Rule or Cache Rule for `cdn.yourdomain.com/*`:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month (for immutable assets)
  - Browser Cache TTL: 1 year
- [ ] Enable Cloudflare Polish (image optimization) for avatar images
- [ ] Verify B2 `b2-content-disposition` and `b2-cache-control` headers pass through

---

## Cloudflare Dashboard Configuration

### Page Rules / Cache Rules

- [ ] **`/api/*`** — Bypass Cache (safety net even though code sets `private, no-store`)
- [ ] **`/_next/static/*`** — Cache Everything, Edge TTL 1 month (Next.js hashed static assets)
- [ ] **`/_next/image/*`** — Cache Everything, Edge TTL 1 day (Next.js optimized images)
- [ ] **`/sw.js`** — Bypass Cache (service worker must always be fresh)
- [ ] **`/manifest.json`** — Cache, short TTL (1 hour)

### Security Headers

- [ ] Enable HSTS (Strict-Transport-Security)
- [ ] Set `X-Content-Type-Options: nosniff`
- [ ] Set `X-Frame-Options: DENY`
- [ ] Enable Cloudflare WAF rulesets
- [ ] Configure rate limiting rules:
  - `/api/auth/login` — 10 req/min per IP
  - `/api/auth/register` — 5 req/min per IP
  - `/api/auth/forgot-password` — 3 req/min per IP
  - `/api/upload/*` — 10 req/min per user

### SSL/TLS

- [ ] SSL mode: Full (Strict)
- [ ] Always Use HTTPS: On
- [ ] Minimum TLS Version: 1.2
- [ ] Automatic HTTPS Rewrites: On

### Performance

- [ ] Enable Brotli compression
- [ ] Enable Early Hints
- [ ] Enable HTTP/2 and HTTP/3
- [ ] Auto Minify: JavaScript, CSS, HTML

---

## Slide-Specific Notes

### Slide 1 (Daily Post — verse/quote overlay)
- Video background URL: cached at CDN level (immutable B2 object)
- API JSON: NOT cached (personalized per user mode/language/translation)
- Translation text: fetched from `/api/translations` — NOT cached at CDN

### Slide 2 (Audio Player)
- Audio file URL: cached at CDN level (per-translation immutable B2 object)
- SRT file URL: cached at CDN level (per-translation immutable B2 object)
- API JSON: NOT cached (same response as slide 1)

### Slide 3 (LumaShort)
- LumaShort video URL: cached at CDN level (immutable B2 object, one per language not per translation)
- Lives on `daily_content.lumashort_video_url` (one per EN row, one per ES row)
- API JSON: NOT cached (same response as slides 1 & 2)

---

## Future Items (Add as features ship)

- [ ] Push notification API endpoints
- [ ] Feed/post API caching strategy (Phase 2)
- [ ] Chat/WebSocket passthrough rules (Phase 3)
- [ ] Image optimization for post images (Phase 2)
- [ ] Cloudflare Workers for edge logic (if needed)

---

*Last updated: 2026-02-12*
*Covers: Phase 1 Foundation (Slides 1, 2 & 3)*
