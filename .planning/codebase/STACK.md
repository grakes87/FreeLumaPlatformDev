# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- JavaScript (Node.js) - Backend API (`free-luma-api`)
- JavaScript (React) - Frontend (`free-luma-frontend`)
- SQL - Database schemas and migrations

**Secondary:**
- PHP - Legacy integration endpoints (external APIs at `kindredsplendorapi.com`)
- XML - Bible verse files used by the application

## Runtime

**Environment:**
- Node.js - No specific version pinned (check package-lock.json metadata)
- Package lock version 3 (npm 7+)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present in both frontend and backend

## Frameworks

**Core:**
- Express.js 4.21.2 - Backend HTTP server and routing
- React 18.3.1 - Frontend UI framework
- Sequelize 6.37.5 - ORM for MySQL database

**Real-time Communication:**
- Socket.IO 4.8.1 (server) - Real-time messaging and workshop events
- Socket.IO-client 4.8.1 (frontend) - Real-time client communication
- Agora RTC SDK (4.23.2) & RTM SDK (1.5.1) - Video/audio streaming for workshops

**Build/Dev:**
- react-scripts 5.0.1 - React build tooling and webpack configuration
- Nodemon 3.1.9 - Auto-restart during development

**UI & Content:**
- TinyMCE React 5.1.1 - Rich text editor
- Draft.js 0.11.7 - React text editor with HTML conversion
- React Router DOM 7.0.2 - Client-side routing
- React Select 5.9.0 - Dropdown component
- React Modal 3.16.3 - Modal dialogs
- Slick Carousel 1.8.1 - Image carousel
- Tailwind CSS 3.4.16 - Utility-first CSS framework

**Media & Audio:**
- Video.js 8.23.4 - Video player
- WaveSurfer.js 7.8.16 - Audio waveform visualization
- react-audio-voice-recorder 2.2.0 - Audio recording component
- FFmpeg Static 5.3.0 - Video encoding/processing
- FFProbe Static 3.1.0 - Media inspection
- Fluent FFmpeg 2.1.3 - FFmpeg wrapper
- opus-decoder 0.7.7 - Opus audio codec decoding
- lamejs 1.2.1 - MP3 encoding

**Utilities:**
- Axios 1.7.9 - HTTP client
- React Redux 9.1.2 & Redux Toolkit 2.4.0 - State management
- JWT (jsonwebtoken) 9.0.2 - Token authentication
- bcrypt 5.1.1 - Password hashing
- Moment.js 2.30.1 & date-fns 4.1.0 - Date/time utilities
- i18next 25.5.2 - Internationalization
- Lottie React 2.4.1 - Animation library
- React Cropper 2.3.3 - Image cropping
- React Easy Crop 5.5.3 - Crop UI component
- html-to-draftjs & draftjs-to-html - Content conversion
- Cheerio 1.1.2 - HTML parsing
- xml2js 0.6.2 - XML parsing

**Testing:**
- @testing-library/react 13.4.0 - React component testing
- @testing-library/jest-dom 5.17.0 - Jest matchers for DOM
- @testing-library/user-event 13.5.0 - User interaction simulation

## Key Dependencies

**Critical:**
- mysql2 3.12.0 - MySQL database driver (Sequelize dependency)
- Socket.IO 4.8.1 - Enables real-time message delivery and workshop notifications
- Agora SDK packages - Video/audio conference backbone for workshops
- jsonwebtoken 9.0.2 - JWT token signing/verification for auth
- bcrypt 5.1.1 - Password hashing and verification

**Infrastructure:**
- express-compression 1.8.1 - HTTP compression middleware
- body-parser 1.20.3 - Request body parsing
- CORS 2.8.5 - Cross-origin request handling
- Multer 1.4.5 - File upload handling
- node-cache 5.1.2 - In-memory caching
- node-cron 3.0.3 - Scheduled task runner
- nodemailer 6.10.0 - Email sending
- web-push 3.6.7 - Web push notifications
- dotenv 16.4.7 - Environment variable management
- @google/model-viewer 4.1.0 - 3D model viewing

## Configuration

**Environment:**
- `.env` file required (see `.env.sample` in API)
- Critical variables: `PORT`, `DB_NAME`, `DB_HOST`, `DB_USER`, `DB_PASS`, `ACCESS_TOKEN`, `JWT_EXPIRE`
- External service keys: `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`
- Email config: `EMAIL_HOST`, `SENDER_EMAIL`, `SENDER_EMAIL_PASSWORD`
- SMS config: `SMS_SID`, `SMS_TOKEN`
- API URLs: `CLIENT_PRODUCTION_URL`, `UPLOAD_URL`, `BIBLE_FRONTEND_URL`, `POSITIVITY_FRONTEND_URL`

**Build:**
- Frontend: React Scripts configuration (standard CRA setup)
- Backend: No explicit build config (Node.js runs JavaScript directly)
- Database: Sequelize ORM handles migrations

## Platform Requirements

**Development:**
- Node.js with npm 7+ (based on lockfileVersion 3)
- MySQL 5.7+ or MariaDB 10.4+ (database server)
- FFmpeg installed on system (for video processing)
- XAMPP or similar local development stack (based on directory structure)

**Production:**
- Linux/macOS/Windows server with Node.js runtime
- MySQL 5.7+ or MariaDB 10.4+
- XAMPP infrastructure (Apache, MySQL, PHP stack referenced in config)
- External dependencies: Agora cloud accounts, email SMTP server, SMS provider
- SSL certificate for secure communication (uses HTTPS)

---

*Stack analysis: 2026-02-11*
