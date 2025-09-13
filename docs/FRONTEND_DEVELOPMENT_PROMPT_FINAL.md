# Frontend Development Prompt - Enhanced Contract System (SignNow)

## 🎯 **Task Overview**

You need to update the frontend to integrate with the enhanced contract system using **SignNow** for digital signatures. The backend automatically calculates contract amounts and generates contracts ready for signature.

## ⚠️ **Important SignNow Note**

The current SignNow integration has a limitation: **contracts need to be manually set up with signature fields in SignNow before they can be sent for signing**. This is a SignNow API limitation that requires either:

1. **Manual setup**: Admin manually adds signature fields in SignNow dashboard
2. **Template approach**: Use pre-configured SignNow templates with signature fields
3. **Simple workflow**: Generate contract and provide SignNow document ID for manual field setup

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
- Call the calculation API and display results
- Show calculated amounts in a highlighted preview box

### 3. **Client Information Form**
- Client email (required)
- Client name (required)
- "Generate Contract" button

### 4. **Contract Generation & Manual Setup**
- Generate contract and get SignNow document ID
- Show instructions for manual signature field setup
- Provide SignNow document link for admin to add fields

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

### Generate Contract (Simple Approach)
```javascript
POST /api/signnow/generate-and-upload-contract-only
Content-Type: application/json

{
  "clientEmail": "client@example.com",
  "clientName": "John Doe",
  "total_hours": "120",
  "hourly_rate_fee": "35.00",
  "deposit": "630.00",
  "overnight_fee_amount": "0.00",
  "total_amount": "4200.00"
}

Response:
{
  "success": true,
  "message": "Contract generated and uploaded to SignNow successfully",
  "documentId": "signnow-doc-12345",
  "contractData": {
    "total_hours": "120",
    "hourly_rate_fee": "35.00",
    "deposit": "630.00",
    "overnight_fee_amount": "0.00",
    "total_amount": "4200.00"
  },
  "signNowUrl": "https://app.signnow.com/document/signnow-doc-12345",
  "nextSteps": [
    "1. Go to your SignNow account",
    "2. Find the uploaded document",
    "3. Add signature fields manually",
    "4. Send for signing"
  ],
  "note": "Contract contains all prefilled values. You can now manually add signature fields and send for signing."
}
```

### Alternative: Try Automated Approach (May Fail)
```javascript
POST /api/signnow/generate-and-send-contract-complete
Content-Type: application/json

{
  "client": {
    "email": "client@example.com",
    "name": "John Doe"
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

interface SignNowFields {
  total_hours: string;
  hourly_rate_fee: string;
  deposit: string;
  overnight_fee_amount: string;
  total_amount: string;
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
  const [signNowFields, setSignNowFields] = useState<SignNowFields | null>(null);
  const [contractResult, setContractResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'calculation' | 'client' | 'generated'>('input');

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
        setSignNowFields(result.fields);
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

  // Generate contract (simple approach)
  const generateContract = async () => {
    if (!clientInfo.email || !clientInfo.name || !signNowFields) {
      alert('Please fill in client information and calculate amounts first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/signnow/generate-and-upload-contract-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: clientInfo.email,
          clientName: clientInfo.name,
          ...signNowFields
        })
      });
      const result = await response.json();

      if (result.success) {
        setContractResult(result);
        setStep('generated');
      } else {
        alert('Failed to generate contract: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to generate contract:', error);
      alert('Failed to generate contract');
    }
    setLoading(false);
  };

  // Try automated approach (may fail due to SignNow limitations)
  const tryAutomatedApproach = async () => {
    if (!clientInfo.email || !clientInfo.name || !signNowFields) {
      alert('Please fill in client information and calculate amounts first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/signnow/generate-and-send-contract-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientInfo,
          fields: signNowFields
        })
      });
      const result = await response.json();

      if (result.success) {
        setContractResult(result);
        setStep('generated');
        alert('Contract sent successfully via SignNow!');
      } else {
        // Fall back to manual approach
        console.log('Automated approach failed, trying manual approach...');
        await generateContract();
      }
    } catch (error) {
      console.error('Automated approach failed:', error);
      // Fall back to manual approach
      await generateContract();
    }
    setLoading(false);
  };

  return (
    <div className="contract-form">
      <h2>Create Postpartum Care Contract (SignNow Integration)</h2>

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

      {step === 'calculation' && calculatedAmounts && signNowFields && (
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

            <div className="signnow-fields">
              <h4>SignNow Fields (Auto-generated):</h4>
              <p><strong>Total Hours:</strong> {signNowFields.total_hours}</p>
              <p><strong>Hourly Rate:</strong> ${signNowFields.hourly_rate_fee}</p>
              <p><strong>Deposit:</strong> ${signNowFields.deposit}</p>
              <p><strong>Total Amount:</strong> ${signNowFields.total_amount}</p>
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
              onClick={tryAutomatedApproach}
              disabled={loading || !clientInfo.email || !clientInfo.name}
              className="btn-primary"
            >
              {loading ? 'Generating Contract...' : 'Generate & Send Contract (Auto)'}
            </button>
            <button
              onClick={generateContract}
              disabled={loading || !clientInfo.email || !clientInfo.name}
              className="btn-secondary"
            >
              {loading ? 'Generating Contract...' : 'Generate Contract (Manual Setup)'}
            </button>
          </div>
        </div>
      )}

      {step === 'generated' && contractResult && (
        <div className="step-generated">
          <h3>✅ Contract Generated Successfully!</h3>

          <div className="contract-result">
            <div className="result-info">
              <p><strong>Document ID:</strong> {contractResult.documentId}</p>
              <p><strong>Client:</strong> {clientInfo.name} ({clientInfo.email})</p>
              <p><strong>Total Amount:</strong> ${contractResult.contractData?.total_amount}</p>
            </div>

            {contractResult.signNowUrl && (
              <div className="signnow-instructions">
                <h4>📝 Next Steps (Manual Setup Required):</h4>
                <ol>
                  <li>Click the SignNow link below to open the document</li>
                  <li>Add signature fields manually in the SignNow editor</li>
                  <li>Send the contract for client signature</li>
                </ol>

                <div className="signnow-link">
                  <a
                    href={contractResult.signNowUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-signnow"
                  >
                    Open in SignNow
                  </a>
                </div>
              </div>
            )}

            {contractResult.nextSteps && (
              <div className="next-steps">
                <h4>📋 Next Steps:</h4>
                <ul>
                  {contractResult.nextSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="note">
              <strong>Note:</strong> {contractResult.note}
            </div>
          </div>

          <div className="actions">
            <button
              onClick={() => {
                setStep('input');
                setCalculatedAmounts(null);
                setSignNowFields(null);
                setContractResult(null);
                setClientInfo({ email: '', name: '' });
              }}
              className="btn-primary"
            >
              Create Another Contract
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractForm;
```

## 🎨 **Additional Styling**

```css
.step-generated {
  background: #e8f5e8;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #4caf50;
}

.contract-result {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.result-info {
  background: #f0f8ff;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.signnow-instructions {
  background: #fff3cd;
  padding: 15px;
  border-radius: 4px;
  border-left: 4px solid #ffc107;
  margin: 20px 0;
}

.signnow-link {
  margin: 15px 0;
}

.btn-signnow {
  background: #28a745;
  color: white;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 4px;
  display: inline-block;
  font-weight: bold;
}

.btn-signnow:hover {
  background: #218838;
  color: white;
}

.next-steps {
  background: #d1ecf1;
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

.next-steps ul {
  margin: 10px 0;
  padding-left: 20px;
}

.note {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  border-left: 4px solid #6c757d;
  margin: 20px 0;
  font-style: italic;
}
```

## 🔧 **Environment Variables**

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
NEXT_PUBLIC_API_URL=http://localhost:5050
```

## 🧪 **Testing Strategy**

1. **Test calculation endpoint** first
2. **Test contract generation** (manual approach)
3. **Test automated approach** (may fail gracefully)
4. **Verify SignNow document creation**
5. **Test manual field setup workflow**

## 📋 **Acceptance Criteria**

- [ ] Admin can enter service details and see calculations
- [ ] Contract generates successfully with prefilled values
- [ ] SignNow document ID is returned
- [ ] Clear instructions provided for manual field setup
- [ ] Fallback to manual approach if automated fails
- [ ] Professional UI with clear workflow steps
- [ ] Mobile-responsive design

## ⚠️ **Important Notes**

1. **SignNow Limitation**: Signature fields must be added manually in SignNow dashboard
2. **Fallback Strategy**: Always provide manual setup option
3. **User Experience**: Clear instructions for next steps
4. **Error Handling**: Graceful fallback when automated approach fails
5. **Document Tracking**: Save SignNow document IDs for future reference

This implementation provides a robust solution that works around SignNow's field limitations while providing a smooth user experience.
