# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** MVC (Model-View-Controller) layered architecture with separation between frontend (React) and backend (Express.js + Node.js).

**Key Characteristics:**
- Monolithic backend with controller-per-feature pattern
- Frontend uses React with Redux state management and context API
- Real-time communication via Socket.IO for messaging and notifications
- Sequelize ORM for MySQL database abstraction
- REST API with bearer token JWT authentication
- Middleware-based request processing pipeline

## Layers

**Database Layer:**
- Purpose: Persistent storage and data modeling
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/models/`
- Contains: Sequelize model definitions for 30+ entities (Users, Posts, Notes, Workshop, Daily Posts, etc.)
- Depends on: MySQL via Sequelize, connection config
- Used by: All controller functions through `db` object

**Data Access Layer (Models):**
- Purpose: Define data structures and relationships using Sequelize ORM
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/models/`
- Key file: `index.js` exports all models and establishes relationships
- Contains:
  - User model with profile, settings, and preference fields
  - Content models (Posts, Notes, DailyPosts, Comments)
  - Social models (Follows, Workshop, Chat)
  - Engagement models (Likes, Categories, Bookmarks)
- Relationships: HasMany, BelongsTo associations between entities

**Business Logic Layer (Controllers):**
- Purpose: Handle request processing, validation, and response formatting
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/controller/`
- Contains: 118 controller functions organized by feature (auth, user, posts, workshop, etc.)
- Pattern: Each controller is a single async function that receives `(req, res)` and returns JSON
- Dependencies: Database models, utilities, helpers

**API Layer (Routes):**
- Purpose: Map HTTP endpoints to controllers
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/routes/`
- Files: `auth.js`, `user.js`, `dailyPost.js`, `workshop.js`, `settings.js`
- Pattern: Express Router with middleware chains for auth, file upload, validation

**Middleware Layer:**
- Purpose: Cross-cutting concerns for request processing
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/middleware/`
- Contents:
  - `authMiddleware.js`: JWT token validation and user context injection
  - `multer.js`: File upload handling for profile pictures and media
  - `activationCodeMiddleware.js`: Activation code validation for registration

**Real-Time Layer (Socket.IO):**
- Purpose: Bidirectional communication for messaging and notifications
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/socket/socket.js`
- Manages: User connection tracking, message routing, typing indicators
- Events: `user-connected`, `send-message`, `update-message`, `delete-message`, `typing`, `disconnect`
- Data: Persists messages via StoreChatMessages controller

**Configuration Layer:**
- Purpose: Environment setup and constants
- Location: `Old Code/FreeLumaDev-new/free-luma-api/src/config/`
- Contains:
  - `database.js`: Sequelize connection setup with MySQL driver
  - Environment variables from `.env` file

**Utilities & Helpers:**
- Purpose: Reusable functions and external service integration
- Locations:
  - `src/utils/`: Utility functions (generateMeetingID, generateUniqueUsername, getDailyPostData, etc.)
  - `src/helper/`: Complex helpers (email.js, sendNotifications.js)
- Used by: Controllers and other layers

**Frontend Application Layer (React):**
- Purpose: User interface and client-side business logic
- Location: `Old Code/FreeLumaDev-new/free-luma-frontend/src/`
- Architecture: Single-Page Application with route-based code splitting

**Frontend State Management:**
- Redux store at `src/redux/store.js`
- Slices: `authSlice.js` (auth state), `sidebarSlice.js` (sidebar state)
- Context: `SettingsContext.jsx`, `SignupContext.jsx` for local state
- Pattern: Redux Toolkit with createSlice for reducers

**Frontend Service Layer:**
- Purpose: API communication abstraction
- Location: `Old Code/FreeLumaDev-new/free-luma-frontend/src/services/`
- Services: `userService.jsx`, `authService.jsx`, `postService.jsx`, `workshopService.jsx`, `dailyPostService.jsx`, `noteService.jsx`, `settingsService.jsx`
- Interceptor: `src/interceptor/fetchInterceptor.jsx` handles token injection and auth redirect

**Frontend Component Architecture:**
- Purpose: Reusable UI elements
- Location: `Old Code/FreeLumaDev-new/free-luma-frontend/src/components/`
- Organization by feature: modals, auth-steps, header, Sidebar, PostCard, etc.
- Pattern: Functional components with hooks

**Frontend Page/Route Layer:**
- Purpose: Full-page views for different routes
- Location: `Old Code/FreeLumaDev-new/free-luma-frontend/src/pages/`
- Pages: home, daily-post, workshop, chat, settings, profile, prayer-wall, feed, bookmark, notes, etc.
- Router: React Router v7 with authenticated/public route splitting

## Data Flow

**User Authentication Flow:**

1. User submits credentials to `/auth/login` or `/auth/register` endpoint
2. Backend validates input and email format (register only)
3. Register: Check for duplicate email, hash password with bcrypt, create user record
4. Login: Find user by email, compare password hash with bcrypt
5. On success: JWT token generated with user payload
6. Frontend stores token in `localStorage.auth_token`
7. Subsequent requests include token in `Authorization: Bearer <token>` header
8. `authMiddleware.js` validates JWT and injects user into `req.user`
9. Cross-site login: Token shared via cookies with domain sharing (see `App.js`)

**Content Creation Flow (Posts):**

1. User submits post data via form (AddPost component)
2. Frontend POST to `/api/v1/user/add-post` with authentication
3. Controller validates input, handles file uploads via multer
4. Creates Post record in database with user_id, content, media paths
5. Updates user's posts_count
6. Returns created post with formatted media URLs
7. Frontend receives response and updates Redux/UI state

**Real-Time Messaging Flow:**

1. User connects: emits `user-connected` event with user_id
2. Socket.IO maps user_id → socket_id in `connectedUsers` Map
3. User sends message: emits `send-message` event
4. Backend stores message via StoreChatMessages controller
5. Looks up receiver's socket_id in connectedUsers
6. Emits `receive-message` to receiver's socket
7. Sender receives `sent-acknowledge` confirmation
8. All message updates (edit, delete) routed through same flow

**State Management Data Flow:**

1. Redux store centralizes auth state (isAuthenticated, user, token)
2. App.js subscribes to auth state and route visibility
3. Actions dispatched from AuthService responses
4. Components select auth state with useSelector
5. Context API used for local feature-specific state (Settings, Signup forms)

## Key Abstractions

**Database Connection (Sequelize):**
- Purpose: Abstract MySQL operations
- Location: `src/config/database.js`
- Pattern: Singleton instance exported across models and controllers
- Benefits: Database agnostic queries, transaction support

**Model Definitions:**
- Purpose: Define entity shapes and relationships
- Example: `src/models/users.js` defines Users table structure, fields, and associations
- Pattern: Sequelize.define() returns model with CRUD methods

**Authentication Token:**
- Purpose: Stateless user identification
- Implementation: JWT with payload containing user object
- Secret: `process.env.ACCESS_TOKEN`
- Validation: `authMiddleware.js` checks token expiration and validity

**File Upload Handler (Multer):**
- Purpose: Process multipart file uploads
- Location: `src/middleware/multer.js`
- Pattern: Creates upload directory per feature ("user", "posts", etc.)
- Returns: File path stored in database, accessible via `/public/[type]/[filename]`

**Socket.IO Connection Map:**
- Purpose: Track online users for real-time routing
- Structure: `Map<userId, socketId>`
- Updates: Populated on `user-connected`, cleaned on `disconnect`
- Use: Enables direct user-to-user message delivery

**API Service Layer (Frontend):**
- Purpose: Centralize API calls and error handling
- Pattern: Object with named methods for each endpoint
- Example: `UserService.getUserPosts(offset, limit, options)`
- Benefit: Deduplicates fetch logic, enables request cancellation

**Axios Interceptor:**
- Purpose: Cross-cutting request/response handling
- Location: `src/interceptor/fetchInterceptor.jsx`
- Request: Injects Bearer token from localStorage
- Response: Catches 401/403 and redirects to login
- Error: Handles request cancellation (CanceledError)

## Entry Points

**Backend Server:**
- Location: `Old Code/FreeLumaDev-new/free-luma-api/index.js`
- Triggers: `npm start` (runs with nodemon on port 3012 by default)
- Responsibilities:
  - Express app initialization with middleware stack
  - CORS configuration allowing all origins
  - Body parser setup for JSON and URL-encoded (35MB limit)
  - Route registration (`/api/v1/auth`, `/api/v1/user`, etc.)
  - HTTP server creation for Socket.IO
  - Socket.IO initialization via initializeSocket()

**Frontend Application:**
- Location: `Old Code/FreeLumaDev-new/free-luma-frontend/src/index.js`
- Entry: ReactDOM.createRoot renders App component
- Triggers: `npm start` (CRA dev server)
- App.js responsibilities:
  - Redux Provider wrapping
  - i18n initialization
  - Route setup (PublicRoutes vs AuthenticatedRoutes)
  - Cross-site cookie-based login handling
  - Auth token restoration from localStorage/cookies

**Route Entry Points:**
- Public routes: `/`, `/auth/login`, `/auth/register` (PublicRoutes.jsx)
- Authenticated routes: `/home`, `/daily-post`, `/workshop`, `/chat`, `/profile`, etc. (AuthenticatedRoutes.jsx)
- Auth check: PrivateRoute component guards protected routes

## Error Handling

**Strategy:** Middleware-based with try-catch in controllers, error details returned to frontend.

**Patterns:**
- Controllers wrap async logic in try-catch blocks
- Catch blocks log errors and return 400/500 JSON responses with message
- Frontend interceptor catches 401/403 and redirects to login
- Frontend Toaster/toast notifications display errors to users
- Socket.IO errors logged to console, graceful disconnection

**HTTP Status Codes:**
- 200: Successful response
- 400: Invalid input validation error
- 401: Missing/invalid authentication
- 403: Token expired or invalid
- 409: Conflict (e.g., duplicate email)
- 500: Server error with message returned

## Cross-Cutting Concerns

**Logging:** Console.log statements throughout controllers and middleware. Request logging middleware logs all incoming requests with timestamp, method, URL. Socket.IO events logged with emoji indicators (🟢 connection, 📩 message, 🔴 disconnect).

**Validation:** Input validation in controllers with regex checks (email), required field checks, type assertions. No centralized validation schema library (Joi/Yup).

**Authentication:** JWT bearer token scheme with `authMiddleware.js` protecting most routes. Token injected by frontend interceptor on every request. Activation code validation for registration.

**Authorization:** Simple presence check (authenticated vs public). No role-based access control (RBAC) or permission system implemented. Account visibility (PUBLIC/PRIVATE) enforced in user service methods.

---

*Architecture analysis: 2026-02-11*
