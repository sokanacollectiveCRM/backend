const { DEFAULT_CONFIG } = require('../../types/postpartum');

const toCents = (n) => Math.round(n * 100);
const fromCents = (c) => c / 100;
const formatAmount = (amount) => amount.toFixed(2);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function calculatePostpartumContract(input) {
  // Validate inputs
  if (input.total_hours <= 0) {
    throw new ValidationError('Total hours must be greater than 0');
  }
  if (input.hourly_rate <= 0) {
    throw new ValidationError('Hourly rate must be greater than 0');
  }
  if (input.installments_count < DEFAULT_CONFIG.min_installments ||
      input.installments_count > DEFAULT_CONFIG.max_installments) {
    throw new ValidationError(`Installments must be between ${DEFAULT_CONFIG.min_installments} and ${DEFAULT_CONFIG.max_installments}`);
  }

  // Calculate total in cents
  const total = toCents(input.total_hours * input.hourly_rate);

  // Calculate deposit
  const deposit = input.deposit_type === 'percent'
    ? Math.round(total * (input.deposit_value / 100))
    : toCents(input.deposit_value);

  // Validate deposit
  if (input.deposit_type === 'percent') {
    if (input.deposit_value < DEFAULT_CONFIG.min_deposit_percent ||
        input.deposit_value > DEFAULT_CONFIG.max_deposit_percent) {
      throw new ValidationError(`Deposit percentage must be between ${DEFAULT_CONFIG.min_deposit_percent}% and ${DEFAULT_CONFIG.max_deposit_percent}%`);
    }
  }
  if (deposit <= 0 || deposit >= total) {
    throw new ValidationError('Invalid deposit amount');
  }

  // Calculate balance and installments
  const balance = total - deposit;
  const base = Math.floor(balance / input.installments_count);
  const remainder = balance - (base * input.installments_count);

  // Create installments array with remainder added to last payment
  const installments = Array.from(
    { length: input.installments_count },
    (_, i) => i === input.installments_count - 1 ? base + remainder : base
  );

  return {
    total_amount: fromCents(total),
    deposit_amount: fromCents(deposit),
    balance_amount: fromCents(balance),
    installments_amounts: installments.map(fromCents)
  };
}

function formatForSignNow(input, amounts) {
  const scheduleText = input.cadence === 'biweekly'
    ? 'every two weeks'
    : 'monthly';

  const installmentText = amounts.installments_amounts
    .map((amount, i) => `Payment ${i + 1}: $${formatAmount(amount)}`)
    .join('\n');

  return {
    total_hours: input.total_hours.toString(),
    hourly_rate_fee: formatAmount(input.hourly_rate),
    total_amount: formatAmount(amounts.total_amount),
    deposit_amount: formatAmount(amounts.deposit_amount),
    balance_amount: formatAmount(amounts.balance_amount),
    installment_amounts: amounts.installments_amounts.map(formatAmount),
    payment_schedule: `${installmentText}\n\nPayments will be processed ${scheduleText}`
  };
}

module.exports = {
  calculatePostpartumContract,
  formatForSignNow,
  ValidationError
};
