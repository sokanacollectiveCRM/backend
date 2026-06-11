# Vercel Environment Variables Configuration

## Portal Invite Email URL Configuration

To ensure portal invite emails use the correct production URL (`https://sokanacrm.vercel.app`), you need to set the `FRONTEND_URL` environment variable in your Vercel project settings.

### Required Environment Variable

**Variable Name:** `FRONTEND_URL`

**Production Value:** `https://sokanacrm.vercel.app`

## Contract Billing Notification Configuration

Set these environment variables in Vercel so internal contract-initiation emails
use the correct sender, billing recipient, and limited billing-view link.

Confirmed frontend billing routes:

- `/billing/contracts`
- `/billing/contracts/:contractId`
- `/billing/payment-schedules/:contractId` (alias)

Confirmed primary backend email link target:

- `BILLING_CONTRACT_VIEW_PATH_TEMPLATE=/billing/contracts/:contractId`

### Required Billing Notification Variables

**Variable Name:** `CONTRACT_NOTIFICATION_FROM_EMAIL`

**Production Value:** `hello@sokanacollective.com`

**Variable Name:** `BILLING_NOTIFICATION_EMAIL`

**Production Value:** `billing@sokanacollective.com`

**Variable Name:** `BILLING_CONTRACT_VIEW_PATH_TEMPLATE`

**Production Value:** `/billing/contracts/:contractId`

### How to Set in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add or update the `FRONTEND_URL` variable:
   - **Name:** `FRONTEND_URL`
   - **Value:** `https://sokanacrm.vercel.app` (no trailing slash)
   - **Environment:** Production (and optionally Preview/Development)
4. Add or update the billing notification variables:
   - **Name:** `CONTRACT_NOTIFICATION_FROM_EMAIL`
   - **Value:** `hello@sokanacollective.com`
   - **Environment:** Production
   - **Name:** `BILLING_NOTIFICATION_EMAIL`
   - **Value:** `billing@sokanacollective.com`
   - **Environment:** Production
   - **Name:** `BILLING_CONTRACT_VIEW_PATH_TEMPLATE`
   - **Value:** `/billing/contracts/:contractId`
   - **Environment:** Production
5. Click **Save**
6. **Redeploy** your application for the changes to take effect

### What This Controls

The `FRONTEND_URL` environment variable is used in:

1. **Portal Invite Emails** - The "Set Your Password" button redirects to `${FRONTEND_URL}/auth/set-password`
2. **OAuth Callbacks** - Redirects after authentication
3. **Password Reset Links** - Password reset emails
4. **CORS Configuration** - Allowed origins for API requests

The billing notification variables are used in:

1. **Internal Contract Notification Emails** - Sent when a contract is initiated
2. **Billing Recipient Routing** - Sends the notification to billing/accounting staff
3. **Limited Billing View Link Generation** - Builds the billing-safe contract URL using the confirmed frontend route `/billing/contracts/:contractId`

### URL Format

The code automatically normalizes the URL by removing trailing slashes, so:
- ✅ `https://sokanacrm.vercel.app` (correct)
- ✅ `https://sokanacrm.vercel.app/` (will be normalized automatically)
- ❌ `http://sokanacrm.vercel.app` (incorrect - missing `s` in `https`)

### Verification

After setting the environment variable and redeploying, you can verify it's working by:

1. Sending a test portal invite email
2. Checking the email link - it should point to `https://sokanacrm.vercel.app/auth/set-password`
3. Checking server logs - you should see: `🔗 Using redirect URL: https://sokanacrm.vercel.app/auth/set-password`

### Example Portal Invite Email Link

When a client receives a portal invite email, the "Set Your Password" button will link to:

```
https://[supabase-project].supabase.co/auth/v1/verify?token=[TOKEN]&type=recovery&redirect_to=https://sokanacrm.vercel.app/auth/set-password
```

This ensures that after Supabase verifies the token, users are redirected to the correct production frontend URL.
