/**
 * Public billing feature API.
 * This slice owns the mounted `/api/billing` portal.
 * Payments, invoices, financial reconciliation, and payment methods stay on
 * their existing mounts until a later step.
 */

export { default as billingRoutes } from './http/billingRoutes';
export {
  getLimitedBillingContractById,
  listLimitedBillingContracts,
} from './infrastructure/limitedBillingContractsService';
export type {
  LimitedContractBillingSummary,
  LimitedContractInstallment,
  LimitedContractPaymentSchedule,
} from './infrastructure/limitedBillingContractsService';
export {
  BillingContractDownloadError,
  getBillingContractDocument,
  getBillingContractDownloadLink,
} from './infrastructure/billingContractDownloadService';
export {
  BillingReminderValidationError,
  sendBillingReminderEmail,
} from './infrastructure/billingReminderService';
