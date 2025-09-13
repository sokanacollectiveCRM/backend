# Contract System API Reference

## 🚀 Enhanced Contract System Endpoints

### Contract Calculation & Generation

#### Calculate Contract Amounts
```http
POST /api/contract/postpartum/calculate
Content-Type: application/json

{
  "total_hours": 120,
  "hourly_rate": 35,
  "deposit_type": "percent",
  "deposit_value": 15,
  "installments_count": 3,
  "cadence": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "amounts": {
    "total_amount": 4200.00,
    "deposit_amount": 630.00,
    "balance_amount": 3570.00,
    "installments_amounts": [1785.00, 1785.00]
  },
  "fields": {
    "total_hours": "120",
    "hourly_rate_fee": "35.00",
    "deposit": "630.00",
    "overnight_fee_amount": "0.00",
    "total_amount": "4200.00"
  }
}
```

#### Send Contract for Signature
```http
POST /api/contract/postpartum/send
Content-Type: application/json

{
  "contract_input": {
    "total_hours": 120,
    "hourly_rate": 35,
    "deposit_type": "percent",
    "deposit_value": 15,
    "installments_count": 3,
    "cadence": "monthly"
  },
  "client": {
    "email": "client@example.com",
    "name": "John Doe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contract created with prefilled values and sent to client via DocuSign",
  "amounts": {
    "total_amount": 4200.00,
    "deposit_amount": 630.00,
    "balance_amount": 3570.00,
    "installments_amounts": [1785.00, 1785.00]
  },
  "envelopeId": "envelope-12345",
  "docusign": {
    "envelopeId": "envelope-12345",
    "status": "sent"
  },
  "prefilledValues": {
    "total_hours": "120",
    "hourly_rate_fee": "35.00",
    "deposit": "630.00",
    "overnight_fee_amount": "0.00",
    "total_amount": "4200.00"
  }
}
```

### Payment Processing (After Contract Signing)

#### Create Payment Intent
```http
POST /api/stripe/contract/{contractId}/create-payment
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_intent_id": "pi_1234567890",
    "client_secret": "pi_1234567890_secret_abc123",
    "amount": 63000,
    "currency": "usd",
    "status": "requires_payment_method",
    "customer_email": "client@example.com"
  }
}
```

#### Check Payment Status
```http
GET /api/stripe/check-payment-status/{paymentIntentId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pi_1234567890",
    "status": "succeeded",
    "amount": 63000,
    "currency": "usd"
  }
}
```

#### Get Next Payment for Contract
```http
GET /api/stripe/contract/{contractId}/next-payment
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment-123",
    "contract_id": "contract-456",
    "payment_type": "deposit",
    "amount": 630.00,
    "due_date": "2024-01-15",
    "status": "pending",
    "is_overdue": false
  }
}
```

#### Get Payment Summary
```http
GET /api/stripe/contract/{contractId}/payment-summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_amount": 4200.00,
    "deposit_amount": 630.00,
    "balance_amount": 3570.00,
    "total_paid": 630.00,
    "total_due": 3570.00,
    "installments_remaining": 2,
    "next_payment_due": "2024-02-15",
    "next_payment_amount": 1785.00
  }
}
```

### Webhook Endpoint (for Stripe)

#### Stripe Webhook
```http
POST /api/stripe/webhook
Content-Type: application/json
Stripe-Signature: t=1234567890,v1=signature

{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 63000,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "contract_id": "contract-456",
        "payment_id": "payment-123"
      }
    }
  }
}
```

## 📋 Input Validation Rules

### Contract Input Validation
- `total_hours`: Must be > 0
- `hourly_rate`: Must be > 0
- `deposit_type`: Must be "percent" or "flat"
- `deposit_value`:
  - If percent: 10-20%
  - If flat: > 0 and < total amount
- `installments_count`: 2-5 installments
- `cadence`: "monthly" or "biweekly"

### Client Information Validation
- `email`: Valid email format
- `name`: Non-empty string

## 🔄 Complete Workflow Example

### 1. Calculate Contract
```javascript
const response = await fetch('/api/contract/postpartum/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    total_hours: 120,
    hourly_rate: 35,
    deposit_type: 'percent',
    deposit_value: 15,
    installments_count: 3,
    cadence: 'monthly'
  })
});
const result = await response.json();
```

### 2. Send Contract
```javascript
const response = await fetch('/api/contract/postpartum/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contract_input: contractData,
    client: { email: 'client@example.com', name: 'John Doe' }
  })
});
const result = await response.json();
```

### 3. Create Payment Intent (After Signing)
```javascript
const response = await fetch(`/api/stripe/contract/${contractId}/create-payment`, {
  method: 'POST'
});
const result = await response.json();
const { client_secret } = result.data;
```

### 4. Process Payment with Stripe Elements
```javascript
const stripe = Stripe('pk_test_your_publishable_key');
const elements = stripe.elements({ clientSecret: client_secret });
// Initialize payment form with Stripe Elements
```

## 🚨 Error Handling

### Validation Errors
```json
{
  "success": false,
  "error": "Total hours must be greater than 0"
}
```

### Server Errors
```json
{
  "success": false,
  "error": "Failed to calculate contract amounts"
}
```

### Payment Errors
```json
{
  "success": false,
  "error": "No pending payments found for this contract"
}
```

## 🔧 Environment Variables Needed

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (for frontend)
- `STRIPE_WEBHOOK_SECRET`: Webhook endpoint secret
- `DOCUSIGN_*`: DocuSign configuration variables

## 📱 Frontend Integration Notes

1. **Always validate inputs** before sending to API
2. **Show loading states** during API calls
3. **Handle errors gracefully** with user-friendly messages
4. **Use the calculated amounts** to show preview before sending
5. **Implement proper error boundaries** for payment processing
6. **Test with Stripe test mode** before going live

This API provides a complete contract-to-payment workflow with automatic calculations and seamless integration.
