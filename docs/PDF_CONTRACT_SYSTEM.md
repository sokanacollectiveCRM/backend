# PDF-Based Contract System - Coordinate-Stable Version

## 🎯 Overview

This document describes the new PDF-based contract generation system that
eliminates DOCX conversion and ensures perfect SignNow field alignment through
fixed coordinate mapping.

## 🚀 Key Benefits

- **✅ No Layout Drift**: Eliminates DOCX conversion issues
- **✅ Perfect Coordinates**: Fixed coordinate maps ensure consistent field
  placement
- **✅ Fast Processing**: Direct PDF manipulation without conversion steps
- **✅ Version Control**: Template versioning supports updates
- **✅ Guaranteed Consistency**: Identical layout every time

## 🏗️ System Architecture

### Core Components

1. **PDF Template Filler** (`src/utils/pdfTemplateFiller.ts`)

   - Fills PDF templates with contract data using pre-defined coordinates
   - No DOCX conversion required

2. **Coordinate Maps** (`src/config/pdfCoordinates.json`)

   - Fixed coordinate definitions for each template
   - Set once, reused forever

3. **SignNow PDF Service** (`src/services/signNowPdfService.ts`)

   - Handles PDF upload and field addition to SignNow
   - Uses coordinate maps for perfect field alignment

4. **Contract Processor** (`src/utils/pdfContractProcessor.ts`)
   - Main orchestration layer
   - Coordinates the entire workflow

## 📁 File Structure

```
src/
├── config/
│   └── pdfCoordinates.json          # Fixed coordinate maps
├── utils/
│   ├── pdfTemplateFiller.ts         # PDF template filling
│   └── pdfContractProcessor.ts      # Main processor
├── services/
│   └── signNowPdfService.ts         # SignNow integration
└── routes/
    └── pdfContractRoutes.ts         # API endpoints
```

## 🔧 Configuration

### Coordinate Maps

Each template has a fixed coordinate map in `pdfCoordinates.json`:

```json
{
  "labor_support_v1": {
    "clientName": { "x": 120, "y": 720, "page": 1, "size": 11 },
    "totalAmount": { "x": 100, "y": 680, "page": 1, "size": 11 },
    "signature": { "x": 380, "y": 223, "page": 3, "size": 11 }
  }
}
```

### Template Requirements

- PDF templates stored in Supabase `contract-templates` bucket
- Each template has a corresponding coordinate map
- Templates are immutable once coordinates are set

## 🚀 Usage

### Basic Contract Processing

```typescript
import { processContractWithPdfTemplate } from './utils/pdfContractProcessor';

const contractData = {
  contractId: 'contract-001',
  clientName: 'Jane Doe',
  clientEmail: 'jane@example.com',
  templateKey: 'labor_support_v1',
  totalAmount: '2400.00',
  deposit: '400.00',
  // ... other contract data
};

const result = await processContractWithPdfTemplate(contractData, signNowToken);
```

### API Endpoints

#### Process Contract

```bash
POST /api/pdf-contract/process
{
  "contractId": "contract-001",
  "clientName": "Jane Doe",
  "clientEmail": "jane@example.com",
  "templateKey": "labor_support_v1",
  "totalAmount": "2400.00",
  "deposit": "400.00"
}
```

#### Get Available Templates

```bash
GET /api/pdf-contract/templates
```

#### Validate Contract Data

```bash
POST /api/pdf-contract/validate
{
  "templateKey": "labor_support_v1",
  "contractData": { ... }
}
```

## 🔄 Workflow

1. **Template Selection**: Choose template by key (e.g., `labor_support_v1`)
2. **Data Validation**: Validate contract data against template requirements
3. **PDF Filling**: Fill PDF template with contract data using fixed coordinates
4. **SignNow Upload**: Upload filled PDF to SignNow
5. **Field Addition**: Add signature fields using coordinate map
6. **Invitation**: Create signing invitation for client
7. **Storage**: Upload to Supabase for archival

## 📊 Coordinate System

### Coordinate Format

```typescript
interface CoordinatePosition {
  x: number; // X position in points
  y: number; // Y position in points
  page: number; // Page number (1-based)
  size?: number; // Font size (optional, default 11)
}
```

### SignNow Field Mapping

- Signature fields use coordinate map for precise placement
- Text fields positioned relative to signature areas
- All coordinates are template-specific and fixed

## 🧪 Testing

### Test Script

```bash
node scripts/testPdfContractSystem.js
```

### Manual Testing

```bash
# Test contract processing
curl -X POST http://localhost:5050/api/pdf-contract/test \
  -H "Content-Type: application/json" \
  -d '{"templateKey": "labor_support_v1"}'
```

## 🔧 Maintenance

### Adding New Templates

1. **Upload PDF Template** to Supabase `contract-templates` bucket
2. **Add Coordinate Map** to `pdfCoordinates.json`
3. **Test Coordinates** using coordinate testing scripts
4. **Deploy** new template version

### Updating Coordinates

1. **Identify Drift** using PDF comparison tools
2. **Update Coordinates** in `pdfCoordinates.json`
3. **Test New Coordinates** with test scripts
4. **Deploy** updated coordinates

## 📋 Template Management

### Current Templates

- **labor_support_v1**: Labor Support Agreement
- **postpartum_v1**: Postpartum Doula Services

### Template Naming Convention

- Format: `{service_type}_v{version}`
- Examples: `labor_support_v1`, `postpartum_v1`
- Versions allow for template updates while maintaining backward compatibility

## 🎯 Best Practices

1. **Never Modify PDF Templates**: Keep templates immutable once coordinates are
   set
2. **Test Coordinates Thoroughly**: Use coordinate testing scripts before
   deployment
3. **Version Templates**: Use version numbers for template updates
4. **Document Changes**: Keep coordinate maps well-documented
5. **Monitor SignNow Alignment**: Regularly verify field alignment in SignNow

## 🚨 Migration from DOCX System

### Deprecated Components

- `convertDocxToPdf()` function
- `generateContractDocx()` function
- `soffice` LibreOffice conversion
- `docxtemplater` processing

### Migration Steps

1. **Convert Templates**: Upload PDF versions to Supabase
2. **Create Coordinate Maps**: Define coordinates for each template
3. **Update API Calls**: Switch to new PDF-based endpoints
4. **Test Thoroughly**: Verify all contracts generate correctly
5. **Remove Old Code**: Clean up deprecated DOCX processing code

## 📈 Performance Benefits

- **Faster Processing**: No DOCX conversion overhead
- **Consistent Results**: Identical layout every time
- **Reduced Errors**: No layout drift issues
- **Better UX**: Perfect SignNow field alignment
- **Lower Maintenance**: Fixed coordinates require minimal updates

---

_This system ensures 100% consistency and perfect SignNow field alignment for
all contract generations._






