# Backblaze B2 Setup Guide

## Overview

Backblaze B2 provides object storage for avatar images and media files. The platform uses the S3-compatible API with presigned URLs for direct browser-to-B2 uploads.

**Note:** The app works without B2 configured. Avatar uploads will show a "Photo upload is not available yet" message, and users will see their initials avatar instead.

## Setup Steps

### 1. Create a Backblaze B2 Account

1. Go to [backblaze.com](https://www.backblaze.com/cloud-storage) and create an account
2. The first 10 GB of storage is free

### 2. Create a B2 Bucket

1. Navigate to **Backblaze B2 > Buckets > Create a Bucket**
2. Bucket name: choose a unique name (e.g., `freeluma-media`)
3. Set **Files in Bucket are: Public**
4. Enable **Object Lock: Disabled** (default)
5. Click **Create a Bucket**
6. Note the **Endpoint URL** -- extract the region from it (e.g., `us-west-004` from `s3.us-west-004.backblazeb2.com`)

### 3. Create an Application Key

1. Navigate to **Backblaze B2 > App Keys > Add a New Application Key**
2. Name: `freeluma-app` (or any descriptive name)
3. **Allow access to Bucket(s):** Select the bucket you created
4. **Type of Access:** Read and Write
5. Click **Create New Key**
6. **IMPORTANT:** Copy both the `keyID` and `applicationKey` immediately -- the application key is shown only once

### 4. Add Environment Variables

Add the following to your `.env.local` file:

```env
# Backblaze B2 Storage
B2_KEY_ID=your_key_id_here
B2_APP_KEY=your_application_key_here
B2_BUCKET_NAME=your_bucket_name_here
B2_REGION=us-west-004
```

Replace the values with your actual credentials from steps 2 and 3.

### 5. Optional: Configure Cloudflare CDN

For production, set up Cloudflare CDN for faster file delivery and zero egress fees (Bandwidth Alliance):

1. In **Cloudflare DNS**, add a CNAME record:
   - Name: `cdn` (or your preferred subdomain)
   - Target: `your-bucket-name.s3.us-west-004.backblazeb2.com`
   - Proxy: Enabled (orange cloud)
2. Add the CDN URL to your `.env.local`:
   ```env
   CDN_BASE_URL=https://cdn.yourdomain.com/file/your-bucket-name
   ```

## Verification

After configuring the environment variables, restart the dev server and check:

1. The B2 storage warning should no longer appear in the server logs
2. Navigate to the profile page, click the camera icon on the avatar
3. Select an image -- the crop modal should appear
4. After cropping and saving, the avatar should upload and display

## Environment Variables Reference

| Variable | Source | Required |
|----------|--------|----------|
| `B2_KEY_ID` | Backblaze B2 > App Keys > keyID | Yes (for uploads) |
| `B2_APP_KEY` | Backblaze B2 > App Keys > applicationKey (shown once) | Yes (for uploads) |
| `B2_BUCKET_NAME` | Backblaze B2 > Buckets > Bucket Name | Yes (for uploads) |
| `B2_REGION` | Extract from Bucket Endpoint URL (e.g., `us-west-004`) | Yes (for uploads) |
| `CDN_BASE_URL` | Your Cloudflare CDN URL (optional) | No (falls back to direct B2 URL) |
