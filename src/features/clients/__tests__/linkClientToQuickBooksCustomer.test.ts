import {
  ClientsQuickBooksDeps,
  MissingQuickBooksCustomerIdentityError,
  linkClientToQuickBooksCustomer,
} from '..';

function fakeDeps(found: {
  byId?: string | null;
  byEmail?: string | null;
  byName?: string | null;
  created?: string;
}) {
  const deps = {
    directory: {
      findById: jest.fn().mockResolvedValue(found.byId ?? null),
      findByEmail: jest.fn().mockResolvedValue(found.byEmail ?? null),
      findByDisplayName: jest.fn().mockResolvedValue(found.byName ?? null),
      create: jest.fn().mockResolvedValue(found.created ?? 'QB-NEW'),
    },
    links: { saveCustomerId: jest.fn().mockResolvedValue(undefined) },
  };
  return deps as typeof deps & ClientsQuickBooksDeps;
}

const request = {
  clientId: 'client-1',
  firstName: 'Jane',
  lastName: 'Client',
  email: 'jane@example.com',
};

describe('linkClientToQuickBooksCustomer', () => {
  it('trusts a stored id that still exists and does not re-save it', async () => {
    const deps = fakeDeps({ byId: 'QB-1' });

    const result = await linkClientToQuickBooksCustomer(deps, {
      ...request,
      existingQboCustomerId: 'QB-1',
    });

    expect(result).toEqual({
      qboCustomerId: 'QB-1',
      alreadyExisted: true,
      linkedBy: 'stored_id',
      staleStoredId: null,
    });
    expect(deps.links.saveCustomerId).not.toHaveBeenCalled();
    expect(deps.directory.findByEmail).not.toHaveBeenCalled();
  });

  it('reports a stale stored id when it relinks by display name', async () => {
    const deps = fakeDeps({ byName: 'QB-NAME' });

    const result = await linkClientToQuickBooksCustomer(deps, {
      ...request,
      existingQboCustomerId: 'QB-GONE',
    });

    expect(deps.directory.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(deps.directory.findByDisplayName).toHaveBeenCalledWith(
      'Jane Client'
    );
    expect(deps.links.saveCustomerId).toHaveBeenCalledWith(
      'client-1',
      'QB-NAME'
    );
    expect(result).toMatchObject({
      linkedBy: 'display_name',
      staleStoredId: 'QB-GONE',
    });
  });

  it('creates and saves a new customer when no lookup matches', async () => {
    const deps = fakeDeps({ created: 'QB-CREATED' });

    const result = await linkClientToQuickBooksCustomer(deps, request);

    expect(deps.directory.create).toHaveBeenCalledWith({
      GivenName: 'Jane',
      FamilyName: 'Client',
      DisplayName: 'Jane Client',
      PrimaryEmailAddr: { Address: 'jane@example.com' },
    });
    expect(deps.links.saveCustomerId).toHaveBeenCalledWith(
      'client-1',
      'QB-CREATED'
    );
    expect(result).toMatchObject({
      alreadyExisted: false,
      linkedBy: 'created',
    });
  });

  it('rejects a client with no name or email before any lookup by name', async () => {
    const deps = fakeDeps({});

    await expect(
      linkClientToQuickBooksCustomer(deps, {
        clientId: 'client-1',
        firstName: '',
        lastName: '',
        email: '',
      })
    ).rejects.toBeInstanceOf(MissingQuickBooksCustomerIdentityError);
    expect(deps.directory.findByDisplayName).not.toHaveBeenCalled();
    expect(deps.directory.create).not.toHaveBeenCalled();
  });
});
