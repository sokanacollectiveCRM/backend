# Stripe Payment Integration - Post Contract Signing

## 🎯 **Overview**

This integration handles Stripe payments after a contract is signed. When a client signs a contract, they are redirected to a payment flow where they can pay their deposit or first installment.

## 🚀 **How It Works**

### **Flow:**
1. **Contract is signed** → Status becomes 'signed'
2. **Redirect to payment page** → Client sees payment form
3. **Create Stripe Payment Intent** → Backend generates payment request
4. **Client completes payment** → Stripe processes the payment
5. **Webhook confirms payment** → Database is updated automatically
6. **Contract status updates** → Becomes 'active' when payments complete

## 🔧 **Setup Required**

### **1. Environment Variables**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **2. Stripe Webhook Configuration**
In your Stripe dashboard, set up webhooks to point to:
```
https://your-domain.com/api/stripe/webhook
```

**Events to listen for:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

### **3. Add Routes to Your Server**
```typescript
import stripePaymentRoutes from './routes/stripePaymentRoutes';

app.use('/api/stripe', stripePaymentRoutes);
```

## 📋 **API Endpoints**

### **Create Payment After Contract Signing**
```http
POST /api/stripe/contract/{contractId}/create-payment
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_intent_id": "pi_...",
    "client_secret": "pi_..._secret_...",
    "amount": 50000,
    "currency": "usd",
    "status": "requires_payment_method"
  }
}
```

### **Create Payment for Specific Payment**
```http
POST /api/stripe/contract/{contractId}/payment/{paymentId}/create
```

**Body:**
```json
{
  "amount": 500.00,
  "description": "Deposit payment for contract",
  "metadata": {
    "custom_field": "value"
  }
}
```

### **Check Payment Status**
```http
GET /api/stripe/payment-intent/{paymentIntentId}/status
```

### **Get Next Payment**
```http
GET /api/stripe/contract/{contractId}/next-payment
```

### **Confirm Payment Completion**
```http
POST /api/stripe/payment-intent/{paymentIntentId}/confirm
```

## 💻 **Frontend Integration**

### **1. After Contract Signing Redirect**

```typescript
// After successful contract signing
const handleContractSigned = async (contractId: string) => {
  try {
    // Create payment intent
    const response = await fetch(`/api/stripe/contract/${contractId}/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });

    const result = await response.json();

    if (result.success) {
      // Redirect to payment page with client secret
      window.location.href = `/payment?client_secret=${result.data.client_secret}&contract_id=${contractId}`;
    }
  } catch (error) {
    console.error('Error creating payment:', error);
  }
};
```

### **2. Payment Page Component**

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PaymentForm = ({ clientSecret, contractId }: { clientSecret: string, contractId: string }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success?contract_id=${contractId}`,
      },
    });

    if (error) {
      console.error('Payment failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>
        Pay Now
      </button>
    </form>
  );
};

const PaymentPage = () => {
  const [clientSecret, setClientSecret] = useState('');
  const { contractId } = useParams();

  useEffect(() => {
    // Get client secret from URL params or create new payment
    const urlParams = new URLSearchParams(window.location.search);
    const secret = urlParams.get('client_secret');

    if (secret) {
      setClientSecret(secret);
    }
  }, []);

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <Elements options={options} stripe={stripePromise}>
      <PaymentForm clientSecret={clientSecret} contractId={contractId} />
    </Elements>
  );
};
```

### **3. Payment Success Page**

```typescript
const PaymentSuccess = () => {
  const { contractId } = useParams();
  const [paymentStatus, setPaymentStatus] = useState('processing');

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        // Get payment intent ID from URL or local storage
        const paymentIntentId = localStorage.getItem('payment_intent_id');

        if (paymentIntentId) {
          const response = await fetch(`/api/stripe/payment-intent/${paymentIntentId}/confirm`);
          const result = await response.json();

          setPaymentStatus(result.data.status);

          if (result.data.status === 'succeeded') {
            // Payment successful, redirect to contract or dashboard
            window.location.href = `/contracts/${contractId}`;
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    checkPaymentStatus();
  }, [contractId]);

  return (
    <div>
      {paymentStatus === 'processing' && <p>Processing payment...</p>}
      {paymentStatus === 'succeeded' && <p>Payment successful!</p>}
      {paymentStatus === 'failed' && <p>Payment failed. Please try again.</p>}
    </div>
  );
};
```

## 🔄 **Webhook Processing**

The system automatically handles webhook events:

### **Payment Success:**
- Updates payment status to 'succeeded'
- Clears overdue flag
- Updates contract status to 'active' if all payments complete

### **Payment Failure:**
- Updates payment status to 'failed'
- Keeps payment as pending for retry

### **Payment Cancellation:**
- Updates payment status to 'canceled'

## 📊 **Payment Flow Examples**

### **Standard Contract (Deposit + 3 Installments):**

1. **Contract Signed** → Redirect to payment
2. **Deposit Payment** → $500 due immediately
3. **Payment Success** → Contract becomes 'active'
4. **Future Installments** → $666.67 each month

### **Payment Schedule:**
```
Day 1: Contract signed → Deposit due ($500)
Day 30: Installment 1 due ($666.67)
Day 60: Installment 2 due ($666.67)
Day 90: Installment 3 due ($666.67)
```

## 🔍 **Monitoring & Testing**

### **Test Webhook Locally:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### **Check Payment Status:**
```typescript
// Get payment summary
const summary = await contractService.getContractPaymentSummary(contractId);
console.log(`Paid: $${summary.total_paid}, Due: $${summary.total_due}`);

// Get overdue payments
const overdue = await contractService.getOverduePayments();
console.log(`${overdue.length} overdue payments`);
```

### **Manual Payment Status Update:**
```typescript
// Update payment status manually if needed
await contractService.updatePaymentStatus(
  'payment-id',
  'succeeded',
  'stripe-payment-intent-id',
  'Payment processed successfully'
);
```

## ✅ **Benefits**

- ✅ **Automatic payment processing** after contract signing
- ✅ **Webhook-based status updates** for reliability
- ✅ **Customer management** with Stripe
- ✅ **Payment retry logic** for failed payments
- ✅ **Complete audit trail** of all payments
- ✅ **Flexible payment schedules** support
- ✅ **Real-time payment status** tracking

## 🚀 **Ready to Use**

Your Stripe integration is now complete! After a contract is signed:

1. **Client gets redirected** to payment page
2. **Payment intent is created** automatically
3. **Client completes payment** via Stripe
4. **Webhook updates database** automatically
5. **Contract status updates** when payments complete

The system handles all the complex payment logic while providing a smooth user experience! 🎉
