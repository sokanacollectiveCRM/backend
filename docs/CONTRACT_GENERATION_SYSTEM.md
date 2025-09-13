# Contract Generation System - Code Organization & Flow

## 📖 Overview

This document explains the complete contract generation system, including the successful workflow for creating, prefilling, and processing contracts with SignNow integration.

## 🏗️ System Architecture

The contract generation system consists of several layers:

1. **Template Processing** - DOCX template handling with placeholder replacement
2. **Document Generation** - Converting templates to filled contracts
3. **PDF Conversion** - Converting DOCX to PDF while preserving formatting
4. **SignNow Integration** - Uploading contracts and managing signatures
5. **Payment Integration** - Stripe payment processing for contracts

## ✅ Working Flow (Proven Success)

### Template Used
- **File:** `generated/Agreement for Postpartum Doula Services (3).docx`
- **Format:** Contains `{placeholder}` format (e.g., `{totalHours}`, `{clientName}`)
- **Size:** ~737KB (preserves logo and formatting)

### Processing Steps
1. **Read Template:** Load DOCX template using `docxtemplater`
2. **Replace Placeholders:** Fill `{placeholder}` with actual values
3. **Generate DOCX:** Create new document with filled values
4. **Convert to PDF:** Use LibreOffice to convert DOCX → PDF
5. **Upload to SignNow:** Send PDF for signature field addition and signing

### Data Structure
```javascript
const contractData = {
  totalHours: '120',
  deposit: '200.00',
  hourlyRate: '35.00',
  overnightFee: '0.00',
  totalAmount: '4200.00',
  clientInitials: 'JB',
  clientName: 'Jerry Bony',
  clientSignature: 'Jerry Bony',
  date: '9/13/2025'
};
```

## 📁 Code Organization

### 🏗️ Contract Generation Core

#### Primary Processing Files

**`src/utils/contractProcessor.ts/.js`**
- **Purpose:** Main contract processing orchestration
- **Key Functions:**
  - `generateContractDocx()` - Creates DOCX from template with filled data
  - `convertDocxToPdf()` - Converts DOCX to PDF using LibreOffice
  - `processAndUploadContract()` - Complete workflow orchestration
  - `uploadToSupabaseStorage()` - Uploads generated contracts to storage
- **Template Path:** Currently hardcoded to `Agreement for Postpartum Doula Services (2).docx`
- **Technology:** Uses `docxtemplater`, `PizZip`, LibreOffice CLI

**`src/utils/documentProcessor.ts`**
- **Purpose:** Alternative DOCX template processing (text-based)
- **Key Functions:**
  - `processTemplate()` - Processes template and returns Buffer
  - `saveProcessedDocument()` - Saves processed document to file
- **Note:** Uses `mammoth` for text extraction (strips formatting)
- **Template Path:** `docs/Agreement for Postpartum Doula Services (1).docx`

**`src/services/postpartum/calculateContract.ts/.js`**
- **Purpose:** Business logic for contract amount calculations
- **Key Functions:**
  - Contract amount calculations for postpartum services
  - Formatting amounts for SignNow integration

### 🎯 Controllers & Business Logic

**`src/controllers/contractController.ts/.js`**
- **Purpose:** HTTP request handlers for contract operations
- **Key Endpoints:**
  - `generateContract()` - POST endpoint for contract generation
  - `previewContract()` - GET endpoint for contract preview
- **Dependencies:** Uses `ContractUseCase` for business logic

**`src/usecase/contractUseCase.ts/.js`**
- **Purpose:** Business logic layer between controllers and services
- **Key Functions:**
  - `createContract()` - Orchestrates contract creation
  - `fetchContractPDF()` - Retrieves generated contract PDFs
  - `getAllTemplates()` - Template management
- **Dependencies:** Uses `ContractService` implementations

**`src/services/supabaseContractService.ts/.js`**
- **Purpose:** Database operations and storage management
- **Key Functions:**
  - `createContract()` - Creates contract records in database
  - `fetchContractPDF()` - Retrieves contract files from storage
  - `generateTemplate()` - Template processing integration
- **Technology:** Supabase client for database and storage

### 🔄 API Routes

**`src/routes/contractRoutes.ts/.js`**
- **Purpose:** Contract-related API endpoints
- **Key Endpoints:**
  - `POST /postpartum/calculate` - Calculate contract amounts
  - `POST /postpartum/send` - Generate and send contracts
  - `POST /postpartum/send-client-invite` - Send signing invitations
- **Authentication:** Uses middleware for user authentication

**`src/routes/signNowRoutes.ts` (TypeScript)**
- **Purpose:** SignNow integration endpoints (minimal implementation)
- **Key Endpoints:**
  - `POST /test-auth` - Test SignNow authentication
  - `POST /send-client-partner` - Send contract for signing
- **Status:** Basic implementation, delegates to JS version for full functionality

**`src/routes/signNowRoutes.js` (JavaScript)**
- **Purpose:** Complete SignNow integration endpoints (working implementation)
- **Key Endpoints:**
  - `POST /upload` - Upload documents to SignNow
  - `POST /process-contract` - Complete contract processing workflow
  - `POST /add-fields` - Add signature fields to documents
  - `POST /add-standard-fields` - Add standard contract fields
  - `POST /test-complete-workflow` - Test complete signing workflow
  - `POST /send-client-partner` - Send contract for client-partner signing
- **Status:** ✅ Working implementation with full functionality

**`src/routes/contractPaymentRoutes.ts`**
- **Purpose:** Payment-related contract operations
- **Key Endpoints:**
  - `POST /signnow-webhook` - Handle SignNow completion webhooks
- **Status:** Minimal placeholder implementation

### 📋 SignNow Integration

**`src/services/signNowService.ts` (TypeScript)**
- **Purpose:** SignNow API integration (partial implementation)
- **Key Functions:**
  - `authenticate()` - SignNow API authentication
  - `createInvitationClientPartner()` - Create signing invitations
  - `testAuthentication()` - Test API connection
  - `listTemplates()` - List available templates
- **Status:** Basic implementation, missing some functionality

**`src/services/signNowService.js` (JavaScript)**
- **Purpose:** Complete SignNow API integration (working implementation)
- **Key Functions:**
  - `processContractSigning()` - ✅ Complete contract upload and invitation workflow
  - `addFieldsToDocument()` - Add signature fields to documents
  - `addStandardContractFields()` - Add standard contract signature fields
- **Status:** ✅ Fully working implementation
- **Technology:** Uses SignNow REST API, form-data for file uploads

### 💰 Payment System Integration

**`src/services/stripePaymentService.ts`**
- **Purpose:** Stripe payment processing integration
- **Key Functions:**
  - Payment intent creation and processing
  - Webhook handling for payment completion
- **Integration Point:** Connects with contract completion workflow

**`src/routes/stripePaymentRoutes.ts`**
- **Purpose:** Stripe payment API endpoints
- **Key Endpoints:**
  - `POST /contract/:contractId/create-payment` - Create payment for contract
  - `POST /webhook` - Handle Stripe webhooks
  - `GET /payment-intent/:id/status` - Check payment status

**`src/routes/paymentRoutes.ts`**
- **Purpose:** General payment management endpoints
- **Key Endpoints:**
  - `GET /dashboard` - Payment dashboard data
  - `GET /overdue` - Overdue payment tracking
  - `GET /contract/:contractId/summary` - Contract payment summary

## 📄 Templates & Generated Files

### Template Files

**`docs/Agreement for Postpartum Doula Services (1).docx`**
- **Purpose:** Original template (32KB)
- **Format:** Uses various placeholder formats (not standardized)
- **Usage:** Used by `documentProcessor.ts` (strips formatting)

**`generated/Agreement for Postpartum Doula Services (3).docx`** ✅
- **Purpose:** Working template with proper placeholders
- **Format:** Contains `{placeholder}` format compatible with `docxtemplater`
- **Size:** ~737KB (preserves logo, formatting, images)
- **Placeholders:** `{totalHours}`, `{deposit}`, `{hourlyRate}`, `{overnightFee}`, `{totalAmount}`, `{clientInitials}`, `{clientName}`, `{clientSignature}`, `{date}`
- **Status:** ✅ **This is the template that works**

### Generated Contract Directory

**`generated/`**
- **Purpose:** Output directory for generated contracts
- **File Naming:** `contract-[TYPE]-[TIMESTAMP].[ext]`
- **Examples:**
  - `contract-FROM-TEMPLATE-3-1757796745665.docx`
  - `contract-FROM-TEMPLATE-3-1757796745665.pdf`

## 🔧 Configuration Files

**`src/server.ts/.js`**
- **Purpose:** Main Express server setup
- **Route Mounting:** Mounts all contract and payment routes
- **Middleware:** Authentication, CORS, body parsing

**`src/config/stripe.ts`**
- **Purpose:** Stripe SDK configuration
- **Environment Variables:** `STRIPE_SECRET_KEY`

**`src/supabase.ts`**
- **Purpose:** Supabase client configuration
- **Usage:** Database and storage operations

## 🚀 How to Use the Working System

### 1. Generate Contract with Prefilled Values

```bash
# Use the working template (3) with proper placeholders
node -e "
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = '/path/to/generated/Agreement for Postpartum Doula Services (3).docx';
const outputPath = '/path/to/generated/contract-filled-' + Date.now() + '.docx';

const content = fs.readFileSync(templatePath, 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, {paragraphLoop: true, linebreaks: true});

const data = {
  totalHours: '120',
  deposit: '200.00',
  hourlyRate: '35.00',
  overnightFee: '0.00',
  totalAmount: '4200.00',
  clientInitials: 'JB',
  clientName: 'Jerry Bony',
  clientSignature: 'Jerry Bony',
  date: new Date().toLocaleDateString()
};

doc.setData(data);
doc.render();
const buf = doc.getZip().generate({type: 'nodebuffer'});
fs.writeFileSync(outputPath, buf);
"
```

### 2. Convert to PDF

```bash
# Convert DOCX to PDF preserving formatting
soffice --headless --convert-to pdf "contract-filled.docx" --outdir "./generated/"
```

### 3. Upload to SignNow

```bash
# Use the working JavaScript SignNow endpoints
curl -X POST http://localhost:3000/api/signnow/process-contract \
  -F "file=@contract-filled.pdf" \
  -F "clientEmail=client@example.com" \
  -F "partnerEmail=partner@example.com"
```

## 🐛 Common Issues & Solutions

### Issue: Placeholders Not Replaced
- **Problem:** Template doesn't have `{placeholder}` format
- **Solution:** Use Template (3) which has the correct format

### Issue: Formatting Lost
- **Problem:** Using `documentProcessor.ts` which strips formatting
- **Solution:** Use `contractProcessor.ts` with `docxtemplater`

### Issue: SignNow API Errors
- **Problem:** Using TypeScript SignNow service (incomplete)
- **Solution:** Use JavaScript SignNow service (`signNowService.js`)

### Issue: Template Not Found
- **Problem:** Hardcoded template path in `contractProcessor.ts`
- **Solution:** Update template path to point to correct template file

## 📊 File Dependencies

```
contractProcessor.ts
├── PizZip (DOCX reading)
├── Docxtemplater (placeholder replacement)
├── LibreOffice (PDF conversion)
└── Supabase (file upload)

signNowService.js
├── axios (HTTP requests)
├── form-data (file uploads)
└── SignNow REST API

documentProcessor.ts
├── mammoth (text extraction)
├── docx (document creation)
└── fs-extra (file operations)
```

## 🔮 Future Improvements

1. **Standardize Template Format:** Ensure all templates use `{placeholder}` format
2. **Unify TypeScript/JavaScript:** Migrate working JS SignNow service to TypeScript
3. **Error Handling:** Add comprehensive error handling and retry logic
4. **Template Management:** Build UI for template upload and management
5. **Webhook Integration:** Complete SignNow webhook handling for contract completion
6. **Testing:** Add comprehensive test suite for contract generation workflow

## 📝 Notes

- **Working Template:** Always use `Agreement for Postpartum Doula Services (3).docx`
- **Working SignNow Service:** Use the JavaScript version (`signNowService.js`)
- **PDF Conversion:** LibreOffice CLI is required for DOCX→PDF conversion
- **File Sizes:** Generated contracts should be 70-90KB if formatting is preserved
- **Placeholder Format:** Must use `{placeholderName}` format for `docxtemplater`

---

*This document reflects the current working state of the contract generation system as of September 2024.*
