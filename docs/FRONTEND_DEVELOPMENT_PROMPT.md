# Frontend Development Prompt for Enhanced Contract System

## 🎯 **Task Overview**

You need to update the frontend to integrate with the enhanced contract system. The backend has been upgraded to automatically calculate contract amounts and generate contracts ready for signature with payment integration.

## 🔄 **What Changed**

**OLD SYSTEM:**
- Admin manually entered all contract values
- Contracts sent with blank fields for client to fill
- No automatic calculations
- No payment integration after signing

**NEW SYSTEM:**
- Admin enters basic service details (hours, rate, payment terms)
- System automatically calculates all amounts (total, deposit, installments)
- Contracts generated with prefilled values ready for signature
- Automatic payment schedule creation
- Stripe integration for post-signature payments

## 📋 **Required Implementation**

### 1. **Contract Calculation Form**
Create a form with these fields:
- `total_hours` (number input)
- `hourly_rate` (number input)
- `deposit_type` (dropdown: "percent" or "flat")
- `deposit_value` (number input)
- `installments_count` (number input, 2-5)
- `cadence` (dropdown: "monthly" or "biweekly")

### 2. **Real-time Calculation Preview**
- Add a "Calculate Contract" button
- Call the calculation API and display results:
  - Total Amount
  - Deposit Amount
  - Balance Amount
  - Individual Installment Amounts
- Show these in a highlighted preview box

### 3. **Client Information Form**
- Client email (required)
- Client name (required)
- "Send Contract" button

### 4. **Payment Integration (After Signing)**
- Create payment intent after contract signing
- Integrate with Stripe Elements for payment processing
- Show payment status and confirmation

## 🔧 **API Endpoints to Implement**

### Calculate Contract Amounts
```javascript
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

Response:
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

### Send Contract for Signature
```javascript
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

Response:
{
  "success": true,
  "message": "Contract created with prefilled values and sent to client via DocuSign",
  "amounts": { /* calculated amounts */ },
  "envelopeId": "envelope-12345",
  "docusign": { /* DocuSign response */ },
  "prefilledValues": { /* contract fields */ }
}
```

### Create Payment Intent (After Signing)
```javascript
POST /api/stripe/contract/{contractId}/create-payment

Response:
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

## 💻 **Implementation Example (React/Next.js)**

```typescript
import { useState } from 'react';

interface ContractInput {
  total_hours: number;
  hourly_rate: number;
  deposit_type: 'percent' | 'flat';
  deposit_value: number;
  installments_count: number;
  cadence: 'monthly' | 'biweekly';
}

interface ClientInfo {
  email: string;
  name: string;
}

interface CalculatedAmounts {
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  installments_amounts: number[];
}

const ContractForm = () => {
  const [contractInput, setContractInput] = useState<ContractInput>({
    total_hours: 120,
    hourly_rate: 35,
    deposit_type: 'percent',
    deposit_value: 15,
    installments_count: 3,
    cadence: 'monthly'
  });

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    email: '',
    name: ''
  });

  const [calculatedAmounts, setCalculatedAmounts] = useState<CalculatedAmounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'calculation' | 'client' | 'sent'>('input');

  // Calculate contract amounts
  const calculateAmounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contract/postpartum/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractInput)
      });
      const result = await response.json();

      if (result.success) {
        setCalculatedAmounts(result.amounts);
        setStep('calculation');
      } else {
        alert('Calculation failed: ' + result.error);
      }
    } catch (error) {
      console.error('Calculation failed:', error);
      alert('Failed to calculate contract amounts');
    }
    setLoading(false);
  };

  // Send contract for signature
  const sendContract = async () => {
    if (!clientInfo.email || !clientInfo.name) {
      alert('Please fill in client information');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/contract/postpartum/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_input: contractInput,
          client: clientInfo
        })
      });
      const result = await response.json();

      if (result.success) {
        setStep('sent');
        alert('Contract sent for signature! Client will receive an email.');
      } else {
        alert('Failed to send contract: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to send contract:', error);
      alert('Failed to send contract');
    }
    setLoading(false);
  };

  return (
    <div className="contract-form">
      <h2>Create Postpartum Care Contract</h2>

      {step === 'input' && (
        <div className="step-input">
          <h3>Step 1: Service Details</h3>

          <div className="form-group">
            <label>Total Hours:</label>
            <input
              type="number"
              value={contractInput.total_hours}
              onChange={(e) => setContractInput({
                ...contractInput,
                total_hours: Number(e.target.value)
              })}
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Hourly Rate ($):</label>
            <input
              type="number"
              value={contractInput.hourly_rate}
              onChange={(e) => setContractInput({
                ...contractInput,
                hourly_rate: Number(e.target.value)
              })}
              min="1"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label>Deposit Type:</label>
            <select
              value={contractInput.deposit_type}
              onChange={(e) => setContractInput({
                ...contractInput,
                deposit_type: e.target.value as 'percent' | 'flat'
              })}
            >
              <option value="percent">Percentage</option>
              <option value="flat">Flat Amount</option>
            </select>
          </div>

          <div className="form-group">
            <label>Deposit Value:</label>
            <input
              type="number"
              value={contractInput.deposit_value}
              onChange={(e) => setContractInput({
                ...contractInput,
                deposit_value: Number(e.target.value)
              })}
              min="1"
              step={contractInput.deposit_type === 'percent' ? '1' : '0.01'}
            />
            <span>{contractInput.deposit_type === 'percent' ? '%' : '$'}</span>
          </div>

          <div className="form-group">
            <label>Number of Installments (2-5):</label>
            <input
              type="number"
              value={contractInput.installments_count}
              onChange={(e) => setContractInput({
                ...contractInput,
                installments_count: Number(e.target.value)
              })}
              min="2"
              max="5"
            />
          </div>

          <div className="form-group">
            <label>Payment Cadence:</label>
            <select
              value={contractInput.cadence}
              onChange={(e) => setContractInput({
                ...contractInput,
                cadence: e.target.value as 'monthly' | 'biweekly'
              })}
            >
              <option value="monthly">Monthly</option>
              <option value="biweekly">Bi-weekly</option>
            </select>
          </div>

          <button
            onClick={calculateAmounts}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Calculating...' : 'Calculate Contract'}
          </button>
        </div>
      )}

      {step === 'calculation' && calculatedAmounts && (
        <div className="step-calculation">
          <h3>Step 2: Contract Calculation Preview</h3>

          <div className="calculation-preview">
            <div className="amount-row">
              <span className="label">Total Contract Amount:</span>
              <span className="amount">${calculatedAmounts.total_amount.toFixed(2)}</span>
            </div>

            <div className="amount-row">
              <span className="label">Deposit Amount:</span>
              <span className="amount deposit">${calculatedAmounts.deposit_amount.toFixed(2)}</span>
            </div>

            <div className="amount-row">
              <span className="label">Balance Amount:</span>
              <span className="amount">${calculatedAmounts.balance_amount.toFixed(2)}</span>
            </div>

            <div className="installments">
              <h4>Payment Schedule:</h4>
              {calculatedAmounts.installments_amounts.map((amount, index) => (
                <div key={index} className="installment-row">
                  <span>Payment {index + 1}:</span>
                  <span>${amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="actions">
            <button onClick={() => setStep('input')} className="btn-secondary">
              Edit Details
            </button>
            <button onClick={() => setStep('client')} className="btn-primary">
              Continue to Client Info
            </button>
          </div>
        </div>
      )}

      {step === 'client' && (
        <div className="step-client">
          <h3>Step 3: Client Information</h3>

          <div className="form-group">
            <label>Client Email:</label>
            <input
              type="email"
              value={clientInfo.email}
              onChange={(e) => setClientInfo({
                ...clientInfo,
                email: e.target.value
              })}
              required
            />
          </div>

          <div className="form-group">
            <label>Client Name:</label>
            <input
              type="text"
              value={clientInfo.name}
              onChange={(e) => setClientInfo({
                ...clientInfo,
                name: e.target.value
              })}
              required
            />
          </div>

          <div className="actions">
            <button onClick={() => setStep('calculation')} className="btn-secondary">
              Back to Calculation
            </button>
            <button
              onClick={sendContract}
              disabled={loading || !clientInfo.email || !clientInfo.name}
              className="btn-primary"
            >
              {loading ? 'Sending Contract...' : 'Send Contract for Signature'}
            </button>
          </div>
        </div>
      )}

      {step === 'sent' && (
        <div className="step-sent">
          <h3>✅ Contract Sent Successfully!</h3>
          <p>The contract has been generated with all calculated amounts and sent to the client for signature.</p>
          <p>Client will receive an email with instructions to sign the contract.</p>
          <p>After signing, the client will be directed to make the deposit payment.</p>

          <button
            onClick={() => {
              setStep('input');
              setCalculatedAmounts(null);
              setClientInfo({ email: '', name: '' });
            }}
            className="btn-primary"
          >
            Create Another Contract
          </button>
        </div>
      )}
    </div>
  );
};

export default ContractForm;
```

## 🎨 **Styling Requirements**

```css
.contract-form {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.step-input, .step-calculation, .step-client, .step-sent {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input, .form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.calculation-preview {
  background: #e8f5e8;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #4caf50;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 16px;
}

.amount {
  font-weight: bold;
}

.deposit {
  color: #ff6b35;
}

.installments {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ccc;
}

.installment-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

## 📱 **Mobile Responsiveness**

- Ensure form inputs work well on mobile devices
- Use responsive design for calculation preview
- Make buttons touch-friendly
- Test on various screen sizes

## 🔧 **Environment Variables Needed**

Add these to your frontend environment:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
NEXT_PUBLIC_API_URL=http://localhost:5050
```

## 🧪 **Testing Checklist**

- [ ] Form validation works correctly
- [ ] Calculation API returns expected results
- [ ] Contract sending works with valid data
- [ ] Error handling displays user-friendly messages
- [ ] Loading states work properly
- [ ] Mobile responsiveness is good
- [ ] All form fields are accessible

## 🚀 **Implementation Priority**

1. **High Priority**: Contract calculation form and preview
2. **High Priority**: Client information form and contract sending
3. **Medium Priority**: Payment integration (can be added later)
4. **Low Priority**: Advanced styling and animations

## 📋 **Acceptance Criteria**

- [ ] Admin can enter service details (hours, rate, payment terms)
- [ ] System calculates and displays contract amounts
- [ ] Admin can enter client information
- [ ] Contract is sent with all values prefilled
- [ ] Success confirmation is shown
- [ ] Form resets for next contract creation
- [ ] Error handling works for all failure scenarios
- [ ] Mobile-friendly design

## 🎯 **Key Benefits**

- **Simplified workflow**: Only basic details needed
- **Automatic calculations**: No manual math required
- **Professional contracts**: All values prefilled
- **Better user experience**: Clear steps and validation
- **Payment ready**: Integration with Stripe for post-signature payments

This implementation will provide a much smoother experience for creating and managing contracts with automatic calculations and seamless payment integration.
