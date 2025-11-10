# Email Notification System Documentation

## Overview
The email notification system uses **Nodemailer** to send emails via SMTP. The system is implemented as a service class (`NodemailerService`) that implements the `EmailService` interface.

## Architecture

### Core Components

1. **Email Service** (`src/services/emailService.ts`)
   - Main service class: `NodemailerService`
   - Implements `EmailService` interface
   - Handles SMTP configuration and email sending

2. **Email Service Interface** (`src/services/interface/emailServiceInterface.ts`)
   - Defines contract for email operations
   - Methods: `sendEmail`, `sendInvoiceEmail`, `sendClientApprovalEmail`, `sendTeamInviteEmail`

3. **Email Controller** (`src/controllers/emailController.ts`)
   - HTTP endpoints for sending emails
   - Routes: `/api/email/client-approval`, `/api/email/team-invite`

## Configuration (Environment Variables)

The email system uses the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `EMAIL_PORT` | `465` | SMTP server port |
| `EMAIL_SECURE` | `true` | Use SSL/TLS (true/false) |
| `EMAIL_USER` | `hello@sokanacollective.com` | SMTP authentication username |
| `EMAIL_PASSWORD` | (required) | SMTP authentication password (app password for Gmail) |
| `EMAIL_FROM` | `Sokana CRM <hello@sokanacollective.com>` | Default "from" address |
| `USE_TEST_EMAIL` | `false` | Test mode - logs emails instead of sending |
| `FRONTEND_URL` | (required) | Frontend URL for links in emails |

### Example Configuration
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=hello@sokanacollective.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_FROM=Sokana CRM <hello@sokanacollective.com>
USE_TEST_EMAIL=false
FRONTEND_URL=https://app.sokanacollective.com
```

## Email Types

### 1. **General Email** (`sendEmail`)
- **Purpose**: Generic email sending with text and optional HTML
- **Parameters**: `to`, `subject`, `text`, `html?`
- **Usage**: Used internally by other email methods

### 2. **Request Form Notification** (via `RequestFormController`)
- **Trigger**: When a new request form is submitted
- **Recipients**:
  - **Notification Email**: `hello@sokanacollective.com` (hardcoded)
  - **Confirmation Email**: The person who submitted the form
- **Content**:
  - Notification: Comprehensive HTML email with all form data (10 sections)
  - Confirmation: Simple acknowledgment email
- **Location**: `src/controllers/requestFormController.ts` (lines 203-451)

### 3. **Invoice Email** (`sendInvoiceEmail`)
- **Purpose**: Send invoices with PDF attachments
- **Parameters**: `to`, `customerName`, `invoiceNumber`, `amount`, `dueDate`, `invoicePdfBuffer`, `customHtml?`, `customText?`
- **Features**:
  - PDF attachment
  - Customizable HTML/text content
  - Payment link integration (QuickBooks)
- **Usage**: Called from `src/services/invoice/sendInvoiceEmail.ts`

### 4. **Client Approval Email** (`sendClientApprovalEmail`)
- **Purpose**: Notify clients when their account request is approved
- **Parameters**: `to`, `name`, `signupUrl`
- **Content**: Welcome message with signup link
- **Endpoint**: `POST /api/email/client-approval`

### 5. **Team Invite Email** (`sendTeamInviteEmail`)
- **Purpose**: Invite team members to join the CRM
- **Parameters**: `to`, `firstname`, `lastname`, `role`
- **Content**: Welcome message with signup link
- **Endpoint**: `POST /api/email/team-invite`

## Email Content Structure

### Request Form Notification Email
The notification email sent to `hello@sokanacollective.com` includes:

1. **Client Details**: Name, email, phone, pronouns, children expected
2. **Home Details**: Address, city, state, zip, home phone, home type, access, pets
3. **Family Members**: Relationship status, partner name, partner contact info
4. **Referral**: Source, referral name, referral email
5. **Health History**: Health history, allergies, health notes
6. **Payment Info**: Annual income, service needed, service specifics
7. **Pregnancy/Baby**: Due date, birth location, hospital, baby name, provider type
8. **Past Pregnancies**: Previous pregnancies count, living children, past experience
9. **Services Interested**: Services list, service support details
10. **Demographics**: Race/ethnicity, language, age range, insurance, demographics
11. **Form Submission Details**: Submission date, status
12. **Action Button**: Link to view lead in CRM (`${FRONTEND_URL}/clients/${id}?open=profile&mode=modal`)

### Email Styling
- Uses inline CSS for email client compatibility
- Color scheme: Green (#4CAF50) for primary actions
- Responsive design with max-width: 800px
- Professional formatting with tables and sections

## Test Mode

When `USE_TEST_EMAIL=true`:
- Emails are **not sent** via SMTP
- Email content is **logged to console** instead
- Useful for development and testing
- Logs include: `to`, `subject`, `text`, `html` (if available)

## Error Handling

- Email failures are **caught and logged** but don't block main operations
- For request forms: Form submission succeeds even if email fails
- Errors are logged with: `console.error('Failed to send email:', error)`
- Error messages include: `Failed to send email: ${error.message}`

## Code Examples

### Sending a Simple Email
```typescript
import { NodemailerService } from '../services/emailService';

const emailService = new NodemailerService();
await emailService.sendEmail(
  'recipient@example.com',
  'Subject',
  'Plain text content',
  '<html>HTML content</html>'
);
```

### Sending Invoice Email
```typescript
const emailService = new NodemailerService();
await emailService.sendInvoiceEmail(
  'customer@example.com',
  'John Doe',
  'INV-001',
  '$500.00',
  '2024-12-31',
  pdfBuffer,
  customHtml,
  customText
);
```

## Integration Points

1. **Request Form Submission**: `RequestFormController.createForm()` sends notification and confirmation emails
2. **Invoice Creation**: `sendInvoiceEmailToCustomer()` sends invoice emails with PDFs
3. **Client Approval**: `EmailController.sendClientApproval()` sends approval emails
4. **Team Invites**: `EmailController.sendTeamInvite()` sends team invitation emails

## Security Considerations

- Email passwords are masked in logs (only first 2 and last 2 characters shown)
- Test mode prevents accidental email sends in development
- SMTP credentials stored in environment variables
- Email failures don't expose sensitive information in error messages

## Dependencies

- `nodemailer`: SMTP email sending library
- Node.js environment variables for configuration
