# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner:**
- Jest (via Create React App)
- Configured through CRA defaults in `package.json`
- Config file: `react-scripts` handles configuration internally

**Assertion Library:**
- Jest built-in assertions
- Testing Library for React component testing

**Run Commands:**
```bash
npm test                   # Run all tests in watch mode
npm test -- --coverage     # Run with coverage report
npm run build              # Build for production (includes test optimization)
```

**Backend:**
- No testing framework explicitly configured
- No test files found in `free-luma-api` codebase
- No test runners or assertions libraries in dependencies

## Test File Organization

**Frontend - Current State:**
- Single test file found: `src/App.test.js`
- No consistent test organization pattern established
- Tests would ideally be co-located: `src/components/PostCard/PostCard.test.jsx`
- Test naming pattern not established

**Backend:**
- No test files present in codebase
- Testing infrastructure needs to be implemented

**Expected structure (based on config):**
```
src/
├── components/
│   ├── PostCard/
│   │   ├── index.jsx
│   │   └── index.test.jsx
│   ├── Sidebar/
│   │   ├── index.jsx
│   │   └── index.test.jsx
│   └── modals/
│       └── LoginModal/
│           ├── index.jsx
│           └── index.test.jsx
├── services/
│   ├── postService.jsx
│   └── postService.test.jsx
└── utils/
    ├── Helper.jsx
    └── Helper.test.jsx
```

## Test Structure

**Frontend - Test framework setup (from setupTests.js):**
```javascript
// src/setupTests.js
import '@testing-library/jest-dom';
```

**React Testing Library patterns (installed but minimal usage):**
- `@testing-library/react` ^13.4.0
- `@testing-library/jest-dom` ^5.17.0
- `@testing-library/user-event` ^13.5.0

**Existing test file - App.test.js:**
```javascript
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
```

## Mocking

**Framework:**
- Jest provides built-in mocking capabilities
- `jest.mock()` available for module mocking
- `jest.fn()` for creating mock functions

**Patterns Not Currently Implemented:**
- No mock implementations found in codebase
- No test utilities or mock factories created
- Service mocking would need to be added

**Example pattern for implementing mocks (to be added):**
```javascript
// Mock a service
jest.mock('../../services/postService', () => ({
  getPrayerWallPosts: jest.fn(),
  likePost: jest.fn(),
  deletePost: jest.fn(),
}));

// Mock a context
jest.mock('../../context/SettingsContext', () => ({
  useSettings: jest.fn(() => ({
    settingsValues: { UNDER_AGE_LIMIT: 18 },
    settingsLoading: false,
  })),
}));

// Mock Redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn((selector) => selector({ auth: { isAuthenticated: true } })),
  useDispatch: jest.fn(),
}));
```

**What to Mock:**
- API service calls (PostService, UserService, etc.)
- External library functions (socket.io-client, date-fns)
- Redux selectors and dispatch
- Context hooks
- Browser APIs (localStorage, window.location)

**What NOT to Mock:**
- Utility functions like validation helpers
- Component rendering (unless testing in isolation)
- Pure functions
- React hooks themselves (useState, useEffect)

## Fixtures and Factories

**Test Data - Not Currently Implemented:**

Expected pattern for test data (to be added):
```javascript
// src/test/fixtures/user.fixture.js
export const mockUser = {
  id: 1,
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  username: "johndoe",
  profile_picture: "http://example.com/pic.jpg",
  isAuthenticated: true,
};

// src/test/fixtures/post.fixture.js
export const mockPost = {
  id: 1,
  user: mockUser,
  text_content: "Sample post content",
  media: [],
  likes_count: 5,
  comments_count: 2,
  isLiked: false,
  createdAt: new Date().toISOString(),
  is_updated: false,
};

// src/test/factories/user.factory.js
export const createMockUser = (overrides = {}) => ({
  ...mockUser,
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  ...mockPost,
  user: createMockUser(overrides.user),
  ...overrides,
});
```

**Location:**
- Should be created at `src/test/fixtures/` for static test data
- Should be created at `src/test/factories/` for factory functions
- Fixtures and factories should mirror domain objects in `src/services/`

## Coverage

**Requirements:**
- No coverage threshold enforced currently
- No CI/CD pipeline configured to check coverage

**View Coverage:**
```bash
npm test -- --coverage
```

**Expected output locations:**
```
coverage/
├── lcov-report/    # HTML coverage report (view in browser)
├── lcov.info       # LCOV format
└── coverage.json   # JSON format
```

**Recommended coverage targets:**
- Services: 80%+ (high-value test targets)
- Utils: 90%+ (pure functions, easy to test)
- Components: 60-70% (UI testing is complex)
- Controllers: 70%+ (business logic)

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, pure components
- Approach: Test function with various inputs
- Example target: `src/utils/Helper.jsx` validation functions

```javascript
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBeTruthy();
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid-email')).toBeFalsy();
  });
});
```

**Integration Tests:**
- Scope: Component + service interaction, redux state + component rendering
- Approach: Render component, mock service, verify behavior

```javascript
describe('PostCard Component', () => {
  it('should display post and handle like action', async () => {
    const mockPost = createMockPost();
    PostService.likePost = jest.fn().mockResolvedValue({ success: true });

    render(<PostCard postdata={[mockPost]} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    expect(PostService.likePost).toHaveBeenCalledWith(mockPost.id);
  });
});
```

**E2E Tests:**
- Framework: Not implemented (Cypress or Playwright would be options)
- Scope: Would test complete user workflows (signup, login, post creation)
- Status: Recommended for future implementation

## Common Patterns

**Async Testing (to be implemented):**
```javascript
// Using async/await
it('should fetch posts successfully', async () => {
  const mockPosts = [createMockPost(), createMockPost()];
  PostService.getFeedPosts = jest.fn().mockResolvedValue({
    success: true,
    data: mockPosts,
  });

  render(<FeedPage />);

  const posts = await screen.findAllByText(/comment/i);
  expect(posts.length).toBe(2);
});

// Using waitFor
it('should show loading state then posts', async () => {
  render(<FeedPage />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/first post/i)).toBeInTheDocument();
  });
});
```

**Error Testing (to be implemented):**
```javascript
it('should handle API error gracefully', async () => {
  PostService.likePost = jest.fn().mockRejectedValue(
    new Error('Network error')
  );

  render(<PostCard postdata={[mockPost]} />);
  const likeButton = screen.getByRole('button', { name: /like/i });

  fireEvent.click(likeButton);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});

it('should handle 500 server error', async () => {
  PostService.deletePost = jest.fn().mockResolvedValue({
    success: false,
    message: 'Internal Server Error',
  });

  render(<PostCard postdata={[mockPost]} />);
  const deleteButton = screen.getByRole('button', { name: /delete/i });

  fireEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

**Redux Testing (to be implemented):**
```javascript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../redux/authSlice';

it('should render authenticated component when user is logged in', () => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        isAuthenticated: true,
        user: createMockUser(),
      },
    },
  });

  render(
    <Provider store={store}>
      <ProtectedComponent />
    </Provider>
  );

  expect(screen.getByText(/protected content/i)).toBeInTheDocument();
});
```

**Context Testing (to be implemented):**
```javascript
it('should provide settings from context', () => {
  const mockSettings = {
    UNDER_AGE_LIMIT: 18,
    DAILY_POST_TIME: '08:00',
  };

  render(
    <SettingsProvider value={{ settingsValues: mockSettings }}>
      <PostCard postdata={[mockPost]} />
    </SettingsProvider>
  );

  expect(screen.getByText(/age appropriate content/i)).toBeInTheDocument();
});
```

## Test Dependencies

**Installed:**
- `@testing-library/react@^13.4.0` - React component testing
- `@testing-library/jest-dom@^5.17.0` - Custom Jest matchers
- `@testing-library/user-event@^13.5.0` - User interaction simulation

**Backend - To be added:**
- `jest` - Test runner (if not using CRA)
- `supertest` - HTTP assertion library for API endpoints
- `sinon` - Mocking/stubbing library (optional, Jest has built-in)

## Current Test Status

**Frontend:**
- Minimal testing in place (only default CRA test file exists)
- Test infrastructure ready (Jest + Testing Library)
- Most components untested

**Backend:**
- No tests implemented
- No testing infrastructure configured
- Controllers and services lack test coverage

## Priority Testing Areas

**High Priority (Critical functionality):**
- `src/services/authService.jsx` - Authentication flow
- `src/services/postService.jsx` - Post CRUD operations
- Backend auth controllers - JWT validation, token generation
- Backend post controllers - CRUD operations

**Medium Priority (Business logic):**
- `src/components/PostCard/index.jsx` - Main feed component
- Redux slices - State management
- Service integration tests - Service + API interaction
- Workshop creation logic - Complex business rules

**Low Priority (UI components):**
- Simple presentational components
- Modal components (unless they contain logic)
- Utility components like `SkeletonImage`

---

*Testing analysis: 2026-02-11*
