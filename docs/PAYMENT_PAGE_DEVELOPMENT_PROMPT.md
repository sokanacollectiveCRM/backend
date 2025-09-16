# Payment Page Development Prompt for Cursor

## Overview
Create a payment page that handles users redirected from SignNow after signing contracts. The page should fetch payment details using the contract ID from the URL and integrate with Stripe for payment processing.

## URL Structure
- **Payment Page**: `/payment?contract_id={contractId}`
- **Example**: `/payment?contract_id=f2eed073-72f8-469a-b74c-a97256908521`

## Backend API Endpoints Available

### 1. Get Payment Summary
```http
GET /api/stripe/contract/{contractId}/payment-summary
```
**Response:**
```json
{
  "success": true,
  "data": {
    "contract_id": "f2eed073-72f8-469a-b74c-a97256908521",
    "total_amount": 4200.00,
    "deposit_amount": 1500.00,
    "remaining_balance": 2700.00,
    "next_payment_amount": 1500.00,
    "next_payment_due_date": "2025-10-15",
    "installments": [
      {
        "amount": 900.00,
        "due_date": "2025-10-15",
        "status": "pending"
      },
      {
        "amount": 900.00,
        "due_date": "2025-11-15",
        "status": "pending"
      },
      {
        "amount": 900.00,
        "due_date": "2025-12-15",
        "status": "pending"
      }
    ]
  }
}
```

### 2. Create Payment Intent
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
    "amount": 150000,
    "currency": "usd",
    "status": "requires_payment_method"
  }
}
```

## Required Features

### 1. Contract ID Extraction
- Extract `contract_id` from URL query parameters
- Validate that contract ID exists and is valid UUID format
- Show error if contract ID is missing or invalid

### 2. Payment Details Display
- Fetch and display contract payment summary
- Show total contract value
- Show deposit amount (first payment)
- Show remaining balance
- Show next payment due date
- Display payment schedule/installments

### 3. Stripe Integration
- Integrate Stripe Elements for secure payment processing
- Use the `client_secret` from the payment intent API
- Handle payment success/failure states
- Show loading states during payment processing

### 4. Error Handling
- Handle API errors gracefully
- Show user-friendly error messages
- Handle network failures
- Handle invalid contract IDs

### 5. User Experience
- Clean, professional payment interface
- Clear payment amount and purpose
- Secure payment form
- Success/confirmation page after payment
- Loading indicators

## Technical Requirements

### Frontend Framework
- Use React with TypeScript
- Use React Router for navigation
- Use Stripe Elements for payment processing

### State Management
- Use React hooks (useState, useEffect)
- Handle loading, error, and success states
- Manage payment form state

### Styling
- Use Tailwind CSS or similar
- Responsive design for mobile/desktop
- Professional, trustworthy appearance
- Clear typography and spacing

### Security
- Never store sensitive payment data
- Use Stripe Elements for secure card input
- Validate all inputs
- Use HTTPS in production

## File Structure
```
src/
├── pages/
│   └── PaymentPage.tsx
├── components/
│   ├── PaymentForm.tsx
│   ├── PaymentSummary.tsx
│   └── LoadingSpinner.tsx
├── hooks/
│   └── usePaymentDetails.ts
├── types/
│   └── payment.ts
└── utils/
    └── api.ts
```

## Implementation Steps

### 1. Create Payment Page Component
```typescript
// src/pages/PaymentPage.tsx
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import PaymentSummary from '../components/PaymentSummary';
import PaymentForm from '../components/PaymentForm';

const PaymentPage = () => {
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get('contract_id');

  // Implementation here
};
```

### 2. Create Payment Details Hook
```typescript
// src/hooks/usePaymentDetails.ts
import { useState, useEffect } from 'react';

export const usePaymentDetails = (contractId: string) => {
  // Fetch payment summary from API
  // Return loading, error, and data states
};
```

### 3. Create Payment Form Component
```typescript
// src/components/PaymentForm.tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';

const PaymentForm = ({ contractId, amount, onSuccess }) => {
  // Stripe Elements integration
  // Payment processing logic
};
```

### 4. Create Payment Summary Component
```typescript
// src/components/PaymentSummary.tsx
interface PaymentSummaryProps {
  contractId: string;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
  nextPaymentDueDate: string;
  installments: Array<{
    amount: number;
    due_date: string;
    status: string;
  }>;
}
```

## API Integration

### Fetch Payment Details
```typescript
const fetchPaymentDetails = async (contractId: string) => {
  const response = await fetch(`/api/stripe/contract/${contractId}/payment-summary`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch payment details');
  }

  return data.data;
};
```

### Create Payment Intent
```typescript
const createPaymentIntent = async (contractId: string) => {
  const response = await fetch(`/api/stripe/contract/${contractId}/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create payment intent');
  }

  return data.data;
};
```

## Error Scenarios to Handle

1. **Missing Contract ID**: Show error message and redirect to home
2. **Invalid Contract ID**: Show error message with retry option
3. **Contract Not Found**: Show error message
4. **API Errors**: Show user-friendly error messages
5. **Payment Failed**: Show error message with retry option
6. **Network Errors**: Show offline message with retry option

## Success Flow

1. User signs contract in SignNow
2. Redirected to `/payment?contract_id={contractId}`
3. Page loads and fetches payment details
4. User sees payment summary and amount
5. User enters payment information
6. Payment is processed via Stripe
7. Success page is shown
8. User receives confirmation

## Testing Scenarios

1. **Valid Contract ID**: Should load payment details and show form
2. **Invalid Contract ID**: Should show error message
3. **Missing Contract ID**: Should show error message
4. **API Failure**: Should show error message with retry
5. **Payment Success**: Should show success page
6. **Payment Failure**: Should show error message with retry

## Environment Variables Needed

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_API_BASE_URL=http://localhost:5050
```

## Dependencies to Install

```json
{
  "@stripe/stripe-js": "^2.0.0",
  "@stripe/react-stripe-js": "^2.0.0",
  "react-router-dom": "^6.0.0",
  "axios": "^1.0.0"
}
```

## Additional Considerations

1. **Accessibility**: Ensure form is accessible with proper labels and ARIA attributes
2. **Mobile Responsive**: Ensure payment form works well on mobile devices
3. **Loading States**: Show loading indicators during API calls
4. **Validation**: Validate all inputs before submission
5. **Security**: Use Stripe Elements for secure card input
6. **Analytics**: Track payment events for business insights
7. **Logging**: Log errors for debugging purposes

## Example Contract Data

Based on the latest contract in the system:
- **Contract ID**: `f2eed073-72f8-469a-b74c-a97256908521`
- **Total Amount**: $4,200.00
- **Deposit Amount**: $1,500.00
- **Remaining Balance**: $2,700.00
- **Installments**: 3 payments of $900.00 each
- **Due Dates**: 2025-10-15, 2025-11-15, 2025-12-15

This payment page should handle the complete flow from contract signing to payment processing, providing a seamless experience for users.
