# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
Old Code/FreeLumaDev-new/
├── free-luma-api/                    # Express.js backend
│   ├── index.js                      # Server entry point
│   ├── cron.js                       # Scheduled tasks
│   ├── package.json                  # Dependencies
│   ├── .env                          # Environment variables
│   ├── public/                       # Static files (uploads)
│   │   ├── user/                     # User profile pictures
│   │   └── posts/                    # Post media files
│   └── src/
│       ├── config/                   # Configuration
│       │   └── database.js           # Sequelize MySQL setup
│       ├── models/                   # ORM entities
│       │   ├── index.js              # Model exports & relationships
│       │   ├── users.js              # User entity
│       │   ├── posts.js              # Post entity
│       │   ├── workshop.js           # Workshop entity
│       │   └── [25+ other models]    # Comments, Follows, Chat, etc.
│       ├── controller/               # Business logic (118 files)
│       │   ├── auth/                 # Auth operations
│       │   │   ├── register.js
│       │   │   ├── login.js
│       │   │   ├── forgotPassword.js
│       │   │   ├── activationCodeVerify.js
│       │   │   └── [more auth]
│       │   ├── user/                 # User profile operations
│       │   │   ├── getUserProfile.js
│       │   │   ├── updateUserProfile.js
│       │   │   ├── followUser.js
│       │   │   └── [21+ more user operations]
│       │   ├── posts/                # Post CRUD & engagement
│       │   │   ├── addPost.js
│       │   │   ├── getPosts.js
│       │   │   ├── likePost.js
│       │   │   ├── addComment.js
│       │   │   └── [13+ more post operations]
│       │   ├── workshop/             # Workshop management
│       │   ├── dailyPosts/           # Daily content
│       │   ├── dailyChapters/        # Daily chapters
│       │   ├── notes/                # Personal notes
│       │   ├── chat/                 # Chat operations
│       │   ├── category/             # Categories
│       │   ├── homescreenTile/       # Home screen content
│       │   ├── videoLibrary/         # Video content
│       │   └── settings/             # User settings
│       ├── routes/                   # HTTP endpoint definitions
│       │   ├── auth.js               # Auth routes
│       │   ├── user.js               # User routes
│       │   ├── dailyPost.js          # Daily post routes
│       │   ├── workshop.js           # Workshop routes
│       │   └── settings.js           # Settings routes
│       ├── middleware/               # Request processors
│       │   ├── authMiddleware.js     # JWT validation
│       │   ├── multer.js             # File upload handler
│       │   └── activationCodeMiddleware.js
│       ├── socket/                   # Real-time events
│       │   └── socket.js             # Socket.IO setup & handlers
│       ├── utils/                    # Utility functions
│       │   ├── generateUniqueUsername.js
│       │   ├── generatePublicURL.js
│       │   ├── generateMeetingID.js
│       │   ├── getDailyPostData.js
│       │   └── [8+ more utilities]
│       ├── helper/                   # Complex helpers
│       │   ├── email.js              # Email sending
│       │   └── sendNotifications.js  # Notification dispatch
│       ├── migration/                # Database migrations
│       │   └── migration.js
│       ├── templates/                # Email/message templates
│       └── phpfiles/                 # Legacy PHP integration
│
└── free-luma-frontend/               # React.js frontend
    ├── src/
    │   ├── index.js                  # React entry point
    │   ├── App.js                    # Root component
    │   ├── App.css                   # Global styles
    │   ├── index.css                 # Reset/globals
    │   ├── redux/                    # State management
    │   │   ├── store.js              # Store configuration
    │   │   ├── authSlice.js          # Auth state
    │   │   └── sidebarSlice.js       # Sidebar state
    │   ├── routes/                   # Router configuration
    │   │   ├── PublicRoutes.jsx      # Login/register pages
    │   │   ├── AuthenticatedRoutes.jsx # Protected pages
    │   │   └── PrivateRoute.jsx      # Route guard component
    │   ├── pages/                    # Full-page components
    │   │   ├── home/                 # Home/feed pages
    │   │   ├── auth/                 # Login/register/forgot password
    │   │   ├── profile/              # User profile pages
    │   │   ├── workshop/             # Workshop pages
    │   │   ├── daily-post/           # Daily content
    │   │   ├── daily-chapters/       # Bible chapters
    │   │   ├── chat/                 # Messaging
    │   │   ├── personal-notes/       # Notes
    │   │   ├── bookmark/             # Bookmarks
    │   │   ├── settings/             # User settings
    │   │   ├── search-friends/       # Friend search
    │   │   ├── notification/         # Notifications
    │   │   ├── video-library/        # Video content
    │   │   └── NotFound/             # 404 page
    │   ├── components/               # Reusable components
    │   │   ├── header/               # Navigation header
    │   │   ├── Sidebar/              # Main sidebar navigation
    │   │   ├── modals/               # Modal dialogs
    │   │   │   ├── CreatePost.jsx
    │   │   │   ├── CreateNote.jsx
    │   │   │   ├── RegisterModal.jsx
    │   │   │   └── [more modals]
    │   │   ├── PostCard/             # Post display component
    │   │   ├── auth-steps/           # Multi-step auth components
    │   │   ├── auth-common/          # Shared auth UI
    │   │   ├── svg/                  # SVG icon components
    │   │   ├── Loader/               # Loading spinners
    │   │   ├── GrowingTextarea/      # Auto-expanding textarea
    │   │   ├── WaveformAudioPlayer/  # Audio player
    │   │   ├── SkeletonImage/        # Loading skeleton
    │   │   └── [more components]
    │   ├── services/                 # API client services
    │   │   ├── userService.jsx       # User API calls
    │   │   ├── authService.jsx       # Auth API calls
    │   │   ├── postService.jsx       # Post API calls
    │   │   ├── workshopService.jsx   # Workshop API calls
    │   │   ├── dailyPostService.jsx  # Daily content API calls
    │   │   ├── noteService.jsx       # Notes API calls
    │   │   └── settingsService.jsx   # Settings API calls
    │   ├── interceptor/              # HTTP interceptors
    │   │   └── fetchInterceptor.jsx  # Axios interceptor for auth
    │   ├── context/                  # Context API providers
    │   │   ├── SettingsContext.jsx   # Settings state
    │   │   └── SignupContext.jsx     # Signup form state
    │   ├── hooks/                    # Custom React hooks
    │   ├── utils/                    # Frontend utilities
    │   │   ├── Helper.jsx            # General helpers
    │   │   ├── cropImage.js          # Image cropping
    │   │   ├── ageUtils.js           # Age calculations
    │   │   └── [more utilities]
    │   ├── config/                   # Frontend configuration
    │   │   ├── EnvironmentConfig.js  # Environment variables
    │   │   └── AppConfig.js          # App constants
    │   ├── constants/                # App constants
    │   │   └── constants.js          # Shared constants
    │   ├── locales/                  # i18n translations
    │   │   └── [language files]
    │   ├── assets/                   # Static files
    │   │   ├── svg/                  # SVG assets
    │   │   ├── images/               # PNG/JPG images
    │   │   ├── category/             # Category images
    │   │   ├── logos/                # Brand logos
    │   │   └── auth/                 # Auth page images
    │   ├── i18n.js                   # i18next configuration
    │   └── reportWebVitals.js        # Performance monitoring
    ├── public/                        # Static HTML/assets
    │   ├── index.html                # Root HTML file
    │   ├── favicon.ico
    │   └── [public assets]
    ├── build/                         # Production build output
    ├── package.json                   # Frontend dependencies
    └── .gitignore
```

## Directory Purposes

**free-luma-api/src/models/:**
- Purpose: Define database entity structures and relationships using Sequelize ORM
- Contains: 30+ model files, each defining a table with fields, types, defaults, and constraints
- Key files: `index.js` exports all models and establishes associations
- Relationships: Users ← → Follows, Posts, Notes, Categories, Workshop, etc.

**free-luma-api/src/controller/:**
- Purpose: Implement business logic and request handling
- Contains: 118 async functions, one function per controller file
- Pattern: Each receives `(req, res)` and returns JSON response with success/error status
- Organization: Grouped by feature domains (auth, user, posts, workshop, etc.)

**free-luma-api/src/routes/:**
- Purpose: Define HTTP endpoints and request routing
- Contains: Express Router files mapping paths to controllers
- Middleware: Authentication, file upload, validation applied per route
- Pattern: `router.method(path, [middleware], controller)` syntax

**free-luma-api/src/middleware/:**
- Purpose: Cross-cutting concerns and request preprocessing
- Files: `authMiddleware.js` (JWT validation), `multer.js` (file uploads), `activationCodeMiddleware.js` (code checks)
- Usage: Applied to route handlers via `router.use()` or route-specific application

**free-luma-api/src/config/:**
- Purpose: External service connections and environment setup
- Contains: `database.js` configures Sequelize with MySQL credentials from `.env`
- Pattern: Exports singleton instances for use across application

**free-luma-api/src/socket/:**
- Purpose: WebSocket real-time communication management
- Contains: `socket.js` initializes Socket.IO server with CORS
- Handlers: `user-connected`, `send-message`, `update-message`, `delete-message`, `typing`, `disconnect`
- State: `connectedUsers` Map tracks online users

**free-luma-api/src/utils/:**
- Purpose: Reusable utility functions for common operations
- Examples: `generateUniqueUsername.js`, `generatePublicURL.js`, `generateMeetingID.js`, `getDailyPostData.js`
- Usage: Imported and called by controllers and helpers

**free-luma-api/src/helper/:**
- Purpose: Complex, multi-step operations for cross-cutting concerns
- Files: `email.js` (email sending), `sendNotifications.js` (push notifications)
- Usage: Called by controllers to handle external service communication

**free-luma-frontend/src/redux/:**
- Purpose: Global state management using Redux Toolkit
- Files: `store.js` (store configuration), `authSlice.js` (user auth state), `sidebarSlice.js` (UI state)
- Pattern: Slices define state shape, reducers for mutations, selectors for access

**free-luma-frontend/src/routes/:**
- Purpose: Client-side routing and route access control
- Files: `PublicRoutes.jsx` (login/register), `AuthenticatedRoutes.jsx` (protected pages), `PrivateRoute.jsx` (guard)
- Pattern: Conditional route rendering based on authentication state

**free-luma-frontend/src/pages/:**
- Purpose: Full-page components representing distinct views
- Organization: Nested directories for feature areas (auth, profile, workshop, chat, etc.)
- Pattern: Each page imports components, services, and state hooks

**free-luma-frontend/src/components/:**
- Purpose: Reusable UI components for composition
- Types: Modals, buttons, cards, forms, headers, sidebars, input fields, media players
- Pattern: Functional components using React hooks (useState, useEffect, useContext)

**free-luma-frontend/src/services/:**
- Purpose: API client abstraction for backend communication
- Files: One service per domain (user, auth, post, workshop, dailyPost, note, settings)
- Pattern: Export object with named methods, use axios via interceptor
- Benefits: Deduplicates fetch logic, enables request cancellation, centralized error handling

**free-luma-frontend/src/interceptor/:**
- Purpose: HTTP request/response middleware
- File: `fetchInterceptor.jsx` is axios instance with request/response handlers
- Request: Injects Bearer token from localStorage
- Response: Catches 401/403 and redirects to login

**free-luma-frontend/src/context/:**
- Purpose: Local context providers for feature-specific state
- Files: `SettingsContext.jsx` (settings state), `SignupContext.jsx` (signup form state)
- Pattern: createContext + Provider component wrapping child trees

**free-luma-frontend/src/assets/:**
- Purpose: Static files not included in components
- Structure: Organized by type (svg, images, logos, auth, category)
- Usage: Imported in components and pages

**free-luma-frontend/src/locales/:**
- Purpose: Internationalization translation files
- Format: i18next-compatible JSON or JS files per language
- Usage: Referenced by i18n.js and i18next providers

## Key File Locations

**Entry Points:**

- **Backend:** `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/Old Code/FreeLumaDev-new/free-luma-api/index.js` — Initializes Express server, loads routes, starts Socket.IO, listens on port 3012
- **Frontend:** `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/Old Code/FreeLumaDev-new/free-luma-frontend/src/index.js` — Renders React app to DOM, wraps with Redux Provider and i18next
- **Root App:** `free-luma-frontend/src/App.js` — Main component with Router, cross-site login logic, Redux connection

**Configuration:**

- **Backend database:** `free-luma-api/src/config/database.js` — Sequelize setup
- **Frontend environment:** `free-luma-frontend/src/config/EnvironmentConfig.js` — API base URL and domain config
- **Frontend app config:** `free-luma-frontend/src/config/AppConfig.js` — App-level constants
- **Environment vars:** `free-luma-api/.env` — DB credentials, JWT secret, external API keys

**Core Logic:**

- **User model:** `free-luma-api/src/models/users.js` — User schema with 20+ fields
- **Auth controller:** `free-luma-api/src/controller/auth/register.js`, `login.js` — Registration and login logic
- **User controller:** `free-luma-api/src/controller/user/getUserProfile.js`, `updateUserProfile.js` — Profile management
- **Post controller:** `free-luma-api/src/controller/posts/addPost.js`, `getPosts.js`, `likePost.js` — Content management
- **Socket handler:** `free-luma-api/src/socket/socket.js` — Real-time messaging
- **Auth state:** `free-luma-frontend/src/redux/authSlice.js` — Login/logout state
- **Routing:** `free-luma-frontend/src/routes/AuthenticatedRoutes.jsx` — Protected page routes

**Testing:**

- **Test file pattern:** `free-luma-frontend/src/App.test.js` (minimal, not comprehensive)
- **No test coverage:** Backend tests not found, integration tests not found

## Naming Conventions

**Files:**

- Backend controllers: PascalCase verbs (e.g., `GetUserProfile.js`, `UpdateUserProfile.js`, `AddPost.js`)
- Backend routes: camelCase (e.g., `auth.js`, `user.js`, `dailyPost.js`)
- Backend models: PascalCase entities (e.g., `users.js`, `posts.js`, `workshop.js`)
- Frontend components: PascalCase (e.g., `PostCard.jsx`, `Sidebar.jsx`, `CreateNote.jsx`)
- Frontend pages: PascalCase (e.g., `Home.jsx`, `Profile.jsx`, `SearchFriends.jsx`)
- Frontend services: camelCase (e.g., `userService.jsx`, `postService.jsx`)
- Frontend hooks: camelCase prefixed with "use" (React convention)

**Directories:**

- Feature domains: camelCase (e.g., `dailyPost/`, `workshop/`, `homescreenTile/`)
- Nested components: lowercase grouping by feature (e.g., `modals/`, `svg/`, `auth-steps/`)
- Utilities: descriptive names (e.g., `utils/`, `helper/`, `services/`)

**Variables:**

- Backend request handlers: Consistent use of `req`, `res`, `next`
- Database operations: Model names in uppercase (e.g., `db.Users.findOne()`)
- Frontend state: Redux slices use camelCase (e.g., `auth`, `sidebar`)
- Frontend components: Props use camelCase (e.g., `onLanguageChange`)

**Routes:**

- API endpoints: kebab-case paths (e.g., `/api/v1/user/add-post`, `/api/v1/daily-post/get-chapters`)
- Frontend routes: kebab-case or PascalCase (e.g., `/daily-post`, `/workshop`, `/profile`)

## Where to Add New Code

**New Feature:**
- Primary code: `free-luma-api/src/controller/[feature]/[operation].js` for new business logic
- Database layer: Add model to `free-luma-api/src/models/[entity].js` if new data type
- Route: Add router to `free-luma-api/src/routes/[feature].js` and mount in `index.js`
- Frontend: Add page to `free-luma-frontend/src/pages/[feature]/` and route in `AuthenticatedRoutes.jsx`
- Frontend service: Add methods to `free-luma-frontend/src/services/[feature]Service.jsx`

**New Component/Module:**
- Backend component: `free-luma-api/src/controller/[feature]/NewComponent.js` (async function)
- Frontend component: `free-luma-frontend/src/components/[Feature]/index.jsx` (functional component with hooks)
- Complex helper: `free-luma-api/src/helper/[operation].js`
- Custom hook: `free-luma-frontend/src/hooks/use[Name].js`

**Utilities:**
- Shared backend helpers: `free-luma-api/src/utils/[operation].js`
- Frontend utilities: `free-luma-frontend/src/utils/[operation].js`
- Constants: `free-luma-frontend/src/constants/constants.js`

**Middleware/Interceptors:**
- Backend middleware: `free-luma-api/src/middleware/[name]Middleware.js`
- Frontend interceptors: `free-luma-frontend/src/interceptor/[name]Interceptor.jsx`

**Database:**
- New model: `free-luma-api/src/models/[EntityName].js` following Sequelize pattern in existing models
- Register in: `free-luma-api/src/models/index.js` (export and establish relationships)

**Real-Time Features:**
- Socket handlers: Add event listeners in `free-luma-api/src/socket/socket.js` within `io.on('connection')`
- Frontend listeners: Use `socket.on()` in React components via useEffect

## Special Directories

**free-luma-api/public/:**
- Purpose: Static file storage for user uploads
- Generated: Yes (created by multer during file uploads)
- Committed: No (gitignore excludes uploads)
- Structure: Subdirectories by type (`user/`, `posts/`, etc.)

**free-luma-frontend/build/:**
- Purpose: Production build output
- Generated: Yes (created by `npm run build`)
- Committed: No (gitignore excludes)
- Contains: Minified, optimized React app bundle

**free-luma-api/src/migration/:**
- Purpose: Database schema initialization/updates
- Generated: No
- Committed: Yes
- Usage: Run via `npm run migration` to initialize database schema

**free-luma-frontend/src/locales/:**
- Purpose: i18n translation files
- Generated: No
- Committed: Yes
- Format: JSON files per language for multi-language support

**free-luma-api/node_modules/, free-luma-frontend/node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (created by npm install)
- Committed: No (gitignore excludes)

---

*Structure analysis: 2026-02-11*
