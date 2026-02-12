# Plan 01-06: OAuth User Setup

This document describes the external service configuration required for Google Sign-In and Apple Sign-In to work. These are **optional** -- the app gracefully degrades when credentials are not configured (buttons appear disabled).

---

## Google OAuth Setup

### What it provides
Google Sign-In for user registration and login via the "Sign in with Google" button.

### Steps

1. **Go to Google Cloud Console**
   - URL: https://console.cloud.google.com/apis/credentials
   - Create a new project if you don't have one

2. **Configure OAuth Consent Screen**
   - Go to "OAuth consent screen"
   - Select "External" user type
   - Fill in app name ("Free Luma"), support email, and developer contact
   - Add scopes: `email`, `profile`, `openid`
   - Publish the app (or leave in testing mode for development)

3. **Create OAuth 2.0 Client ID**
   - Go to "Credentials" > "Create Credentials" > "OAuth client ID"
   - Application type: **Web application**
   - Name: "Free Luma Web"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://your-production-domain.com` (production)
   - Authorized redirect URIs: (not needed for popup flow, but add if required)
     - `http://localhost:3000`
   - Click "Create"

4. **Copy credentials to `.env.local`**

   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

   Note: `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` should have the same value. The `NEXT_PUBLIC_` prefix makes it available to the client-side Google button component.

### Verification
- Restart the dev server
- Visit `/login` -- the Google button should be enabled (not grayed out)
- Click "Sign in with Google" -- a Google popup should open

---

## Apple Sign-In Setup

### What it provides
Apple Sign-In for user registration and login via the "Sign in with Apple" button.

### Prerequisites
- Apple Developer account ($99/year): https://developer.apple.com/
- HTTPS is **required** even for development (use ngrok or similar)

### Steps

1. **Register an App ID**
   - Go to: https://developer.apple.com/account/resources/identifiers/list
   - Click "+" > "App IDs" > "App"
   - Enter description ("Free Luma") and Bundle ID (e.g., `com.freeluma.web`)
   - Enable "Sign in with Apple" capability
   - Click "Register"

2. **Create a Services ID**
   - Go to: https://developer.apple.com/account/resources/identifiers/list/serviceId
   - Click "+" > "Services IDs"
   - Enter description ("Free Luma Web") and identifier (e.g., `com.freeluma.web.auth`)
   - Click "Register"
   - Click on the newly created Service ID to configure it
   - Enable "Sign in with Apple"
   - Click "Configure":
     - Primary App ID: Select the App ID created above
     - Domains: `your-domain.com` (or ngrok domain for dev)
     - Return URLs: `https://your-domain.com/api/auth/apple/callback`
   - Click "Save"

3. **Create a Sign in with Apple Key**
   - Go to: https://developer.apple.com/account/resources/authkeys/list
   - Click "+" to create a new key
   - Name: "Free Luma Sign In"
   - Enable "Sign in with Apple" and configure (select the App ID)
   - Click "Register"
   - **Download the .p8 key file** (you can only download it once!)
   - Note the **Key ID** shown on the page

4. **Get your Team ID**
   - Go to: https://developer.apple.com/account/#/membership/
   - Your Team ID is displayed on this page

5. **Base64 encode the private key**
   ```bash
   cat AuthKey_XXXXXXXXXX.p8 | base64
   ```

6. **Copy credentials to `.env.local`**

   ```
   APPLE_CLIENT_ID=com.freeluma.web.auth
   APPLE_TEAM_ID=YOUR_TEAM_ID
   APPLE_KEY_ID=YOUR_KEY_ID
   APPLE_PRIVATE_KEY=base64-encoded-contents-of-p8-file
   NEXT_PUBLIC_APPLE_CLIENT_ID=com.freeluma.web.auth
   ```

### Verification
- Restart the dev server (must be served over HTTPS)
- Visit `/login` -- the Apple button should be enabled (not grayed out)
- Click "Sign in with Apple" -- an Apple popup should open

### Important Notes
- Apple only returns the user's name on the **first** authorization. If you need it, store it immediately.
- Apple may provide a relay email (privaterelay.appleid.com) if the user chooses "Hide My Email"
- The .p8 private key file should be kept secure and never committed to version control
- Apple Sign-In cannot be tested on localhost without HTTPS (use ngrok or similar HTTPS tunnel)

---

## Without OAuth Configuration

If neither Google nor Apple credentials are configured, the app works normally:
- Login page shows disabled Google and Apple buttons with tooltip "not configured"
- Users can still register and log in with email/password
- No errors or crashes -- graceful degradation by design
