# Plan 01-11: SMTP Email Setup

## Required Environment Variables

Add the following to your `.env.local` file:

```bash
# SMTP Email Configuration
# The app works without these (emails logged to console) but real email
# delivery requires SMTP credentials.

SMTP_HOST=smtp.gmail.com          # Your SMTP server hostname
SMTP_PORT=587                      # Usually 587 for TLS
SMTP_USER=your-email@gmail.com     # SMTP username or API key
SMTP_PASS=your-app-password        # SMTP password or API key
SMTP_FROM=noreply@freeluma.com     # From address for outgoing emails
```

## Provider Options

### Option A: Gmail (Recommended for development)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Generate a new app password for "Mail"
5. Use your Gmail address as `SMTP_USER` and the app password as `SMTP_PASS`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

### Option B: SendGrid (Recommended for production)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Go to Settings > API Keys > Create API Key
3. Use the API key as both username and password

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key-here
```

### Option C: No SMTP (Development fallback)

If no SMTP variables are set, all emails are logged to the server console with the full email content and action URLs. This is sufficient for development and testing.

## Verification

After configuring SMTP, test with:

```bash
# Request a password reset (check your email)
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-real-email@example.com"}'
```

You should receive an email with a "Reset Password" button.

## Features Using Email

- **Password Reset:** POST /api/auth/forgot-password sends reset link
- **Email Verification:** POST /api/auth/send-verification sends verify link
