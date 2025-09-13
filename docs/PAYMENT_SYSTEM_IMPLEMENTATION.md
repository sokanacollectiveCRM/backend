# Payment Tracking System - Complete Implementation

## 🎯 **What You Get**

A complete payment tracking system that handles:
- ✅ **Payment schedules** created when admin creates contracts
- ✅ **Due date tracking** for every payment
- ✅ **Payment status** (pending, succeeded, failed, refunded)
- ✅ **Overdue flags** automatically set after due date
- ✅ **Payment history** for complete audit trail
- ✅ **Dashboard views** for easy management

## 🚀 **Implementation Steps**

### Step 1: Run the Database Migration

```bash
psql -d your_database -f src/db/migrations/implement_payment_tracking_system.sql
```

This will:
- Add payment tracking columns to your existing tables
- Create payment schedules and tracking tables
- Add all necessary functions and views
- Create sample data for existing contracts

### Step 2: Update Your Contract Creation

When an admin creates a contract, you can now include payment schedule information:

```typescript
import { ContractClientService } from '../services/contractClientService';

const contractService = new ContractClientService();

// Create contract with payment schedule
const contract = await contractService.createContract({
  client_id: 'client-uuid-from-client_info',
  template_id: 1,
  fee: '$2,500',
  deposit: '$500',
  note: 'Standard postpartum doula services',
  generated_by: 'user-uuid-from-users',
  // Payment schedule (NEW!)
  payment_schedule: {
    schedule_name: 'Standard Payment Plan',
    total_amount: 2500.00,
    deposit_amount: 500.00,
    number_of_installments: 3,
    payment_frequency: 'monthly',
    start_date: '2024-02-01'
  }
});
```

### Step 3: Use the Payment System

```typescript
// Get payment summary for a contract
const summary = await contractService.getContractPaymentSummary('contract-id');
console.log(`Total: $${summary.total_amount}, Paid: $${summary.total_paid}, Due: $${summary.total_due}`);

// Get overdue payments
const overdue = await contractService.getOverduePayments();
console.log(`${overdue.length} payments are overdue`);

// Update payment status when payment is processed
await contractService.updatePaymentStatus(
  'payment-id',
  'succeeded',
  'stripe-payment-intent-id',
  'Payment processed successfully'
);

// Get payment dashboard
const dashboard = await contractService.getPaymentDashboard();
```

## 📊 **Database Tables Created**

### 1. **Enhanced `contract_payments` table:**
- `due_date` - When payment is due
- `payment_schedule_id` - Links to payment schedule
- `payment_number` - Payment number in sequence
- `total_payments` - Total payments in schedule
- `is_overdue` - Automatically set when overdue

### 2. **New `payment_schedules` table:**
- `contract_id` - Links to contract
- `schedule_name` - Name of payment plan
- `total_amount` - Total contract amount
- `deposit_amount` - Deposit amount
- `installment_amount` - Amount per installment
- `number_of_installments` - Number of installments
- `payment_frequency` - How often payments are due

## 🔧 **Key Functions Available**

### Database Functions:
- `create_payment_schedule()` - Creates payment plan and individual payments
- `get_contract_payment_summary()` - Gets payment status for a contract
- `get_overdue_payments()` - Lists all overdue payments
- `update_overdue_flags()` - Updates overdue status
- `daily_payment_maintenance()` - Runs daily maintenance

### Service Methods:
- `createPaymentSchedule()` - Create payment schedule
- `getPaymentSummary()` - Get payment summary
- `getOverduePayments()` - Get overdue payments
- `updatePaymentStatus()` - Update payment status
- `getPaymentDashboard()` - Get dashboard data

## 📋 **API Endpoints**

Add to your server:

```typescript
import paymentRoutes from './routes/paymentRoutes';
app.use('/api/payments', paymentRoutes);
```

Available endpoints:
- `GET /api/payments/dashboard` - Payment dashboard
- `GET /api/payments/overdue` - Overdue payments
- `GET /api/payments/contract/:contractId/summary` - Contract payment summary
- `GET /api/payments/contract/:contractId/schedule` - Payment schedule
- `GET /api/payments/contract/:contractId/history` - Payment history
- `PUT /api/payments/payment/:paymentId/status` - Update payment status
- `POST /api/payments/maintenance/daily` - Run daily maintenance

## 🔄 **Daily Maintenance**

Set up a cron job to run daily maintenance:

```bash
# Add to your crontab
0 1 * * * curl -X POST http://your-api/api/payments/maintenance/daily
```

Or call manually:
```typescript
await contractService.runDailyPaymentMaintenance();
```

## 📈 **Example Payment Schedules**

### Standard Postpartum Services:
- **Deposit**: $500 (due immediately)
- **Installment 1**: $666.67 (due in 1 month)
- **Installment 2**: $666.67 (due in 2 months)
- **Installment 3**: $666.67 (due in 3 months)

### Extended Support:
- **Deposit**: $750 (due immediately)
- **Installments**: 4 payments of $687.50 (monthly)

### Overnight Care:
- **One-time payment**: $1,800 (due in 30 days)

## 🎯 **What Happens Automatically**

1. **When contract is created** → Payment schedule is created
2. **Individual payment records** → Created for each installment
3. **Due dates** → Calculated based on frequency
4. **Overdue flags** → Set automatically when due date passes
5. **Payment status** → Clears overdue flag when paid
6. **Schedule completion** → Status updated when all payments made

## 🔍 **Monitoring & Reports**

### Payment Dashboard:
```sql
SELECT * FROM payment_dashboard;
```

### Overdue Payments:
```sql
SELECT * FROM get_overdue_payments();
```

### Contract Payment Summary:
```sql
SELECT * FROM get_contract_payment_summary('contract-id');
```

## ✅ **Benefits**

- ✅ **Automatic tracking** - No manual work needed
- ✅ **Complete audit trail** - Full payment history
- ✅ **Overdue detection** - Never miss late payments
- ✅ **Flexible schedules** - Support any payment plan
- ✅ **Easy integration** - Works with existing contract system
- ✅ **Dashboard views** - Easy monitoring and reporting

## 🚀 **Ready to Use**

Your payment tracking system is now complete! You can:

1. Create contracts with payment schedules
2. Track due dates and payment status
3. Monitor overdue payments
4. View comprehensive payment dashboards
5. Run daily maintenance to keep everything updated

The system automatically handles all the complex logic while providing you with simple, easy-to-use interfaces for managing payments across all your contracts.
