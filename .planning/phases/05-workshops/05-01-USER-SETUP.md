# User Setup: Agora (Workshops)

## Why
Live video streaming and cloud recording for workshops requires Agora credentials.

## Steps

### 1. Create Agora Account
1. Go to [Agora Console](https://console.agora.io/)
2. Sign up / sign in

### 2. Create Project
1. Navigate to **Project Management** in the left sidebar
2. Click **Create** to create a new project
3. Copy the **App ID** from the project details

### 3. Enable App Certificate
1. In **Project Management**, click **Edit** on your project
2. Enable **App Certificate** if not already enabled
3. Copy the **App Certificate** value

### 4. Get RESTful API Credentials
1. Navigate to **RESTful API** in the left sidebar
2. Copy the **Customer ID** and **Customer Secret**

### 5. Add to .env.local

```bash
# Agora (Workshops)
AGORA_APP_ID=<your-app-id>
AGORA_APP_CERTIFICATE=<your-app-certificate>
AGORA_CUSTOMER_ID=<your-customer-id>
AGORA_CUSTOMER_SECRET=<your-customer-secret>
NEXT_PUBLIC_AGORA_APP_ID=<same-as-AGORA_APP_ID>
```

Note: `NEXT_PUBLIC_AGORA_APP_ID` should be the same value as `AGORA_APP_ID` (it is exposed client-side for the Agora SDK).

## Verification
Once credentials are configured, workshop video features in later plans (05-03, 05-06) will use these values for token generation and cloud recording.
