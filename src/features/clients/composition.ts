import { ClientsQuickBooksDeps } from './application/ports';
import { CloudSqlClientQuickBooksLinkStore } from './infrastructure/cloudSqlClientQuickBooksLinkStore';
import { QuickBooksOnlineCustomerDirectory } from './infrastructure/quickBooksCustomerDirectory';

export function createClientsQuickBooksDeps(): ClientsQuickBooksDeps {
  return {
    directory: new QuickBooksOnlineCustomerDirectory(),
    links: new CloudSqlClientQuickBooksLinkStore(),
  };
}
