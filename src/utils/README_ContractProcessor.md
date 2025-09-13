# Contract Processor Module

A comprehensive Node.js module for processing contracts with document generation, PDF conversion, signature overlay, and cloud storage upload.

## Features

📝 **Document Generation**: Create contracts from Word templates using `docxtemplater`
📄 **PDF Conversion**: Convert .docx to .pdf using LibreOffice CLI
✍️ **Signature Overlay**: Add digital signatures to PDFs using `pdf-lib`
☁️ **Cloud Storage**: Upload to Supabase Storage with signed URLs

## Prerequisites

### System Requirements
- **LibreOffice**: Required for PDF conversion
  ```bash
  # macOS
  brew install libreoffice

  # Ubuntu/Debian
  sudo apt-get install libreoffice

  # Windows
  # Download from https://www.libreoffice.org/download/
  ```

### Node.js Dependencies
All required dependencies are already included in your `package.json`:
- `docxtemplater` - Word template processing
- `pizzip` - ZIP file handling for Word documents
- `pdf-lib` - PDF manipulation
- `fs-extra` - Enhanced file system operations
- `@supabase/supabase-js` - Supabase client

## Setup

### 1. Create Template Directory
```bash
mkdir -p templates generated
```

### 2. Create Word Template
Create a Word document at `./templates/service-contract.docx` with placeholders:

```
SERVICE CONTRACT

Client: {clientName}
Service: {serviceName}
Price: {price}
Date: {date}

Additional fields:
Project Description: {projectDescription}
Start Date: {startDate}
End Date: {endDate}
Terms: {terms}
```

### 3. Supabase Storage Bucket
Create a storage bucket named `contracts` in your Supabase project:
```sql
-- Run in Supabase SQL editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false);
```

## Usage

### Basic Usage

```javascript
const { processAndUploadContract } = require('./utils/contractProcessor');

const contractData = {
  contractId: 'contract-001',
  clientName: 'John Doe',
  serviceName: 'Web Development',
  price: '$5,000.00',
  date: '2024-01-15',
  projectDescription: 'E-commerce website',
  startDate: '2024-01-15',
  endDate: '2024-03-15',
  terms: 'Net 30 days'
};

try {
  const result = await processAndUploadContract(contractData);
  console.log('Contract URL:', result.signedUrl);
} catch (error) {
  console.error('Processing failed:', error.message);
}
```

### TypeScript Usage

```typescript
import { processAndUploadContract, ContractData } from './utils/contractProcessor';

const contractData: ContractData = {
  contractId: 'contract-001',
  clientName: 'John Doe',
  serviceName: 'Web Development',
  price: '$5,000.00',
  date: '2024-01-15'
};

const result = await processAndUploadContract(contractData);
```

## API Reference

### `processAndUploadContract(contractData)`

Main function that processes a contract through all steps.

**Parameters:**
- `contractData` (Object): Contract data object
  - `contractId` (string, required): Unique contract identifier
  - `clientName` (string, optional): Client name
  - `serviceName` (string, optional): Service name
  - `price` (string, optional): Service price
  - `date` (string, optional): Contract date
  - `[key: string]` (any, optional): Additional custom fields

**Returns:**
```javascript
{
  contractId: string,
  docxPath: string,        // Path to generated .docx
  pdfPath: string,         // Path to generated .pdf
  signedPdfPath: string,   // Path to signed .pdf
  signedUrl: string,       // Supabase signed URL (1 hour validity)
  success: boolean
}
```

### Individual Functions

#### `generateContractDocx(contractData, contractId)`
Generates a .docx file from template.

#### `convertDocxToPdf(docxPath, contractId)`
Converts .docx to .pdf using LibreOffice.

#### `addSignatureOverlay(pdfPath, contractData, contractId)`
Adds signature text overlay to PDF.

#### `uploadToSupabaseStorage(pdfPath, contractId)`
Uploads PDF to Supabase Storage and returns signed URL.

#### `cleanupGeneratedFiles(contractId)`
Removes generated files from local storage.

## File Structure

```
src/utils/
├── contractProcessor.js          # JavaScript version
├── contractProcessor.ts          # TypeScript version
├── testContractProcessor.js      # Test script (JS)
├── testContractProcessor.ts      # Test script (TS)
└── README_ContractProcessor.md   # This documentation

templates/
└── service-contract.docx         # Word template

generated/                        # Output directory
├── contract-{id}.docx
├── contract-{id}.pdf
└── contract-{id}-signed.pdf
```

## Testing

### Run Test Script
```bash
# JavaScript
node src/utils/testContractProcessor.js

# TypeScript
npx tsx src/utils/testContractProcessor.ts
```

### Manual Testing
```javascript
const { testContractProcessor } = require('./utils/testContractProcessor');
await testContractProcessor();
```

## Error Handling

The module includes comprehensive error handling:

- **Template not found**: Checks if `./templates/service-contract.docx` exists
- **LibreOffice errors**: Handles conversion failures gracefully
- **PDF processing errors**: Validates PDF operations
- **Supabase upload errors**: Handles network and storage issues
- **File system errors**: Ensures directories exist and files are accessible

## Environment Variables

Ensure these environment variables are set:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### LibreOffice Issues
```bash
# Check if LibreOffice is installed
libreoffice --version

# Test conversion manually
libreoffice --headless --convert-to pdf test.docx --outdir ./output
```

### Template Issues
- Ensure template file exists at `./templates/service-contract.docx`
- Verify placeholders use correct syntax: `{placeholderName}`
- Check template file is not corrupted

### Supabase Issues
- Verify storage bucket `contracts` exists
- Check environment variables are set correctly
- Ensure service role key has storage permissions

### File Permission Issues
```bash
# Ensure write permissions
chmod 755 generated/
chmod 644 templates/service-contract.docx
```

## Performance Considerations

- **Large files**: Consider file size limits for Supabase storage
- **Concurrent processing**: Module is async and can handle multiple contracts
- **Cleanup**: Use `cleanupGeneratedFiles()` to manage disk space
- **Caching**: Consider caching frequently used templates

## Security Notes

- **Signed URLs**: Valid for 1 hour by default
- **File cleanup**: Remove local files after upload
- **Template validation**: Validate template content before processing
- **Input sanitization**: Sanitize contract data to prevent injection

## Contributing

When modifying the module:
1. Update both JavaScript and TypeScript versions
2. Add comprehensive error handling
3. Update tests and documentation
4. Follow existing code style and patterns
