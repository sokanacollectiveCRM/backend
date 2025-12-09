# Email Configuration for Doula Invite Endpoint

## Email Service Used
**Nodemailer** - Node.js email sending library using SMTP

## Configuration

The doula invite endpoint uses the `NodemailerService` class which is configured via environment variables.

### Required Environment Variables

```bash
# SMTP Server Configuration
EMAIL_HOST=smtp.gmail.com          # Default: smtp.gmail.com
EMAIL_PORT=465                     # Default: 465
EMAIL_SECURE=true                  # Default: true (SSL/TLS)
EMAIL_USER=hello@sokanacollective.com  # Default: hello@sokanacollective.com
EMAIL_PASSWORD=your_app_password   # REQUIRED - No default

# Email From Address
EMAIL_FROM=Sokana CRM <hello@sokanacollective.com>  # Default shown

# Frontend URL (for signup links in emails)
FRONTEND_URL=http://localhost:3001  # Default: http://localhost:3001

# Test Mode (optional)
USE_TEST_EMAIL=false               # If 'true', emails are logged but not sent
```

### Current Defaults

Based on the code:
- **SMTP Host:** `smtp.gmail.com` (Gmail SMTP)
- **SMTP Port:** `465` (SSL)
- **Secure:** `true` (SSL/TLS encryption)
- **Email User:** `hello@sokanacollective.com`
- **From Address:** `Sokana CRM <hello@sokanacollective.com>`

## Email Service Implementation

**File:** `src/services/emailService.ts`

**Class:** `NodemailerService`

**Method Used:** `sendDoulaInviteEmail()`

### Email Details

**Subject:** "Welcome to the Sokana Doula Team!"

**From:** `EMAIL_FROM` or `Sokana CRM <hello@sokanacollective.com>`

**To:** The doula's email address provided in the invite request

**Content:**
- Personalized greeting with firstname and lastname
- HTML formatted email with styled content
- Signup link: `${FRONTEND_URL}/signup?role=doula&email=${email}&invite_token=${token}`
- Plain text fallback version

## Setup Instructions

### For Gmail SMTP:

1. **Enable 2-Factor Authentication** on the Gmail account
2. **Generate App Password:**
   - Go to Google Account > Security
   - Under "2-Step Verification", click "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set Environment Variables:**
   ```bash
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=465
   EMAIL_SECURE=true
   EMAIL_USER=hello@sokanacollective.com
   EMAIL_PASSWORD=your_16_char_app_password
   EMAIL_FROM=Sokana CRM <hello@sokanacollective.com>
   FRONTEND_URL=https://your-frontend-domain.com
   ```

### For Other SMTP Providers:

**SendGrid:**
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
```

**Mailgun:**
```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_mailgun_username
EMAIL_PASSWORD=your_mailgun_password
```

**Custom SMTP:**
```bash
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_SECURE=false  # or true for 465
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-password
```

## Test Mode

To test without actually sending emails, set:
```bash
USE_TEST_EMAIL=true
```

When enabled, emails are logged to console but not sent.

## Verification

The email service logs configuration on startup (password is masked):
```
Email config: {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'hello@sokanacollective.com',
  passwordPreview: 'ab***cd',
  passwordLength: 16
}
```

## Troubleshooting

### Common Issues:

1. **"Invalid login" error:**
   - Verify `EMAIL_USER` and `EMAIL_PASSWORD` are correct
   - For Gmail, ensure you're using an App Password, not your regular password
   - Check that 2FA is enabled on Gmail account

2. **"Connection timeout" error:**
   - Verify `EMAIL_HOST` and `EMAIL_PORT` are correct
   - Check firewall/network settings
   - Try different port (587 for TLS, 465 for SSL)

3. **Emails not sending:**
   - Check if `USE_TEST_EMAIL=true` is set
   - Verify SMTP credentials
   - Check server logs for error messages
   - Verify `FRONTEND_URL` is set correctly

4. **Emails going to spam:**
   - Ensure SPF/DKIM records are set up for your domain
   - Use a verified sender address
   - Consider using a dedicated email service (SendGrid, Mailgun)

## Code Reference

**Email Service:** `src/services/emailService.ts`
- `NodemailerService` class
- `sendDoulaInviteEmail()` method

**Controller:** `src/controllers/adminController.ts`
- `inviteDoula()` method calls `emailController.sendDoulaInvite()`

**Email Controller:** `src/controllers/emailController.ts`
- `sendDoulaInvite()` method calls `emailService.sendDoulaInviteEmail()`

## Current Status

✅ **Endpoint is ready and tested**
✅ **Email service is configured**
✅ **Uses Nodemailer with SMTP**
✅ **Default configuration uses Gmail SMTP**

**Action Required:** Ensure `.env` file has correct `EMAIL_PASSWORD` set for the SMTP account.
