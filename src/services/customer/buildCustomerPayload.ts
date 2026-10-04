/**
 * Compatibility shim — the QuickBooks customer payload rule lives in
 * `src/features/clients/domain`. Prefer importing from `src/features/clients`.
 */
import { buildQuickBooksCustomerPayload } from '../../features/clients';

export type { QuickBooksCustomerDraft as BuildCustomerPayloadResult } from '../../features/clients';

export default buildQuickBooksCustomerPayload;
