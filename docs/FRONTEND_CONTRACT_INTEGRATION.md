# Frontend Contract Integration Guide

## 🚀 Enhanced Contract System Overview

The contract system has been enhanced to automatically calculate contract amounts and generate contracts ready for signature. Here's what's changed and how to integrate with the frontend.

## 📋 New Workflow

### Before (Old System)
1. Admin manually entered all contract values
2. Contract sent with blank fields
3. Client had to fill in amounts

### After (Enhanced System)
1. Admin enters basic service details (hours, rate, payment terms)
2. **System automatically calculates** all amounts (total, deposit, installments)
3. **Contract generated with prefilled values** ready for signature
4. **Payment schedule created** automatically
5. **Stripe integration** ready for post-signature payments

## 🔧 API Endpoints for Frontend

### 1. Calculate Contract Amounts
**Endpoint:** `POST /api/contract/postpartum/calculate`

**Request Body:**
```typescript
{
  total_hours: number;           // e.g., 120
  hourly_rate: number;           // e.g., 35
  deposit_type: "percent" | "flat";  // "percent" or "flat"
  deposit_value: number;         // 15 (for 15%) or 500 (for $500)
  installments_count: number;    // 2-5 installments
  cadence: "monthly" | "biweekly";
}
```

**Response:**
```typescript
{
  success: true,
  amounts: {
    total_amount: number;        // e.g., 4200.00
    deposit_amount: number;      // e.g., 630.00
    balance_amount: number;      // e.g., 3570.00
    installments_amounts: number[]; // e.g., [1785.00, 1785.00]
  },
  fields: {
    total_hours: string;         // "120"
    hourly_rate_fee: string;     // "35.00"
    deposit: string;             // "630.00"
    overnight_fee_amount: string; // "0.00"
    total_amount: string;        // "4200.00"
  }
}
```

### 2. Send Contract for Signature
**Endpoint:** `POST /api/contract/postpartum/send`

**Request Body:**
```typescript
{
  contract_input: {
    total_hours: number;
    hourly_rate: number;
    deposit_type: "percent" | "flat";
    deposit_value: number;
    installments_count: number;
    cadence: "monthly" | "biweekly";
  },
  client: {
    email: string;
    name: string;
  }
}
```

**Response:**
```typescript
{
  success: true,
  message: "Contract created with prefilled values and sent to client via DocuSign",
  amounts: { /* calculated amounts */ },
  envelopeId: string,
  docusign: { /* DocuSign response */ },
  prefilledValues: { /* contract fields */ }
}
```

### 3. Create Payment Intent (After Signature)
**Endpoint:** `POST /api/stripe/contract/{contractId}/create-payment`

**Response:**
```typescript
{
  success: true,
  data: {
    payment_intent_id: string,
    client_secret: string,
    amount: number,        // in cents
    currency: string,
    status: string,
    customer_email: string
  }
}
```

## 💻 Frontend Integration Examples

### React/Next.js Example

```typescript
// Contract calculation form
const ContractForm = () => {
  const [formData, setFormData] = useState({
    total_hours: 120,
    hourly_rate: 35,
    deposit_type: 'percent',
    deposit_value: 15,
    installments_count: 3,
    cadence: 'monthly'
  });
  const [calculatedAmounts, setCalculatedAmounts] = useState(null);
  const [loading, setLoading] = useState(false);

  // Calculate contract amounts
  const calculateAmounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contract/postpartum/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      setCalculatedAmounts(result.amounts);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
    setLoading(false);
  };

  // Send contract for signature
  const sendContract = async (clientInfo) => {
    try {
      const response = await fetch('/api/contract/postpartum/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_input: formData,
          client: clientInfo
        })
      });
      const result = await response.json();

      if (result.success) {
        // Show success message
        alert('Contract sent for signature!');
        // Redirect to contracts list or dashboard
      }
    } catch (error) {
      console.error('Failed to send contract:', error);
    }
  };

  return (
    <div>
      {/* Form fields for contract input */}
      <div>
        <label>Total Hours: </label>
        <input
          type="number"
          value={formData.total_hours}
          onChange={(e) => setFormData({...formData, total_hours: Number(e.target.value)})}
        />
      </div>

      <div>
        <label>Hourly Rate: $</label>
        <input
          type="number"
          value={formData.hourly_rate}
          onChange={(e) => setFormData({...formData, hourly_rate: Number(e.target.value)})}
        />
      </div>

      <div>
        <label>Deposit Type: </label>
        <select
          value={formData.deposit_type}
          onChange={(e) => setFormData({...formData, deposit_type: e.target.value})}
        >
          <option value="percent">Percentage</option>
          <option value="flat">Flat Amount</option>
        </select>
      </div>

      <div>
        <label>Deposit Value: </label>
        <input
          type="number"
          value={formData.deposit_value}
          onChange={(e) => setFormData({...formData, deposit_value: Number(e.target.value)})}
        />
        {formData.deposit_type === 'percent' ? '%' : '$'}
      </div>

      <button onClick={calculateAmounts} disabled={loading}>
        {loading ? 'Calculating...' : 'Calculate Contract'}
      </button>

      {/* Display calculated amounts */}
      {calculatedAmounts && (
        <div className="calculated-amounts">
          <h3>Calculated Contract Amounts</h3>
          <p>Total Amount: ${calculatedAmounts.total_amount.toFixed(2)}</p>
          <p>Deposit: ${calculatedAmounts.deposit_amount.toFixed(2)}</p>
          <p>Balance: ${calculatedAmounts.balance_amount.toFixed(2)}</p>
          <p>Installments: {calculatedAmounts.installments_amounts.map((amt, i) =>
            `Payment ${i+1}: $${amt.toFixed(2)}`
          ).join(', ')}</p>
        </div>
      )}

      {/* Client info form and send button */}
      <ClientForm onSend={sendContract} />
    </div>
  );
};

// Payment integration after contract signing
const PaymentComponent = ({ contractId }) => {
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [loading, setLoading] = useState(false);

  const createPaymentIntent = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stripe/contract/${contractId}/create-payment`, {
        method: 'POST'
      });
      const result = await response.json();

      if (result.success) {
        setPaymentIntent(result.data);
        // Initialize Stripe Elements with client_secret
        // Handle payment processing
      }
    } catch (error) {
      console.error('Failed to create payment intent:', error);
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={createPaymentIntent} disabled={loading}>
        {loading ? 'Creating Payment...' : 'Pay Now'}
      </button>

      {paymentIntent && (
        <div>
          <p>Payment Amount: ${(paymentIntent.amount / 100).toFixed(2)}</p>
          {/* Stripe Elements integration */}
        </div>
      )}
    </div>
  );
};
```

## 🎯 Key Changes for Frontend

### 1. **Simplified Form Input**
- Only need basic service details (hours, rate, payment terms)
- No manual calculation of amounts
- System handles all math automatically

### 2. **Real-time Calculations**
- Use `/calculate` endpoint to show amounts before sending
- Display calculated totals, deposit, and installments
- Validate inputs before contract generation

### 3. **Enhanced Contract Generation**
- Contracts are generated with **all values prefilled**
- Client receives contract ready for signature
- No blank fields for client to fill

### 4. **Automatic Payment Integration**
- Payment schedules created automatically
- Stripe integration ready after signature
- Webhook handling for payment confirmations

### 5. **Better User Experience**
- Clear calculation preview
- Professional contract generation
- Seamless payment flow

## 🔄 Complete Flow Example

```typescript
// 1. Admin enters contract details
const contractInput = {
  total_hours: 120,
  hourly_rate: 35,
  deposit_type: 'percent',
  deposit_value: 15,
  installments_count: 3,
  cadence: 'monthly'
};

// 2. Calculate amounts (optional preview)
const amounts = await calculateContract(contractInput);
// amounts.total_amount = 4200.00
// amounts.deposit_amount = 630.00
// amounts.installments_amounts = [1785.00, 1785.00]

// 3. Send contract for signature
const result = await sendContract({
  contract_input: contractInput,
  client: { email: 'client@example.com', name: 'John Doe' }
});

// 4. After client signs, create payment intent
const paymentIntent = await createPaymentIntent(result.envelopeId);

// 5. Process payment with Stripe
// Use paymentIntent.client_secret with Stripe Elements
```

## 📱 Mobile/Responsive Considerations

- Ensure form inputs work well on mobile
- Display calculated amounts prominently
- Use clear call-to-action buttons
- Show loading states during calculations
- Handle errors gracefully with user-friendly messages

## 🎨 UI/UX Recommendations

1. **Calculation Preview**: Show amounts in a highlighted box
2. **Progress Indicators**: Show steps (Calculate → Send → Payment)
3. **Error Handling**: Clear validation messages
4. **Success States**: Confirmation messages for each step
5. **Professional Design**: Clean, business-appropriate styling

This enhanced system provides a much smoother experience for both admins and clients, with automatic calculations and seamless payment integration.
