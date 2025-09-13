# Contract System Setup - Client Integration

## Overview

The contract system has been redesigned to properly integrate with the existing `client_info` table, ensuring contracts are correctly associated with clients/users in the system.

## Database Schema

### Main Tables

#### 1. `contracts` - Main Contract Table
```sql
CREATE TABLE contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES client_info(id) ON DELETE CASCADE,  -- ✅ Links to client_info
  template_id BIGINT REFERENCES contract_templates(id),
  template_name TEXT,
  fee TEXT,
  deposit TEXT,
  note TEXT,
  document_url TEXT,
  status TEXT DEFAULT 'draft',
  generated_by UUID REFERENCES users(id),  -- ✅ Links to users table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

#### 2. `contract_templates` - Contract Templates
```sql
CREATE TABLE contract_templates (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  fee TEXT,
  deposit TEXT
);
```

#### 3. `contract_signnow_integration` - SignNow Integration
```sql
CREATE TABLE contract_signnow_integration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  signnow_document_id VARCHAR(255) UNIQUE,
  signnow_envelope_id VARCHAR(255),
  signing_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. `contract_payments` - Payment Tracking
```sql
CREATE TABLE contract_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL, -- deposit, installment, final
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, canceled, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE
);
```

## Key Relationships

### Client Association
- **`contracts.client_id`** → **`client_info.id`**
  - This is the **primary relationship** ensuring contracts are linked to actual clients
  - Uses `ON DELETE CASCADE` so if a client is deleted, their contracts are also removed

### User Association
- **`contracts.generated_by`** → **`users.id`**
  - Tracks which user (staff/admin) created the contract

### Template Association
- **`contracts.template_id`** → **`contract_templates.id`**
  - Links contracts to predefined templates for consistency

## Contract Status Flow

```
draft → pending_signature → signed → active → completed
  ↓
cancelled (can happen at any stage)
```

## Usage Examples

### 1. Create a Contract for a Client
```typescript
import { ContractClientService } from '../services/contractClientService';

const contractService = new ContractClientService();

const contract = await contractService.createContract({
  client_id: 'client-uuid-from-client_info',  // ✅ Must reference client_info.id
  template_id: 1,
  fee: '$2,500',
  deposit: '$500',
  note: 'Standard postpartum doula services',
  generated_by: 'user-uuid-from-users'  // ✅ Must reference users.id
});
```

### 2. Get Contract with Client Information
```typescript
const contractWithClient = await contractService.getContractWithClient('contract-uuid');

console.log(contractWithClient.client_info.first_name); // Client's first name
console.log(contractWithClient.generated_by_user.firstname); // Staff member who created it
```

### 3. Get All Contracts for a Client
```typescript
const clientContracts = await contractService.getContractsByClient('client-uuid');
```

### 4. Integrate with SignNow
```typescript
// Create SignNow integration
const signNowIntegration = await contractService.createSignNowIntegration(
  'contract-uuid',
  'signnow-document-id',
  'https://signnow.com/sign/...'
);

// Update signing status
await contractService.updateSignNowStatus('contract-uuid', 'signed');
```

### 5. Handle Payments
```typescript
// Create payment record
const payment = await contractService.createContractPayment(
  'contract-uuid',
  'deposit',
  500.00,
  'pi_stripe_payment_intent_id'
);

// Get all payments for a contract
const payments = await contractService.getContractPayments('contract-uuid');
```

## Migration Instructions

### 1. Run the Migration
```bash
# Apply the migration to update your contracts table
psql -d your_database -f src/db/migrations/update_contracts_table_for_client_info.sql
```

### 2. Update Existing Data (if needed)
If you have existing contracts that need to be migrated:

```sql
-- Example: Update existing contracts to link with client_info
UPDATE contracts
SET client_id = (
  SELECT id FROM client_info
  WHERE client_info.email = contracts.client_email
)
WHERE client_id IS NULL;
```

### 3. Update Your Code
Replace any existing contract services with the new `ContractClientService`:

```typescript
// Old way (if you were using the SignNow-focused service)
// import { ContractService } from '../services/contractService';

// New way
import { ContractClientService } from '../services/contractClientService';
```

## Benefits of This Setup

### ✅ Proper Client Association
- Contracts are now properly linked to `client_info` table
- Easy to query all contracts for a specific client
- Maintains data integrity with foreign key constraints

### ✅ Separation of Concerns
- Main contract data separate from SignNow integration
- Payment tracking in dedicated table
- Template management in separate table

### ✅ Flexible Status Tracking
- Clear contract status flow
- SignNow status tracked separately
- Payment status tracked separately

### ✅ Audit Trail
- Tracks who generated each contract
- Timestamps for all major events
- Complete payment history

### ✅ Scalable Design
- Supports multiple payment types (deposits, installments, final)
- Easy to add new contract templates
- SignNow integration can be extended or replaced

## Next Steps

1. **Run the migration** to update your database schema
2. **Update your existing code** to use the new `ContractClientService`
3. **Test the integration** with a few sample contracts
4. **Update your API endpoints** to use the new service methods
5. **Add contract templates** to the `contract_templates` table as needed

This setup ensures your contracts are properly integrated with your existing client management system while maintaining flexibility for document signing and payment processing.
