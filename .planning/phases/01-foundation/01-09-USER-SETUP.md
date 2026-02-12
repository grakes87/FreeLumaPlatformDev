# Plan 01-09: Bible API Setup

## Overview

The daily content API uses API.Bible (scripture.api.bible) as a fallback source for Bible translations. When a requested translation (e.g., NIV) is not stored in the local database, the system fetches it from API.Bible and caches it locally for future requests.

**This setup is optional.** The platform works without it -- the translation fallback simply returns "not available" for missing translations. All locally-stored translations (KJV from the seeder) work without an API key.

## Setup Steps

### 1. Create an API.Bible Account

1. Go to [scripture.api.bible](https://scripture.api.bible/)
2. Click **Sign Up** (top right)
3. Create a free account with your email

### 2. Create an Application

1. After logging in, go to **My Apps** in the dashboard
2. Click **Create App**
3. Fill in:
   - **App Name:** Free Luma Platform (or any name)
   - **Description:** Daily Bible verse translations
4. Submit the application

### 3. Get Your API Key

1. After creating the app, you will see your **API Key** on the app details page
2. Copy the API key

### 4. Add to Environment Variables

Add the following to your `.env.local` file:

```bash
BIBLE_API_KEY=your_api_key_here
```

### 5. Verify Setup

Restart the development server. The bible.api fallback will now be active. When a user requests a translation not in the database (e.g., NIV for a verse that only has KJV stored), the system will:

1. Check the `daily_content_translations` table
2. If not found, call API.Bible to fetch the translation
3. Cache the result in the `daily_content_translations` table (with `source='api'`)
4. Return the translation to the user

## Supported Translations

The following Bible translations are configured for API.Bible fallback:

| Code | Translation | API.Bible ID |
|------|-------------|--------------|
| KJV | King James Version | de4e12af7f28f599-02 |
| NIV | New International Version | 78a9f6124f344018-01 |
| NRSV | New Revised Standard Version | 1e8ab327edbce67f-01 |
| NAB | New American Bible (Revised) | bba9f40183526463-01 |

## Rate Limits

API.Bible free tier allows up to 5,000 API calls per day. Since translations are cached to the local database after the first fetch, the actual API usage should be very low after initial population.

## Troubleshooting

- **"BIBLE_API_KEY not set" in console:** The environment variable is missing. Add it to `.env.local`.
- **"No API.Bible ID for translation code":** The requested translation is not mapped in the system. Only KJV, NIV, NRSV, and NAB are currently supported.
- **"Could not parse verse reference":** The verse reference format in the daily content record does not match expected patterns (e.g., "John 3:16"). Ensure verse references follow "Book Chapter:Verse" format.
- **API returns 403:** Your API key may be invalid or expired. Check your API.Bible dashboard.
