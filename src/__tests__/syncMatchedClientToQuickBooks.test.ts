import createCustomerInQuickBooks from '../services/customer/createCustomerInQuickBooks';
import saveQboCustomerIdToPhiClient from '../services/customer/saveQboCustomerIdToPhiClient';
import { syncMatchedClientToQuickBooks } from '../services/customer/syncMatchedClientToQuickBooks';
import findCustomerInQuickBooks, {
  findCustomerInQuickBooksByDisplayName,
  findCustomerInQuickBooksById,
} from '../services/payments/findCustomerInQuickBooks';

jest.mock('../services/customer/createCustomerInQuickBooks', () => {
  return {
    __esModule: true,
    default: jest.fn(async () => ({ Id: 'QB-CREATED-1' })),
  };
});

jest.mock('../services/customer/saveQboCustomerIdToPhiClient', () => {
  return {
    __esModule: true,
    default: jest.fn(async () => undefined),
  };
});

jest.mock('../services/payments/findCustomerInQuickBooks', () => {
  return {
    __esModule: true,
    default: jest.fn(async () => null),
    findCustomerInQuickBooksByDisplayName: jest.fn(async () => null),
    findCustomerInQuickBooksById: jest.fn(async (id: string) => id),
  };
});

describe('syncMatchedClientToQuickBooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early when existingQboCustomerId already exists', async () => {
    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
      existingQboCustomerId: 'QB-EXISTING',
    });

    expect(result).toEqual({
      qboCustomerId: 'QB-EXISTING',
      alreadyExisted: true,
    });
    expect(findCustomerInQuickBooksById).toHaveBeenCalledWith('QB-EXISTING');
    expect(findCustomerInQuickBooks).not.toHaveBeenCalled();
    expect(findCustomerInQuickBooksByDisplayName).not.toHaveBeenCalled();
    expect(createCustomerInQuickBooks).not.toHaveBeenCalled();
    expect(saveQboCustomerIdToPhiClient).not.toHaveBeenCalled();
  });

  it('links by email when found and does not create', async () => {
    (findCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce(
      'QB-BY-EMAIL'
    );

    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
    });

    expect(result).toEqual({
      qboCustomerId: 'QB-BY-EMAIL',
      alreadyExisted: true,
    });
    expect(findCustomerInQuickBooks).toHaveBeenCalledWith('test@example.com');
    expect(findCustomerInQuickBooksByDisplayName).not.toHaveBeenCalled();
    expect(createCustomerInQuickBooks).not.toHaveBeenCalled();
    expect(saveQboCustomerIdToPhiClient).toHaveBeenCalledWith(
      'client-1',
      'QB-BY-EMAIL'
    );
  });

  it('links by display name when email not found and does not create', async () => {
    (findCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce(null);
    (findCustomerInQuickBooksByDisplayName as jest.Mock).mockResolvedValueOnce(
      'QB-BY-NAME'
    );

    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
    });

    expect(findCustomerInQuickBooksByDisplayName).toHaveBeenCalledWith(
      'Test Client'
    );
    expect(result).toEqual({
      qboCustomerId: 'QB-BY-NAME',
      alreadyExisted: true,
    });
    expect(createCustomerInQuickBooks).not.toHaveBeenCalled();
    expect(saveQboCustomerIdToPhiClient).toHaveBeenCalledWith(
      'client-1',
      'QB-BY-NAME'
    );
  });

  it('creates customer when no matches found, then saves qbo id', async () => {
    (findCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce(null);
    (findCustomerInQuickBooksByDisplayName as jest.Mock).mockResolvedValueOnce(
      null
    );
    (createCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce({
      Id: 'QB-CREATED-1',
    });

    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
    });

    expect(createCustomerInQuickBooks).toHaveBeenCalledWith({
      GivenName: 'Test',
      FamilyName: 'Client',
      DisplayName: 'Test Client',
      PrimaryEmailAddr: { Address: 'test@example.com' },
    });
    expect(saveQboCustomerIdToPhiClient).toHaveBeenCalledWith(
      'client-1',
      'QB-CREATED-1'
    );
    expect(result).toEqual({
      qboCustomerId: 'QB-CREATED-1',
      alreadyExisted: false,
    });
  });

  it('relinks by email when the stored QuickBooks id no longer exists', async () => {
    (findCustomerInQuickBooksById as jest.Mock).mockResolvedValueOnce(null);
    (findCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce(
      'QB-BY-EMAIL'
    );

    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
      existingQboCustomerId: 'QB-STALE',
    });

    expect(findCustomerInQuickBooksById).toHaveBeenCalledWith('QB-STALE');
    expect(saveQboCustomerIdToPhiClient).toHaveBeenCalledWith(
      'client-1',
      'QB-BY-EMAIL'
    );
    expect(result).toEqual({
      qboCustomerId: 'QB-BY-EMAIL',
      alreadyExisted: true,
    });
  });

  it('skips the email lookup without an email and uses default names', async () => {
    (findCustomerInQuickBooksByDisplayName as jest.Mock).mockResolvedValueOnce(
      null
    );
    (createCustomerInQuickBooks as jest.Mock).mockResolvedValueOnce({
      Id: 'QB-CREATED-2',
    });

    const result = await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: '',
      lastName: 'Client',
      email: '',
    });

    expect(findCustomerInQuickBooks).not.toHaveBeenCalled();
    expect(findCustomerInQuickBooksByDisplayName).toHaveBeenCalledWith(
      'Unknown Client'
    );
    expect(createCustomerInQuickBooks).toHaveBeenCalledWith({
      GivenName: 'Unknown',
      FamilyName: 'Client',
      DisplayName: 'Unknown Client',
      PrimaryEmailAddr: { Address: '' },
    });
    expect(result).toEqual({
      qboCustomerId: 'QB-CREATED-2',
      alreadyExisted: false,
    });
  });

  it('uses the Client default when only a first name exists', async () => {
    (findCustomerInQuickBooksByDisplayName as jest.Mock).mockResolvedValueOnce(
      'QB-BY-NAME'
    );

    await syncMatchedClientToQuickBooks({
      clientId: 'client-1',
      firstName: 'Jane',
      lastName: '',
      email: '',
    });

    expect(findCustomerInQuickBooksByDisplayName).toHaveBeenCalledWith(
      'Jane Client'
    );
  });

  it('throws when no name and no email provided', async () => {
    await expect(
      syncMatchedClientToQuickBooks({
        clientId: 'client-1',
        firstName: '',
        lastName: '',
        email: '',
      })
    ).rejects.toThrow(/no name or email/i);
  });
});
