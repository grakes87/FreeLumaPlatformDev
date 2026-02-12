# Codebase Concerns

**Analysis Date:** 2026-02-11

## Critical Security Issues

**Exposed API Credentials:**
- Issue: Cloudinary API credentials hardcoded in source code with full authentication URL
- Files: `Old Code/freeluma-prod/code/php/edit_user_profile.php` (line 24), `Old Code/freeluma-prod/code/php/signup.php` (line 24), `Old Code/freeluma-prod/code/php/change_user_image.php` (line 16)
- Impact: Complete compromise of Cloudinary account. Attackers can delete, modify, and upload images to the account
- Fix approach: Move all API credentials to environment variables (.env file), never commit secrets

**Facebook App Credentials Exposed:**
- Issue: Facebook App ID and App Secret hardcoded in source code
- Files: `Old Code/freeluma-prod/code/php/fb-callback.php` (lines 10-12)
- Impact: Account takeover attacks, data theft, impersonation
- Fix approach: Move to environment variables, rotate credentials immediately

**Plaintext Password Transmission:**
- Issue: Password sent in "forgot password" feature reveals plaintext password via email
- Files: `Old Code/freeluma-prod/code/php/forgot_password.php` (line 24)
- Impact: Complete account compromise. Any intercepted email or server breach exposes all passwords
- Fix approach: Implement password reset tokens with expiration instead of revealing passwords

**Session Credential Storage:**
- Issue: Authentication credentials (username, email) stored in PHP session and passed to JavaScript localStorage
- Files: `Old Code/freeluma-prod/code/php/login_complete.php` (lines 5-11, 45), `Old Code/freeluma-prod/code/js/main.js` (line 58)
- Impact: Exposure to XSS attacks. localStorage is accessible to JavaScript and vulnerable to DOM-based attacks
- Fix approach: Use secure HTTP-only cookies for authentication tokens instead of localStorage

**Inadequate Input Validation:**
- Issue: User input from POST requests used directly in database queries with minimal validation
- Files: `Old Code/freeluma-prod/code/php/comment.php` (lines 14-17), `Old Code/freeluma-prod/code/php/like.php` (lines 9-12)
- Impact: Potential for SQL injection (though SQLite3 parameterized queries mitigate risk), XSS when data is displayed, NoSQL injection if future database changes occur
- Fix approach: Add explicit input type validation, length limits, and whitelist validation where applicable

**Missing CSRF Protection:**
- Issue: No CSRF tokens present in any POST endpoints
- Files: All PHP files in `Old Code/freeluma-prod/code/php/` (e.g., like.php, comment.php, signup.php)
- Impact: Cross-site request forgery attacks where attackers can perform actions on behalf of authenticated users
- Fix approach: Implement CSRF token generation and validation on all state-changing operations

## Tech Debt & Architecture Issues

**Database Inconsistency:**
- Issue: Multiple database paths and connection methods used inconsistently
- Files: `Old Code/freeluma-prod/code/php/db_connection.php` (SQLite3), `Old Code/freeluma-prod/code/php/fb-callback.php` (PDO to different path)
- Impact: Connection failures, data synchronization issues, difficult debugging
- Fix approach: Standardize to single database connection method and path

**Hardcoded URLs:**
- Issue: Redirect URLs hardcoded in source code pointing to specific domains
- Files: `Old Code/freeluma-prod/code/php/login_complete.php` (line 10), `Old Code/freeluma-prod/code/php/google-profile-setup.php` (line 156)
- Impact: Breaks in different environments, difficult to deploy to different domains, XSS vulnerability through redirect
- Fix approach: Use configuration or environment variables for all URLs

**Mixed PHP/HTML in Single Files:**
- Issue: Database logic, authentication, and HTML presentation tightly coupled
- Files: `Old Code/freeluma-prod/code/php/audioplayer.php` (462 lines), `Old Code/freeluma-prod/code/php/google-profile-setup.php` (168 lines)
- Impact: Difficult to maintain, test, and refactor. Security flaws are harder to isolate
- Fix approach: Separate concerns - create dedicated API endpoints, return JSON, keep presentation in frontend

**Error Information Disclosure:**
- Issue: Detailed error messages logged and potentially exposed through error_log.txt
- Files: All files in `Old Code/freeluma-prod/code/php/` write to error_log.txt (237KB)
- Impact: Error logs contain sensitive information (file paths, database structure, user data). Exposed error log can reveal system vulnerabilities
- Fix approach: Log to secure server-side location, return generic errors to clients

**Global Database Connection:**
- Issue: Database connections opened at module level without proper cleanup
- Files: `Old Code/freeluma-prod/code/php/db_connection.php` (line 11)
- Impact: Connection leaks, resource exhaustion, race conditions in concurrent requests
- Fix approach: Use connection pooling, create connections within request scope, ensure cleanup in finally blocks

## Known Bugs

**Column Name Inconsistency:**
- Issue: Query checks for both 'Liked' and 'liked' columns
- Files: `Old Code/freeluma-prod/code/php/load_data.php` (lines 50, 58-63)
- Trigger: When user like status is queried, code checks both possible column names, indicating schema inconsistency
- Workaround: Current code handles both, but indicates data integrity issue

**Email Used as Identifier:**
- Issue: Some code uses email as username/identifier, some uses username field
- Files: `Old Code/freeluma-prod/code/php/fb-callback.php` (line 32), `Old Code/freeluma-prod/code/php/google-profile-setup.php` (line 19), `Old Code/freeluma-prod/code/php/like.php` (accepts user as string)
- Symptoms: Users logged in with email can't interact with posts/comments created by username, data corruption
- Impact: User experience breaks, data cannot be properly associated

## Performance Bottlenecks

**Unoptimized Database Queries:**
- Problem: No indexes, full table scans on every request
- Files: `Old Code/freeluma-prod/code/php/load_data.php` (lines 22, 34, 50)
- Cause: No indexes on date, category, username fields. COUNT(*) on every page load without WHERE clause optimization
- Improvement path: Add indexes on `date`, `category`, `username`, `user` columns. Consider denormalizing counts

**Inefficient Like/Comment Loading:**
- Problem: Full table scans to load user-specific data without pagination
- Files: `Old Code/freeluma-prod/code/php/load_likes.php`
- Cause: No LIMIT clauses, queries return all matching records
- Improvement path: Implement pagination, caching for like/comment counts

**String Manipulation on Every Request:**
- Problem: strtolower() called repeatedly on usernames for comparison
- Files: `Old Code/freeluma-prod/code/php/change_password.php` (line 9), `Old Code/freeluma-prod/code/php/signup.php` (line 12)
- Cause: Username normalization should happen at insert time, not query time
- Improvement path: Store normalized usernames, create unique constraint on LOWER(username)

**Cloudinary Upload on Signup:**
- Problem: Synchronous image upload during user registration, blocking request completion
- Files: `Old Code/freeluma-prod/code/php/signup.php` (lines 51-69)
- Cause: Waits for Cloudinary response before returning to user
- Improvement path: Queue image upload as background job, store temporary placeholder

**Synchronous Email Sending:**
- Problem: Password reset emails sent synchronously during request, blocking request
- Files: `Old Code/freeluma-prod/code/php/forgot_password.php` (line 40)
- Cause: file_get_contents() blocks waiting for remote server response
- Improvement path: Queue email sending, implement asynchronous delivery

## Fragile Areas

**Authentication System:**
- Files: `Old Code/freeluma-prod/code/php/signup.php`, `Old Code/freeluma-prod/code/php/change_password.php`, SSO endpoints
- Why fragile: Multiple auth methods (username/password, Google SSO, Facebook SSO) with inconsistent data models. User table fields not required for SSO, leading to incomplete records
- Safe modification: Add comprehensive user profile validation, ensure all auth methods set same required fields
- Test coverage: Missing - no tests for login edge cases, SSO failures, password hash compatibility

**Profile Picture Upload:**
- Files: `Old Code/freeluma-prod/code/php/signup.php` (lines 51-69), `Old Code/freeluma-prod/code/php/change_user_image.php` (lines 20-23), `Old Code/freeluma-prod/code/php/edit_user_profile.php` (lines 50-54)
- Why fragile: Depends on external Cloudinary service. Failures silently swallow exceptions. No validation of image URLs
- Safe modification: Add comprehensive error handling, implement fallback to local storage or default image
- Test coverage: No tests for Cloudinary API failures, invalid URLs, network timeouts

**Comment and Like System:**
- Files: `Old Code/freeluma-prod/code/php/comment.php`, `Old Code/freeluma-prod/code/php/like.php`, `Old Code/freeluma-prod/code/php/load_likes.php`
- Why fragile: No validation that user exists before storing interactions. No foreign keys. Date/category format inconsistency across files
- Safe modification: Add NOT NULL constraints, foreign key constraints, standardize date format (YYYY-MM-DD)
- Test coverage: Missing - no tests for invalid dates, non-existent users, concurrent updates

**Session Management:**
- Files: `Old Code/freeluma-prod/code/php/login_complete.php`, JavaScript in various files
- Why fragile: Session data validated only for presence, not actual login state. Token stored in localStorage accessible to JavaScript
- Safe modification: Implement proper session validation on every request, use HTTP-only cookies
- Test coverage: Missing - no tests for expired sessions, token theft, CSRF

## Scaling Limits

**Database Concurrency:**
- Current capacity: Single SQLite file-based database
- Limit: SQLite locks entire database on writes, supports limited concurrent connections
- Scaling path: Migrate to PostgreSQL or MySQL with proper connection pooling for production use

**Static Error Log:**
- Current capacity: error_log.txt currently 237KB, growing unbounded
- Limit: Will eventually consume disk space, becomes unreadable
- Scaling path: Implement proper logging service with log rotation, aggregation, and archiving

**Cloudinary Rate Limits:**
- Current capacity: Not verified, likely unpaid tier
- Limit: Cloudinary free tier has upload rate limits and bandwidth restrictions
- Scaling path: Evaluate paid plan, implement request throttling, consider CDN

## Dependencies at Risk

**SQLite3 as Production Database:**
- Risk: Not designed for multi-user concurrent access, file-based locking causes contention
- Impact: Performance degrades with user growth, data corruption possible under high load
- Migration plan: Planned rewrite should use PostgreSQL or MySQL

**External Email Service:**
- Risk: forgot_password.php calls external URL at freelumaquotes.com via file_get_contents()
- Impact: Dependency failure blocks password reset, no retry logic
- Migration plan: Implement proper email queue (PHPMailer, SwiftMailer) with retries

**Hardcoded Cloudinary Configuration:**
- Risk: API key visible in source code, environment-specific configuration not possible
- Impact: Cannot reuse code across environments, credential rotation impossible
- Migration plan: Move to environment variables in .env file

## Missing Critical Features

**Rate Limiting:**
- Problem: No rate limiting on API endpoints
- Blocks: Cannot protect against brute force attacks, spam
- Required for: Authentication endpoints (signup, login, password reset)

**Input Validation Framework:**
- Problem: Manual validation scattered across files
- Blocks: Cannot ensure consistent validation rules, duplicated logic
- Required for: All API endpoints

**Logging Framework:**
- Problem: error_log.txt unstructured, grows unbounded, no log levels
- Blocks: Cannot monitor application health, debug issues in production
- Required for: All endpoints

**Request Authentication:**
- Problem: No API token validation on most endpoints
- Blocks: Cannot prevent unauthorized access, enforce user ownership of data
- Required for: All user-specific operations (like, comment, etc.)

## Test Coverage Gaps

**Authentication System:**
- What's not tested: Login edge cases, password hash verification, SSO failure handling
- Files: `Old Code/freeluma-prod/code/php/signup.php`, `Old Code/freeluma-prod/code/php/change_password.php`
- Risk: Plaintext password leaks, weak password acceptance, SSO account hijacking
- Priority: Critical - foundation of application security

**Authorization:**
- What's not tested: User can only modify own data, cannot access other users' private info
- Files: All API endpoints
- Risk: Privilege escalation, data theft
- Priority: Critical - affects all data

**External Service Integration:**
- What's not tested: Cloudinary failures, email service failures, timeout handling
- Files: `Old Code/freeluma-prod/code/php/signup.php`, `Old Code/freeluma-prod/code/php/forgot_password.php`
- Risk: Silent failures, hanging requests, inconsistent state
- Priority: High - affects user experience

**Database Integrity:**
- What's not tested: Foreign key constraints, data type validation
- Files: All database operations
- Risk: Orphaned records, type confusion bugs
- Priority: High - affects data consistency

**Concurrent Operations:**
- What's not tested: Race conditions in like/comment creation, duplicate entries
- Files: `Old Code/freeluma-prod/code/php/like.php`, `Old Code/freeluma-prod/code/php/comment.php`
- Risk: Data corruption, inconsistent state
- Priority: Medium - becomes critical at scale

---

*Concerns audit: 2026-02-11*
