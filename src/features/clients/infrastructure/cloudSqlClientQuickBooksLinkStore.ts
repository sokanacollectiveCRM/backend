import saveQboCustomerIdToPhiClient from '../../../services/customer/saveQboCustomerIdToPhiClient';
import { ClientQuickBooksLinkStore } from '../application/ports';

export class CloudSqlClientQuickBooksLinkStore
  implements ClientQuickBooksLinkStore
{
  async saveCustomerId(clientId: string, qboCustomerId: string): Promise<void> {
    await saveQboCustomerIdToPhiClient(clientId, qboCustomerId);
  }
}
