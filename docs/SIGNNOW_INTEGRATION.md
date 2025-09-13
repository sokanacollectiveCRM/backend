# SignNow Integration Guide

## Overview
This guide explains how to integrate SignNow for digital signatures in your contract system using the official SignNow API.

## Setup

### 1. SignNow Account Setup
1. Go to [SignNow Developer Portal](https://www.signnow.com/developers)
2. Create a developer account
3. Create a new application
4. Get your Client ID and Client Secret

### 2. Environment Variables
Add these to your `.env` file:

```env
# SignNow Configuration
SIGNNOW_CLIENT_ID=your_signnow_client_id
SIGNNOW_CLIENT_SECRET=your_signnow_client_secret
SIGNNOW_USERNAME=your_signnow_email@example.com
SIGNNOW_PASSWORD=your_signnow_password
```

### 3. Installation
The required packages are already installed:
```bash
npm install axios @signnow/api-client
```

## Authentication

### Step 1: Authenticate with SignNow
```javascript
// POST /api/signnow/authenticate
{
  "username": "your_signnow_email@example.com",
  "password": "your_signnow_password"
}
```

### Response
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "accessToken": "7cXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "refreshToken": "59XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "expiresIn": 2592000
  }
}
```

## Usage

### Creating a Signing Invitation

```javascript
// POST /api/signnow/create-invitation
{
  "contractId": "contract-001",
  "clientEmail": "client@example.com",
  "clientName": "John Doe",
  "contractData": {
    "clientName": "John Doe",
    "serviceType": "Labor Support",
    "totalInvestment": "$1,200.00",
    // ... other contract data
  }
}
```

### Response
```json
{
  "success": true,
  "message": "Signing invitation created and email sent",
  "data": {
    "documentId": "567a7d28faa640c29bb0e06efdcb929faf89adeb",
    "invitationId": "inv_123456",
    "signingUrl": "https://www.signnow.com/sign/...",
    "status": "invitation_sent"
  }
}
```

### Checking Document Status

```javascript
// GET /api/signnow/status/:documentId
GET /api/signnow/status/567a7d28faa640c29bb0e06efdcb929faf89adeb
```

### Response
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "id": "inv_123456",
        "status": "completed",
        "signers": [
          {
            "name": "John Doe",
            "email": "client@example.com",
            "signedAt": "2024-01-15T10:30:00Z"
          }
        ]
      }
    ]
  }
}
```

## API Endpoints

### 1. Authentication
- **POST** `/api/signnow/authenticate`
- Authenticate with SignNow using username/password

### 2. Create Signing Invitation
- **POST** `/api/signnow/create-invitation`
- Creates a signing invitation and sends email to client

### 3. Check Document Status
- **GET** `/api/signnow/status/:documentId`
- Get the current status of a document and its invitations

### 4. Get Document Details
- **GET** `/api/signnow/document/:documentId`
- Get detailed information about a document

### 5. Download Document
- **GET** `/api/signnow/download/:documentId`
- Download a document as PDF

### 6. Upload Document
- **POST** `/api/signnow/upload`
- Upload a document to SignNow

### 7. Refresh Token
- **POST** `/api/signnow/refresh-token`
- Refresh the access token

### 8. Webhook Callback
- **POST** `/api/signnow/callback`
- Handles SignNow webhook notifications when documents are signed

## Features

### ✅ Automatic Authentication
- Username/password authentication
- Token refresh handling
- Session management

### ✅ Document Management
- Upload PDF documents
- Download signed documents
- Get document details

### ✅ Signing Workflow
- Create signing invitations
- Track signing status
- Email notifications

### ✅ Webhook Integration
- Real-time status updates
- Automatic document downloads
- Email confirmations

## SignNow API Structure

### Authentication Flow
1. **Basic Auth**: Use Client ID and Secret for Basic Authorization
2. **Password Grant**: Authenticate with username/password
3. **Token Management**: Handle access and refresh tokens

### Document Workflow
1. **Upload**: Upload PDF to SignNow
2. **Invite**: Create signing invitation
3. **Track**: Monitor signing status
4. **Download**: Retrieve signed document

### API Endpoints Used
- `POST /oauth2/token` - Authentication
- `POST /document` - Upload document
- `POST /document/{id}/invite` - Create invitation
- `GET /document/{id}` - Get document details
- `GET /document/{id}/download` - Download document

## Benefits of SignNow

1. **Professional Digital Signatures**
   - Legally binding signatures
   - Audit trails
   - Compliance with e-signature laws

2. **User-Friendly Interface**
   - Intuitive signing experience
   - Mobile-responsive design
   - Drag-and-drop signature placement

3. **Advanced Features**
   - Multiple signature types
   - Initials and date stamps
   - Custom branding

4. **Security & Compliance**
   - SOC 2 Type II certified
   - HIPAA compliant
   - GDPR compliant

## Testing

### Environment Setup
```bash
# Set environment variables
export SIGNNOW_CLIENT_ID=your_client_id
export SIGNNOW_CLIENT_SECRET=your_client_secret
export SIGNNOW_USERNAME=your_signnow_email
export SIGNNOW_PASSWORD=your_signnow_password

# Run tests
node scripts/test-signnow.js
```

### Test Coverage
- ✅ Authentication
- ✅ Document upload
- ✅ Signing invitation creation
- ✅ Status checking
- ✅ Token refresh

## Error Handling

The service includes comprehensive error handling:
- Invalid credentials
- Network timeouts
- Document processing errors
- Webhook failures
- Token expiration

## Next Steps

1. **Get SignNow Credentials**
   - Sign up for developer account
   - Create application
   - Get Client ID and Secret

2. **Update Environment Variables**
   - Add SignNow credentials to `.env`
   - Configure webhook URLs

3. **Test Integration**
   - Run test script
   - Verify email notifications
   - Check webhook callbacks

4. **Deploy to Production**
   - Switch to production environment
   - Update webhook URLs
   - Monitor performance

## Support

- [SignNow API Documentation](https://docs.signnow.com/)
- [SignNow Developer Portal](https://www.signnow.com/developers)
- [API Support](mailto:api@signnow.com)

## Example Usage

### Complete Workflow
```javascript
// 1. Authenticate
const auth = await signNowService.authenticate(username, password);

// 2. Process contract signing
const result = await signNowService.processContractSigning(
  contractPath,
  clientEmail,
  clientName,
  contractId
);

// 3. Check status
const status = await signNowService.getInvitationStatus(result.documentId);

// 4. Download signed document
const signedPdf = await signNowService.downloadDocument(result.documentId);
```

### Environment Variables Example
```env
# SignNow Configuration
SIGNNOW_CLIENT_ID=your_client_id_here
SIGNNOW_CLIENT_SECRET=your_client_secret_here
SIGNNOW_USERNAME=your_signnow_email@example.com
SIGNNOW_PASSWORD=your_signnow_password_here

# Other configurations
ADMIN_EMAIL=jerry@techluminateacademy.com
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:5050
```
