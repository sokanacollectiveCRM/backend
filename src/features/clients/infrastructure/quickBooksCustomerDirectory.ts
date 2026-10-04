import createCustomerInQuickBooks from '../../../services/customer/createCustomerInQuickBooks';
import findCustomerInQuickBooks, {
  findCustomerInQuickBooksByDisplayName,
  findCustomerInQuickBooksById,
} from '../../../services/payments/findCustomerInQuickBooks';
import { QuickBooksCustomerDirectory } from '../application/ports';
import { QuickBooksCustomerPayload } from '../domain/quickBooksCustomer';

export class QuickBooksOnlineCustomerDirectory
  implements QuickBooksCustomerDirectory
{
  async findById(qboCustomerId: string): Promise<string | null> {
    return (await findCustomerInQuickBooksById(qboCustomerId)) || null;
  }

  async findByEmail(email: string): Promise<string | null> {
    return (await findCustomerInQuickBooks(email)) || null;
  }

  async findByDisplayName(displayName: string): Promise<string | null> {
    return (await findCustomerInQuickBooksByDisplayName(displayName)) || null;
  }

  async create(payload: QuickBooksCustomerPayload): Promise<string> {
    const customer = await createCustomerInQuickBooks(payload);
    return customer.Id;
  }
}
