/**
 * Tests that client profile update drops unknown payload keys (whitelist guardrail)
 * so schema cache / missing column errors never break updates.
 */

import { SupabaseClientRepository } from '../repositories/supabaseClientRepository';

const mockUpdate = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockSingle = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
}));

const mockSupabaseClient = {
  from: mockFrom,
} as unknown as import('@supabase/supabase-js').SupabaseClient;

describe('SupabaseClientRepository.updateClient whitelist', () => {
  let repo: SupabaseClientRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SupabaseClientRepository(mockSupabaseClient);

    mockSelect.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: { id: 'client-1', first_name: 'Jane', last_name: 'Doe' },
        error: null,
      }),
    });
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'client_info') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'client-1', first_name: 'Jane', last_name: 'Doe', phone_number: null },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      return { select: mockSelect, update: mockUpdate, eq: mockEq, single: mockSingle };
    });

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'client-1',
          first_name: 'Jane',
          last_name: 'Doe',
          user_id: null,
          users: null,
        },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);
  });

  it('drops unknown keys from payload and does not send them to Supabase', async () => {
    const updateSpy = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) });
    mockFrom.mockImplementation((table: string) => {
      const base = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'client-1', first_name: 'Jane', last_name: 'Doe', phone_number: null },
          error: null,
        }),
        single: jest.fn().mockResolvedValue({
          data: { id: 'client-1', first_name: 'Updated', last_name: 'Doe', user_id: null, users: null },
          error: null,
        }),
      };
      if (table === 'client_info') {
        return {
          ...base,
          update: updateSpy.mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return base;
    });

    await repo.updateClient('client-1', {
      first_name: 'Updated',
      unknown_field_xyz: 'should-be-dropped',
      another_unknown: 123,
    } as any);

    expect(updateSpy).toHaveBeenCalled();
    const payload = updateSpy.mock.calls[0][0];
    expect(payload).toHaveProperty('first_name', 'Updated');
    expect(payload).not.toHaveProperty('unknown_field_xyz');
    expect(payload).not.toHaveProperty('another_unknown');
  });

  it('succeeds when only known keys are sent', async () => {
    const updateSpy = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) });
    mockFrom.mockImplementation((table: string) => {
      const base = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'client-1', first_name: 'Jane', last_name: 'Doe', phone_number: null },
          error: null,
        }),
        single: jest.fn().mockResolvedValue({
          data: { id: 'client-1', first_name: 'Jane', last_name: 'Doe', city: 'NYC', user_id: null, users: null },
          error: null,
        }),
      };
      if (table === 'client_info') {
        return {
          ...base,
          update: updateSpy.mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return base;
    });

    await repo.updateClient('client-1', { city: 'NYC' } as any);

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ city: 'NYC' }));
  });
});
