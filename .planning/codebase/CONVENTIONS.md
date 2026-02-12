# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- Components: PascalCase, index.jsx pattern (e.g., `PostCard/index.jsx`, `Sidebar/index.jsx`)
- Controllers: camelCase + descriptor (e.g., `getSettings.js`, `createWorkshop.js`)
- Services: camelCase with Service suffix (e.g., `postService.jsx`, `authService.jsx`, `userService.jsx`)
- Models: PascalCase (e.g., `Users.js`, `Posts.js`, `Workshop.js`)
- Utils: camelCase with descriptor (e.g., `getUserAuthToken.js`, `generateMeetingID.js`)
- Middleware: camelCase with Middleware suffix (e.g., `authMiddleware.js`, `multer.js`)

**Functions:**
- Controllers: PascalCase for exported functions (e.g., `GetSettings`, `CreateWorkshop`)
- Utilities: camelCase for helpers (e.g., `getUserFromToken`, `generateRecurringDates`)
- React components: PascalCase (e.g., `PostCard`, `SkeletonImage`)
- Service methods: camelCase (e.g., `PostService.getPrayerWallPosts()`, `UserService.createNotification()`)

**Variables:**
- camelCase for all local variables and properties
- Boolean prefixes: `is`, `has`, `can` (e.g., `isAuthenticated`, `isLiked`, `hasError`)
- State variables: camelCase (e.g., `postData`, `currentUser`, `isLoginModalOpen`)

**Constants:**
- UPPER_SNAKE_CASE for constants (e.g., `UNDER_AGE_LIMIT`, `FLP`, `PUBLIC`)
- Config values use UPPER_SNAKE_CASE in environment (e.g., `ACCESS_TOKEN`, `BIBLE_FRONTEND_URL`)
- URL segments use lowercase with hyphens (e.g., `/prayer-wall-posts`, `/daily-post`, `/feed-posts`)

**Types:**
- Model names: PascalCase (e.g., `Users`, `Posts`, `Workshop`)
- Enum values: UPPER_SNAKE_CASE (e.g., `DAILY`, `WEEKLY`, `MONTHLY`, `PRIVATE`, `PUBLIC`)
- JSON keys: snake_case in database/API (e.g., `first_name`, `last_name`, `profile_picture`)

## Code Style

**Formatting:**
- No explicit formatter configured (Prettier not found in config)
- Indentation: 2 spaces (observed in all files)
- Line length: No strict limit enforced
- Semicolons: Inconsistently used (both with and without)

**Linting:**
- ESLint configuration: extends `react-app` and `react-app/jest` (standard CRA config)
- No custom eslint config file (uses Create React App defaults)
- No pre-commit hooks configured

**File Structure:**
- Frontend: JSX files use `.jsx` extension for React components, `.js` for utilities
- Backend: All files use `.js` extension, no TypeScript
- Mixed extensions in same project (`.js` and `.jsx`)

## Import Organization

**Order:**
1. External dependencies (React, libraries)
2. Relative imports from utils, services, config
3. Context providers and custom hooks
4. Component imports

**Example from PostCard/index.jsx:**
```javascript
import React, { useEffect, useRef } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LoginModal from "../../components/modals/LoginModal";
import { useSelector } from "react-redux";
// External libraries
import Slider from "react-slick";
// Then components
import Comments from "../../components/modals/Comments";
import Icons from "../../components/svg";
// Then services/utils
import PostService from "../../services/postService";
import UserService from "../../services/userService";
// Then config/context
import { env } from "../../config/EnvironmentConfig";
import { useSettings } from "../../context/SettingsContext";
```

**Path Aliases:**
- No path aliases configured (no jsconfig.json or tsconfig.json with paths)
- Uses relative paths consistently (e.g., `../../components`, `../../services`)

## Error Handling

**Backend Patterns:**

Controllers wrap operations in try-catch blocks:
```javascript
const GetSettings = async (req, res) => {
    try {
        const settings = await db.Settings.findAll({
            attributes: ["key_name", "value"]
        });
        return res.status(200).json({
            success: true,
            message: "Settings fetched successfully",
            data: settings,
        });
    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
}
```

Response format is standardized:
```javascript
{ success: boolean, message: string, data?: any, success_type?: string }
```

**Frontend Patterns:**

Components use try-catch in async operations:
```javascript
const handleLikeButton = async (post) => {
    try {
        // Optimistic update
        setPostData((prevPosts) =>
            prevPosts.map((p) =>
                p.id === post.id
                    ? {
                        ...p,
                        isLiked: !p.isLiked,
                        likes_count: p.isLiked ? p.likes_count - 1 : p.likes_count + 1,
                    }
                    : p
            )
        );

        const response = await PostService.likePost(post.id);

        if (response?.success) {
            // Handle success
        }
    } catch (error) {
        console.error("Error while liking post:", error);
    }
};
```

Service methods return promises with response objects containing `success` flag:
```javascript
const response = await PostService.deletePost(id);
if (response.success) {
    // Process success
}
```

## Logging

**Framework:** `console` object directly (no logging library)

**Patterns:**
- `console.log()` for general information and debugging
- `console.error()` for error tracking in catch blocks
- Often logs request/response data during development (should be removed in production)

**Examples:**
```javascript
// In controllers
console.log("date = ", date);
console.log("workshopsToCreate = ", workshopsToCreate);
console.error("Internal Server Error:", error);

// In components
console.log("User under age limit:", isUnderAge);
console.log(res); // After service calls
```

Middleware logs all requests:
```javascript
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} - ${req.url}`);
  next();
});
```

## Comments

**When to Comment:**
- Inline comments for complex logic are rare; code is mostly self-documenting
- Comments mark important sections (e.g., "Socket.IO connection", "Routes")
- Commented-out code is left in place frequently (e.g., old formatCreatedAt implementation)

**JSDoc/TSDoc:**
- Not used anywhere in the codebase
- No function documentation patterns observed
- Comments are informal and sparse

**Example - Commented code preservation:**
```javascript
// const formatCreatedAt = (createdAt) => {
//   const createdDate = new Date(createdAt);
//   // ... old implementation
// };

// Actually implemented version follows
const formatCreatedAt = (createdAt) => {
    // new implementation
};
```

## Function Design

**Size:**
- Large components with 500+ lines common (e.g., PostCard ~580 lines)
- Controllers typically 30-100 lines
- Utility functions stay small (10-30 lines)

**Parameters:**
- Destructuring used extensively in both ES6 and React
- Props destructuring in components: `const { postdata, refreshEditPost } = props`
- Request object destructuring: `const { user } = req.user`
- Body destructuring: `const { topic_name, date, start_time, ... } = req.body`

**Return Values:**
- Controllers: Always return `res.status().json()` with structured response
- Services: Return promises that resolve to response objects `{ success, message, data }`
- Components: JSX elements or null (conditional rendering common)
- Utility functions: Explicit returns, sometimes wrapped in promises

## Module Design

**Exports:**
- Controllers: Single default export (e.g., `module.exports = GetSettings`)
- Services: Named object with methods (e.g., `export default PostService`)
- Models: Default export of Sequelize model (e.g., `module.exports = Users`)
- React components: Named PascalCase default export (e.g., `export default PostCard`)
- Utilities: Default export for single functions or named exports for multiple helpers

**Example - Service exports:**
```javascript
const PostService = {};

PostService.getPrayerWallPosts = function (offset, limit, dateFilter, data) {
  return fetch({ ... });
};

PostService.likePost = function (id) {
  return fetch({ ... });
};

export default PostService;
```

**Example - Utility exports:**
```javascript
export const validateEmail = (email) => { ... };
export const formatTo24HourTime = (...) => { ... };

const Utils = {
  validateEmail,
  formatTo24HourTime,
};

export default Utils;
```

**Barrel Files:**
- Models have central index file: `src/models/index.js` that exports all models
- `src/components/svg/index.jsx` exports SVG icon component
- Not used extensively elsewhere; most imports are direct file imports

## API Response Pattern

**Standard success response:**
```javascript
{
  success: true,
  message: "Resource fetched/created/updated/deleted successfully",
  data: { /* resource data */ },
  success_type: "optional_specific_type" // Only in some controllers
}
```

**Standard error response:**
```javascript
{
  success: false,
  message: "Error description or validation message"
}
```

**Status codes used:**
- 200: GET success
- 201: POST/creation success
- 400: Bad request or validation error
- 401: Unauthorized (no token)
- 403: Forbidden (invalid/expired token)
- 404: Resource not found
- 500: Internal server error

## Request/Response Handling

**Frontend services use fetch interceptor:**
- Located at `src/interceptor/fetchInterceptor`
- All API calls go through this interceptor
- Headers include `public-request: true` for endpoints accessible without auth

**Database access:**
- Sequelize ORM used throughout backend
- Models define schema with attributes and relationships
- Controllers use `db.ModelName.findAll()`, `.findOne()`, `.create()`, etc.

## State Management

**Frontend:**
- Redux with Redux Toolkit (`@reduxjs/toolkit`)
- Store configured in `src/redux/store.js`
- Slices: `authSlice.js`, `sidebarSlice.js`
- Context API used for feature-specific state: `SignupContext`, `SettingsContext`
- Local component state with `useState` for UI state

**Backend:**
- Stateless - all state stored in database via Sequelize
- In-memory caching possible but not heavily used
- Socket.IO for real-time communication

---

*Convention analysis: 2026-02-11*
