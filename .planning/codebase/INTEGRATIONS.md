# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**Video Conferencing & Real-time Communication:**
- Agora - Live video/audio streaming for workshops
  - SDK/Client: agora-rtc-sdk-ng 4.23.2 (frontend), agora-access-token 2.0.4 (backend)
  - RTM: agora-rtm-sdk 1.5.1 (frontend real-time messaging)
  - Auth: `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` environment variables
  - Token generation: `src/controller/workshop/startWorkshop.js` - Generates RTC and RTM tokens with expiration based on workshop end time
  - Usage: Workshop live sessions with role-based access (PUBLISHER for hosts, SUBSCRIBER for attendees)

**Content Delivery & External Data:**
- FreeLuma Legacy API (`kindredsplendorapi.com`) - Serves daily posts and Bible verses
  - Endpoints: `/code/newgetDailyMessage.php`, `/getSelectedBibleVerse.php`
  - Transport: HTTP GET requests via axios
  - Data types: Video paths, Bible verses in multiple translations (KJV, NIV, NRSV, NAB)
  - Language support: English and Spanish variants
  - Location: `src/utils/getDailyPostData.js` - Fetches daily post content
  - Location: `src/controller/dailyPosts/getDailyPost.js` - Daily post endpoint
  - Also: `/code/getCategories.php` - Category data

**Email Service:**
- Custom Email Gateway (`kindredsplendorapi.com/elegantapp/customersupport/ergosSendEmail.php`)
  - Method: HTTP GET parameters
  - Authentication: Configured email credentials
  - Usage: Password reset emails, notifications
  - Sender: `orders@freeluma.com` (alternate) or `info@freeluma.com`
  - Location: `src/helper/sendNotifications.js` (lines 91-109)

**SMS Service:**
- Twilio-based SMS Gateway (`kindredsplendorapi.com/freelumatext/Utils/sendMMSTextMessage.php`)
  - Auth: `SMS_SID` and `SMS_TOKEN` environment variables
  - Method: HTTP POST to PHP endpoint
  - Parameters: `toPhoneNumber`, `message`, `sid`, `token`
  - Usage: SMS notifications for workshops and alerts
  - Location: `src/helper/sendNotifications.js` (lines 112-135)

## Data Storage

**Databases:**
- MySQL 5.7+ / MariaDB 10.4+
  - Connection: Via Sequelize ORM
  - Config: `src/config/database.js`
  - Env vars: `DB_NAME`, `DB_HOST`, `DB_USER`, `DB_PASS`
  - Database name: `freelumadatabase`
  - Dialect: MySQL
  - Client: mysql2 3.12.0 driver, Sequelize 6.37.5 ORM
  - Key tables: `users`, `categories`, `workshops`, `dailyPosts`, `userVideos`, `chatMessages`, etc.
  - Models: `src/models/` directory contains 32+ Sequelize models

**File Storage:**
- Local filesystem in `/public/uploads/` directory
  - Profile pictures: `/public/uploads/user/`
  - Generated thumbnails: Stored locally
  - Video files: Stored locally with duration metadata
  - Served via: Express static middleware at `/public` route
  - Upload handling: Multer middleware for multipart/form-data
  - Base URL config: `UPLOAD_URL` environment variable
  - Image generation: `src/utils/generatePublicURL.js` constructs accessible URLs

**Caching:**
- In-memory caching via node-cache 5.1.2
  - Default implementation available in codebase
  - TTL-based cache for reducing database load
  - No Redis/external cache detected

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `src/controller/auth/login.js` and register controllers
  - Token signing: jsonwebtoken 9.0.2
  - Secret key: `ACCESS_TOKEN` environment variable
  - Expiration: `JWT_EXPIRE` (default 365d)
  - Payload: User data (minus password) + metadata
  - Verification: Middleware checks JWT in Authorization header

**Password Management:**
- Password hashing: bcrypt 5.1.1
  - Hash rounds: Standard bcrypt configuration
  - Location: `src/controller/auth/login.js` (password comparison)
  - Location: `src/controller/auth/register.js` (hash on registration)
  - Note: Handles PHP-hashed passwords ($2y$ format) by converting to bcrypt format ($2b$)

**Category-based Access:**
- Multi-category support with CategoryUserRelation table
  - Users can belong to multiple categories (BIBLE, POSITIVITY)
  - Category redirects after login based on user assignments
  - Location: `src/controller/auth/login.js` (lines 70-127)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar service configured

**Logs:**
- Console logging via `console.log()` and `console.error()`
- Request logging middleware: `src/index.js` (lines 41-44) logs `timestamp - method - URL`
- Socket.IO events: Verbose logging for connections/disconnections/messages
- Email/SMS/Push errors: Logged but no centralized error tracking
- No log aggregation service configured

**Performance Monitoring:**
- Not detected - No APM tools (NewRelic, DataDog, etc.)

## CI/CD & Deployment

**Hosting:**
- Development: XAMPP local stack
- Production: References to `freelumaquotes.com` and `dev2.freelumaquotes.com`
- Deployment target: Linux server with Node.js and MySQL
- No Docker configuration detected

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, Jenkins, or similar

**Deployment Process:**
- Manual deployment likely required
- Start script: `npm start` runs `node index.js` with nodemon for development

## Environment Configuration

**Required env vars (Backend):**
- `PORT` - Server port (default 3012)
- `DB_NAME` - MySQL database name
- `DB_HOST` - MySQL host
- `DB_USER` - MySQL username
- `DB_PASS` - MySQL password
- `ACCESS_TOKEN` - JWT secret key
- `JWT_EXPIRE` - Token expiration time
- `UPLOAD_URL` - Base URL for uploads (e.g., https://dev2.freelumaquotes.com/public/uploads/)
- `CLIENT_PRODUCTION_URL` - Frontend URL for content delivery
- `LUMA_LOGO_URL` - Logo URL for emails
- `EMAIL_HOST` - SMTP host (1and1 in config)
- `SENDER_EMAIL` - From email address
- `SENDER_EMAIL_PASSWORD` - Email service password
- `WEB_PUSH_PUBLIC_KEY` - VAPID public key for push notifications
- `WEB_PUSH_PRIVATE_KEY` - VAPID private key for push notifications
- `BIBLE_FRONTEND_URL` - Bible app frontend URL
- `POSITIVITY_FRONTEND_URL` - Positivity app frontend URL
- `SMS_SID` - SMS service account ID
- `SMS_TOKEN` - SMS service token
- `AGORA_APP_ID` - Agora video service app ID
- `AGORA_APP_CERTIFICATE` - Agora service certificate
- `AUTH_HEADER_KEY` - Custom auth header key

**Secrets location:**
- Environment variables in `.env` file (not committed to git)
- `.env.sample` provides template for required variables
- Location: `Old Code/FreeLumaDev-new/free-luma-api/.env`

## Webhooks & Callbacks

**Incoming:**
- Not detected - No incoming webhook endpoints for external services

**Outgoing:**
- Push notifications: Web-push notifications via browser APIs (client initiates subscription)
- Email/SMS: Callbacks would be handled by external PHP endpoints
- Workshop notifications: Socket.IO broadcasts to workshop participants

## Data Integration Points

**Frontend Integration with Backend:**
- REST API at `/api/v1/*` endpoints
  - Auth endpoints: `/api/v1/` (login, register, etc.)
  - User endpoints: `/api/v1/user/*`
  - Daily posts: `/api/v1/daily-post/*`
  - Workshops: `/api/v1/workshop/*`
  - Settings: `/api/v1/settings/*`

**Socket.IO Events:**
- Real-time chat messaging: `send-message`, `receive-message`, `update-message`, `delete-message`
- Typing indicators: `typing`, `stop-typing`
- User presence: `user-connected`, `user-disconnected`
- Location: `src/socket/socket.js` - Handles all WebSocket connections and events

**Third-party API Patterns:**
- HTTP GET for data retrieval (legacy PHP API)
- Custom PHP gateway for email/SMS (kindredsplendorapi.com)
- Token-based auth with Agora (separate credentials)
- Web push VAPID credentials for browser notifications

---

*Integration audit: 2026-02-11*
