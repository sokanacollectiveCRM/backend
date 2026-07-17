import { getPool } from '../db/cloudSqlPool';
import {
  createPaymentScheduleInCloudSql,
  installmentDueDate,
} from '../services/cloudSqlPaymentScheduleService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

const contractId = '123e4567-e89b-12d3-a456-426614174000';

function setupDb(
  options: { existing?: string; failInstallment?: number } = {}
) {
  const inserted: Array<{ sql: string; params: unknown[] }> = [];
  let installment = 0;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    inserted.push({ sql, params });
    if (sql.includes('to_jsonb(pc)'))
      return {
        rows: [{ id: contractId, client_id: 'client-1', contract_json: {} }],
      };
    if (sql.includes("status IN ('draft', 'active')"))
      return { rows: options.existing ? [{ id: options.existing }] : [] };
    if (sql.includes('INSERT INTO public.payment_schedules'))
      return { rows: [{ id: 'schedule-1' }] };
    if (sql.includes('INSERT INTO public.payment_installments')) {
      installment += 1;
      if (installment === options.failInstallment)
        throw new Error('synthetic insert failure');
    }
    return { rows: [] };
  });
  const release = jest.fn();
  (getPool as jest.Mock).mockReturnValue({
    connect: jest.fn().mockResolvedValue({ query, release }),
  });
  return { inserted, query, release };
}

describe('Cloud SQL payment schedule service', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['weekly', 1, '2026-02-07'],
    ['biweekly', 1, '2026-02-14'],
    ['monthly', 1, '2026-02-28'],
    ['monthly', 2, '2026-03-31'],
  ] as const)(
    'calculates %s dates deterministically',
    (frequency, offset, expected) => {
      expect(installmentDueDate('2026-01-31', frequency, offset)).toBe(
        expected
      );
    }
  );

  it('creates deposit and installments atomically with exact cent reconciliation', async () => {
    const db = setupDb();
    await expect(
      createPaymentScheduleInCloudSql({
        contractId,
        scheduleName: 'Synthetic plan',
        totalAmount: '100.00',
        depositAmount: '10.00',
        numberOfInstallments: 3,
        paymentFrequency: 'monthly',
        startDate: '2026-01-31',
      })
    ).resolves.toBe('schedule-1');
    const rows = db.inserted.filter(({ sql }) =>
      sql.includes('INSERT INTO public.payment_installments')
    );
    expect(rows).toHaveLength(4);
    expect(rows.map(({ params }) => params[1])).toEqual([
      '10.00',
      '30.00',
      '30.00',
      '30.00',
    ]);
    expect(db.query).toHaveBeenCalledWith('COMMIT');
    expect(db.release).toHaveBeenCalled();
  });

  it('puts a rounding remainder in a final row so amounts sum exactly', async () => {
    const db = setupDb();
    await createPaymentScheduleInCloudSql({
      contractId,
      scheduleName: 'Synthetic plan',
      totalAmount: '100.00',
      numberOfInstallments: 3,
      paymentFrequency: 'weekly',
      startDate: '2026-01-01',
    });
    const rows = db.inserted.filter(({ sql }) =>
      sql.includes('INSERT INTO public.payment_installments')
    );
    expect(rows.map(({ params }) => params[1])).toEqual([
      '33.33',
      '33.33',
      '33.34',
    ]);
    expect(rows[2].params[3]).toBe('final');
  });

  it('returns an existing active schedule for a retry', async () => {
    const db = setupDb({ existing: 'existing-1' });
    await expect(
      createPaymentScheduleInCloudSql({
        contractId,
        scheduleName: 'Synthetic plan',
        totalAmount: 100,
        numberOfInstallments: 2,
        startDate: '2026-01-01',
      })
    ).resolves.toBe('existing-1');
    expect(
      db.inserted.some(({ sql }) =>
        sql.includes('INSERT INTO public.payment_schedules')
      )
    ).toBe(false);
  });

  it('rolls back both schedule and installments on partial failure', async () => {
    const db = setupDb({ failInstallment: 2 });
    await expect(
      createPaymentScheduleInCloudSql({
        contractId,
        scheduleName: 'Synthetic plan',
        totalAmount: 100,
        numberOfInstallments: 3,
        startDate: '2026-01-01',
      })
    ).rejects.toThrow('synthetic insert failure');
    expect(db.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it.each([
    [{ totalAmount: -1, numberOfInstallments: 1 }, 'non-negative'],
    [{ totalAmount: 100, numberOfInstallments: 0 }, 'positive integer'],
    [{ totalAmount: '10.001', numberOfInstallments: 1 }, 'at most two decimal'],
  ])('rejects invalid input', async (override, message) => {
    await expect(
      createPaymentScheduleInCloudSql({
        contractId,
        scheduleName: 'Synthetic',
        startDate: '2026-01-01',
        ...override,
      } as any)
    ).rejects.toThrow(message);
    expect(getPool).not.toHaveBeenCalled();
  });
});
