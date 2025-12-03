# QuickBooks Payment Integration - Recording Stripe Payments

## 🎯 Overview

This document outlines how to implement automatic recording of Stripe payments
in QuickBooks Online when payments are recorded in the database. The integration
will ensure that every successful Stripe payment is synchronized to QuickBooks
with proper customer information.

## 📋 Current Setup Analysis

### QuickBooks Integration

- **Authentication**: OAuth 2.0 with token refresh (`quickbooksAuthService.ts`)
- **API Client**: `qboClient.ts` - handles authenticated requests to QuickBooks
  Online API v3
- **Customer Management**:
  - `createCustomerInQuickBooks.ts` - creates customers in QuickBooks
  - `saveQboCustomerId.ts` - maps internal customer IDs to QuickBooks customer
    IDs
  - Customers table has `qbo_customer_id` field for mapping
- **Invoice Management**: `createInvoiceInQuickBooks.ts` - creates invoices in
  QuickBooks

### Stripe Payment Flow

- **Payment Recording**: Payments saved to `charges` table via
  `StripePaymentService.chargeCard()`
- **Webhook Handler**: `handlePaymentSuccess()` processes
  `payment_intent.succeeded` events
- **Charge Table Structure**:
  - `customer_id` - links to internal customers table
  - `stripe_payment_intent_id` - Stripe payment intent ID
  - `amount` - payment amount in cents
  - `status` - payment status
  - `description` - payment description

## 🏗️ Implementation Architecture

### Approach 1: Payment Record (Recommended)

Record payments directly in QuickBooks without creating invoices first. This is
simpler and suitable when:

- Payments are one-time transactions
- You don't need to track invoices separately
- You want to minimize API calls

### Approach 2: Invoice + Payment

Create an invoice first, then record payment against it. Better for:

- Tracking outstanding invoices
- Matching payments to specific line items
- More detailed accounting records

**Recommendation**: Start with Approach 1, add Approach 2 later if needed.

## 🔧 Implementation Steps

### Step 1: Create QuickBooks Payment Service

**File**: `src/services/payments/createPaymentInQuickBooks.ts`

**Responsibilities**:

- Ensure customer exists in QuickBooks (create if needed)
- Record payment in QuickBooks
- Handle errors gracefully (log but don't fail payment processing)

**Key Functions**:

```typescript
async function ensureCustomerInQuickBooks(customerId: string): Promise<string>;
async function createPaymentInQuickBooks(
  paymentData: PaymentData
): Promise<string>;
```

### Step 2: Payment Data Structure

**Required Information**:

- Customer ID (internal)
- Payment amount (in dollars, not cents)
- Payment date
- Payment method (e.g., "Credit Card", "Stripe")
- Description/reference
- Stripe payment intent ID (for reference)

**QuickBooks Payment API Requirements**:

- Customer reference (Customer.Id)
- Payment amount
- Payment method
- Payment date
- Optional: Invoice reference (if using Approach 2)

### Step 3: Integration Points

#### Option A: Integrate in `chargeCard()` method

**Location**: `src/services/payments/stripePaymentService.ts`

**When**: After successful charge is saved to database **Pros**: Immediate sync,
simple flow **Cons**: Blocks payment response if QuickBooks is slow

#### Option B: Integrate in Webhook Handler (Recommended)

**Location**: `src/services/stripePaymentService.ts` → `handlePaymentSuccess()`

**When**: After payment is confirmed via webhook **Pros**: Non-blocking, handles
all payment confirmations **Cons**: Slight delay (webhook processing time)

#### Option C: Background Job/Queue

**When**: Async processing after payment is recorded **Pros**: Most resilient,
can retry on failure **Cons**: Requires job queue infrastructure

**Recommendation**: Start with Option B (webhook handler), add Option C later
for production resilience.

### Step 4: Customer Synchronization

**Important**: The client originally used QuickBooks, so many customers may
already exist in QuickBooks. We need to handle both scenarios:

- **Existing QuickBooks Customers**: Find and link to existing customer in
  QuickBooks
- **New Customers**: Create new customer in QuickBooks when they make their
  first Stripe payment

**Flow**:

1. Check if customer has `qbo_customer_id` in database
   - If yes, use that ID (customer already linked)
2. If no `qbo_customer_id`, search QuickBooks for existing customer by email
   - Query QuickBooks:
     `SELECT * FROM Customer WHERE PrimaryEmailAddr = '{email}'`
   - If found, save `qbo_customer_id` and use it
3. If not found in QuickBooks, create new customer:
   - Get customer data from `customers` table
   - Map to QuickBooks customer format
   - Create via `createCustomerInQuickBooks()`
   - Save `qbo_customer_id` via `saveQboCustomerId()`

**Customer Data Mapping**:

- `name` → `DisplayName`
- `email` → `PrimaryEmailAddr.Address`
- `phone_number` → `PrimaryPhone.FreeFormNumber` (if available)
- Address fields → `BillAddr` (if available)

**QuickBooks Query for Existing Customers**:

```sql
SELECT * FROM Customer WHERE PrimaryEmailAddr = 'customer@example.com'
```

This prevents duplicate customer creation and links to existing QuickBooks
customers.

### Step 5: Payment Recording

**QuickBooks Payment API Endpoint**:
`POST /v3/company/{realmId}/payment?minorversion=65`

**Payment Payload Structure**:

```json
{
  "CustomerRef": {
    "value": "qbo_customer_id"
  },
  "TotalAmt": 500.0,
  "PaymentMethodRef": {
    "value": "1", // Credit Card payment method ID
    "name": "Credit Card"
  },
  "TxnDate": "2024-01-15",
  "PrivateNote": "Stripe Payment Intent: pi_xxx",
  "Line": [
    {
      "Amount": 500.0,
      "LinkedTxn": [] // Optional: link to invoice if using Approach 2
    }
  ]
}
```

### Step 6: Error Handling

**Strategy**: Fail gracefully - don't block payment processing if QuickBooks
sync fails

**Error Scenarios**:

1. **QuickBooks not connected**: Log warning, continue
2. **Customer creation fails**: Log error, retry later (optional)
3. **Payment creation fails**: Log error, store for manual sync
4. **Token expired**: Auto-refresh via `qboClient.ts`

**Implementation**:

- Wrap QuickBooks calls in try-catch
- Log all errors with context
- Optionally store failed syncs in a `qb_sync_queue` table for retry

### Step 7: Database Schema Updates

**Optional Enhancements**:

1. Add `qbo_payment_id` to `charges` table to track QuickBooks payment ID
2. Add `qb_sync_status` field: `pending`, `synced`, `failed`
3. Add `qb_sync_error` field for error messages
4. Create `qb_sync_queue` table for failed syncs (if using background jobs)

**Migration Example**:

```sql
ALTER TABLE charges
ADD COLUMN IF NOT EXISTS qbo_payment_id TEXT,
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;

CREATE INDEX IF NOT EXISTS charges_qb_sync_status_idx ON charges(qb_sync_status);
```

## 📝 Implementation Checklist

### Phase 1: Core Integration ✅

- [x] Create `createPaymentInQuickBooks.ts` service
- [x] Create `findCustomerInQuickBooks.ts` - search for existing customers
- [x] Create `ensureCustomerInQuickBooks.ts` - handle both existing and new
      customers
- [x] Create `syncPaymentToQuickBooks.ts` - sync helper with status tracking
- [x] Implement customer lookup/creation logic
- [x] Implement payment creation logic
- [x] Add error handling and logging
- [x] Integrate into webhook handler (`handlePaymentSuccess`)
- [x] Integrate into direct charge method (`chargeCard`)
- [x] Add database fields for sync tracking

### Phase 2: Testing

- [ ] Test with existing QuickBooks customers (by email lookup)
- [ ] Test with new customers (auto-create in QuickBooks)
- [ ] Test error scenarios (disconnected QB, invalid data)
- [ ] Test payment amount conversion (cents to dollars)
- [ ] Verify payment appears correctly in QuickBooks
- [ ] Verify customer linking works for existing QuickBooks customers

### Phase 3: Enhancements

- [ ] Implement retry mechanism for failed syncs
- [ ] Add admin dashboard to view sync status
- [ ] Add manual sync trigger for failed payments
- [ ] Consider invoice-based approach (Approach 2)
- [ ] Add webhook retry logic

## 🔍 QuickBooks API Details

### Payment Method Reference

QuickBooks has predefined payment methods. Common ones:

- Credit Card: Usually ID "1" or "Credit Card"
- Check: Usually ID "2" or "Check"
- Cash: Usually ID "3" or "Cash"

**Note**: You may need to query QuickBooks for available payment methods:

```
GET /v3/company/{realmId}/query?query=SELECT * FROM PaymentMethod
```

### Amount Format

- **Stripe**: Amounts in cents (e.g., 50000 = $500.00)
- **QuickBooks**: Amounts in dollars (e.g., 500.00 = $500.00)
- **Conversion**: Divide by 100 when sending to QuickBooks

### Date Format

- Use ISO 8601 format: `YYYY-MM-DD`
- Use payment date from Stripe or current date

## 🚨 Important Considerations

### 1. Duplicate Prevention

- Check if payment already exists in QuickBooks before creating
- Use `qbo_payment_id` field to track synced payments
- Query QuickBooks by payment reference (Stripe payment intent ID in
  PrivateNote)

### 2. Payment Method Mapping

- Stripe payments should map to "Credit Card" in QuickBooks
- May need to create custom payment method if not exists
- Store payment method ID for reuse

### 3. Currency

- Ensure currency matches (USD in both systems)
- QuickBooks may support multi-currency, verify if needed

### 4. Tax Handling

- QuickBooks payments may include tax calculations
- For simple integration, set `TotalAmt` without tax breakdown
- Add tax handling later if required

### 5. Reconciliation

- Stripe fees are separate from payment amounts
- Consider recording Stripe fees as expenses separately
- May need separate QuickBooks entries for fees

## 📊 Example Flow

### Successful Payment Sync

1. Stripe webhook received: `payment_intent.succeeded`
2. Payment saved to `charges` table
3. `handlePaymentSuccess()` called
4. Customer lookup: Check `qbo_customer_id` in `customers` table
5. If missing: Create customer in QuickBooks, save `qbo_customer_id`
6. Create payment in QuickBooks with customer reference
7. Update `charges` table with `qbo_payment_id` and `qb_sync_status='synced'`
8. Log success

### Failed Sync (Non-blocking)

1. Payment saved to `charges` table
2. QuickBooks sync attempted
3. Error occurs (e.g., QuickBooks disconnected)
4. Update `charges` table with `qb_sync_status='failed'` and error message
5. Payment processing continues (not blocked)
6. Admin can manually retry sync later

## 🔄 Future Enhancements

1. **Background Job Queue**: Use Bull/BullMQ for async processing
2. **Invoice Integration**: Create invoices first, then record payments
3. **Fee Tracking**: Record Stripe fees as separate QuickBooks expenses
4. **Refund Handling**: Sync refunds to QuickBooks
5. **Reconciliation Dashboard**: View sync status and manually sync failed
   payments
6. **Webhook Retry**: Automatic retry for failed QuickBooks syncs
7. **Multi-currency Support**: Handle different currencies if needed

## 📚 References

- QuickBooks Online API v3 Documentation:
  https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/payment
- Current QuickBooks Integration: `src/services/auth/quickbooksAuthService.ts`
- Current Payment Service: `src/services/payments/stripePaymentService.ts`
- Customer Mapping: `src/services/customer/saveQboCustomerId.ts`

## 🎯 Implementation Summary

### Files Created

1. **`src/services/payments/findCustomerInQuickBooks.ts`** - Searches QuickBooks
   for existing customers by email
2. **`src/services/payments/ensureCustomerInQuickBooks.ts`** - Ensures customer
   exists (finds existing or creates new)
3. **`src/services/payments/createPaymentInQuickBooks.ts`** - Records payment in
   QuickBooks
4. **`src/services/payments/syncPaymentToQuickBooks.ts`** - Helper to sync
   payment and update database status
5. **`src/db/migrations/add_quickbooks_sync_fields.sql`** - Database migration
   for sync tracking

### Integration Points

- **Webhook Handler**: `src/services/stripePaymentService.ts` →
  `saveToChargesTable()`
- **Direct Charge**: `src/services/payments/stripePaymentService.ts` →
  `chargeCard()`

### How It Works

1. **Payment Recorded**: When Stripe payment succeeds, it's saved to `charges`
   table with `qb_sync_status='pending'`
2. **Customer Lookup**: System checks if customer has `qbo_customer_id` in
   database
3. **Existing Customer Search**: If no ID, searches QuickBooks by email to find
   existing customer
4. **Customer Creation**: If not found, creates new customer in QuickBooks
5. **Payment Recording**: Records payment in QuickBooks with customer reference
6. **Status Update**: Updates `charges` table with `qbo_payment_id` and
   `qb_sync_status='synced'`

### Database Schema

The `charges` table now includes:

- `qbo_payment_id` - QuickBooks payment ID after successful sync
- `qb_sync_status` - Status: 'pending', 'synced', or 'failed'
- `qb_sync_error` - Error message if sync failed
