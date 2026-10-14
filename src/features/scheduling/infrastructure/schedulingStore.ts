import type { Pool, PoolClient } from 'pg';

import { getPool } from '../../../db/cloudSqlPool';
import { NotFoundError } from '../../../domains/errors';
import type { RecipientLookup, SchedulingStore } from '../application/ports';
import { SchedulingConflictError } from '../application/schedulingService';
import { isFullyInsideAnyWindow } from '../domain/slotMath';
import type {
  AdminBookingRecord,
  AvailabilityRecord,
  BookingRecord,
  BookingStatus,
  TimeInterval,
} from '../domain/types';

interface BookingRow {
  id: string;
  client_id: string;
  doula_id: string;
  start_at: Date | string;
  end_at: Date | string;
  status: BookingStatus;
  notes: string | null;
  requested_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  doula_name?: string | null;
  client_number?: string | null;
  client_first_name?: string | null;
}

interface AvailabilityRow {
  id: string;
  doula_id: string;
  start_at: Date | string;
  end_at: Date | string;
  availability_status: 'available' | 'unavailable';
  reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString();
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes(relationName.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('relation'))
  );
}

function isMissingColumnError(error: unknown, column: string): boolean {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes(column.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('column'))
  );
}

function mapBooking(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    doulaId: row.doula_id,
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status,
    notes: row.notes,
    requestedBy: row.requested_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAdminBooking(row: BookingRow): AdminBookingRecord {
  return {
    ...mapBooking(row),
    doulaName: row.doula_name ?? null,
    clientNumber: row.client_number ?? null,
    clientFirstName: row.client_first_name ?? null,
  };
}

function mapAvailability(row: AvailabilityRow): AvailabilityRecord {
  return {
    id: row.id,
    doulaId: row.doula_id,
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    availabilityStatus: row.availability_status,
    reason: row.reason,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function appendRange(
  clauses: string[],
  params: unknown[],
  from?: Date,
  to?: Date
): void {
  if (from) {
    params.push(from.toISOString());
    clauses.push(`end_at > $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to.toISOString());
    clauses.push(`start_at < $${params.length}::timestamptz`);
  }
}

export class CloudSqlSchedulingStore implements SchedulingStore {
  constructor(private readonly pool: Pool = getPool()) {}

  async resolveClientId(input: {
    authUserId: string;
    email?: string | null;
  }): Promise<string | null> {
    const email = input.email?.trim().toLowerCase() || null;
    try {
      const { rows } = await this.pool.query<{ id: string }>(
        `
        SELECT id
        FROM public.phi_clients
        WHERE user_id::text = $1
           OR id::text = $1
           OR identity_platform_uid = $1
           OR ($2::text IS NOT NULL AND lower(email) = $2)
        LIMIT 1
        `,
        [input.authUserId, email]
      );
      return rows[0]?.id ?? null;
    } catch (error) {
      if (isMissingColumnError(error, 'identity_platform_uid')) {
        const { rows } = await this.pool.query<{ id: string }>(
          `
          SELECT id
          FROM public.phi_clients
          WHERE user_id::text = $1
             OR id::text = $1
             OR ($2::text IS NOT NULL AND lower(email) = $2)
          LIMIT 1
          `,
          [input.authUserId, email]
        );
        return rows[0]?.id ?? null;
      }
      if (isMissingRelationError(error, 'phi_clients')) return null;
      throw error;
    }
  }

  async assignmentIsActive(
    clientId: string,
    doulaId: string
  ): Promise<boolean> {
    try {
      const { rowCount } = await this.pool.query(
        `
        SELECT 1
        FROM public.doula_assignments
        WHERE client_id = $1::uuid
          AND doula_id = $2::uuid
          AND status = 'active'
        LIMIT 1
        `,
        [clientId, doulaId]
      );
      return (rowCount ?? 0) > 0;
    } catch (error) {
      if (isMissingRelationError(error, 'doula_assignments')) return false;
      throw error;
    }
  }

  async isClientInContractStage(clientId: string): Promise<boolean> {
    try {
      const { rows } = await this.pool.query<{ id: string }>(
        `
        SELECT id
        FROM public.phi_contracts
        WHERE client_id = $1::uuid
        ORDER BY inserted_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
        `,
        [clientId]
      );
      return rows.length > 0;
    } catch (error) {
      if (isMissingRelationError(error, 'phi_contracts')) return false;
      if (isMissingColumnError(error, 'inserted_at')) {
        const { rows } = await this.pool.query<{ id: string }>(
          `
          SELECT id
          FROM public.phi_contracts
          WHERE client_id = $1::uuid
          LIMIT 1
          `,
          [clientId]
        );
        return rows.length > 0;
      }
      throw error;
    }
  }

  async listAvailabilityIntervals(
    doulaId: string,
    status: 'available' | 'unavailable'
  ): Promise<TimeInterval[]> {
    try {
      const { rows } = await this.pool.query<AvailabilityRow>(
        `
        SELECT id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE doula_id = $1::uuid
          AND availability_status = $2
        ORDER BY start_at ASC
        `,
        [doulaId, status]
      );
      return rows.map((row) => ({
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
      }));
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) return [];
      throw error;
    }
  }

  async listActiveBookingIntervals(
    doulaId: string,
    excludeBookingId?: string
  ): Promise<TimeInterval[]> {
    try {
      const params: unknown[] = [doulaId];
      let excludeSql = '';
      if (excludeBookingId) {
        params.push(excludeBookingId);
        excludeSql = `AND id <> $${params.length}::uuid`;
      }
      const { rows } = await this.pool.query<BookingRow>(
        `
        SELECT id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        FROM public.doula_booking_requests
        WHERE doula_id = $1::uuid
          AND status IN ('pending', 'approved')
          ${excludeSql}
        `,
        params
      );
      return rows.map((row) => ({
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
      }));
    } catch (error) {
      if (isMissingRelationError(error, 'doula_booking_requests')) return [];
      throw error;
    }
  }

  async listAvailabilityByDoulaId(
    doulaId: string
  ): Promise<AvailabilityRecord[]> {
    try {
      const { rows } = await this.pool.query<AvailabilityRow>(
        `
        SELECT id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE doula_id = $1::uuid
        ORDER BY start_at DESC, created_at DESC
        `,
        [doulaId]
      );
      return rows.map(mapAvailability);
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) return [];
      throw error;
    }
  }

  async listClientBookings(clientId: string): Promise<BookingRecord[]> {
    try {
      const { rows } = await this.pool.query<BookingRow>(
        `
        SELECT id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        FROM public.doula_booking_requests
        WHERE client_id = $1::uuid
        ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, start_at ASC
        `,
        [clientId]
      );
      return rows.map(mapBooking);
    } catch (error) {
      if (isMissingRelationError(error, 'doula_booking_requests')) return [];
      throw error;
    }
  }

  async listDoulaBookings(
    doulaId: string,
    range?: { from?: Date; to?: Date }
  ): Promise<BookingRecord[]> {
    try {
      const clauses = ['doula_id = $1::uuid'];
      const params: unknown[] = [doulaId];
      appendRange(clauses, params, range?.from, range?.to);
      const { rows } = await this.pool.query<BookingRow>(
        `
        SELECT id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        FROM public.doula_booking_requests
        WHERE ${clauses.join(' AND ')}
        ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, start_at ASC
        `,
        params
      );
      return rows.map(mapBooking);
    } catch (error) {
      if (isMissingRelationError(error, 'doula_booking_requests')) return [];
      throw error;
    }
  }

  async listAdminBookings(filters: {
    doulaId?: string;
    clientId?: string;
    status?: BookingStatus;
    from?: Date;
    to?: Date;
  }): Promise<AdminBookingRecord[]> {
    try {
      const clauses: string[] = ['TRUE'];
      const params: unknown[] = [];
      if (filters.doulaId) {
        params.push(filters.doulaId);
        clauses.push(`b.doula_id = $${params.length}::uuid`);
      }
      if (filters.clientId) {
        params.push(filters.clientId);
        clauses.push(`b.client_id = $${params.length}::uuid`);
      }
      if (filters.status) {
        params.push(filters.status);
        clauses.push(`b.status = $${params.length}`);
      }
      if (filters.from) {
        params.push(filters.from.toISOString());
        clauses.push(`b.end_at > $${params.length}::timestamptz`);
      }
      if (filters.to) {
        params.push(filters.to.toISOString());
        clauses.push(`b.start_at < $${params.length}::timestamptz`);
      }
      const { rows } = await this.pool.query<BookingRow>(
        `
        SELECT
          b.id, b.client_id, b.doula_id, b.start_at, b.end_at, b.status,
          b.notes, b.requested_by, b.created_at, b.updated_at,
          d.full_name AS doula_name,
          c.client_number,
          c.first_name AS client_first_name
        FROM public.doula_booking_requests b
        LEFT JOIN public.doulas d ON d.id = b.doula_id
        LEFT JOIN public.phi_clients c ON c.id = b.client_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY CASE WHEN b.status = 'pending' THEN 0 ELSE 1 END, b.start_at ASC
        `,
        params
      );
      return rows.map(mapAdminBooking);
    } catch (error) {
      if (isMissingRelationError(error, 'doula_booking_requests')) return [];
      throw error;
    }
  }

  async getBookingById(bookingId: string): Promise<BookingRecord | null> {
    try {
      const { rows } = await this.pool.query<BookingRow>(
        `
        SELECT id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        FROM public.doula_booking_requests
        WHERE id = $1::uuid
        LIMIT 1
        `,
        [bookingId]
      );
      return rows[0] ? mapBooking(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error, 'doula_booking_requests')) return null;
      throw error;
    }
  }

  async createBookingInTransaction(input: {
    clientId: string;
    doulaId: string;
    requestedBy: string | null;
    startAt: Date;
    endAt: Date;
    notes: string | null;
  }): Promise<BookingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
        input.doulaId,
      ]);
      await this.assertBookable(client, {
        doulaId: input.doulaId,
        startAt: input.startAt,
        endAt: input.endAt,
      });
      const { rows } = await client.query<BookingRow>(
        `
        INSERT INTO public.doula_booking_requests (
          client_id, doula_id, requested_by, start_at, end_at, notes, status
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5::timestamptz, $6, 'pending')
        RETURNING id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        `,
        [
          input.clientId,
          input.doulaId,
          input.requestedBy,
          input.startAt.toISOString(),
          input.endAt.toISOString(),
          input.notes,
        ]
      );
      await client.query('COMMIT');
      return mapBooking(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBookingStatusInTransaction(input: {
    bookingId: string;
    nextStatus: BookingStatus;
    recheckOverlap: boolean;
  }): Promise<BookingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existingRows } = await client.query<BookingRow>(
        `
        SELECT id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        FROM public.doula_booking_requests
        WHERE id = $1::uuid
        FOR UPDATE
        `,
        [input.bookingId]
      );
      const existing = existingRows[0];
      if (!existing) {
        throw new NotFoundError('Booking request not found');
      }

      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
        existing.doula_id,
      ]);

      if (input.recheckOverlap) {
        await this.assertBookable(client, {
          doulaId: existing.doula_id,
          startAt: toDate(existing.start_at),
          endAt: toDate(existing.end_at),
          excludeBookingId: existing.id,
        });
      }

      const { rows } = await client.query<BookingRow>(
        `
        UPDATE public.doula_booking_requests
        SET status = $2, updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at, updated_at
        `,
        [input.bookingId, input.nextStatus]
      );
      await client.query('COMMIT');
      return mapBooking(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDoulaRecipient(doulaId: string): Promise<RecipientLookup | null> {
    try {
      const { rows } = await this.pool.query<{
        email: string | null;
        full_name: string | null;
      }>(
        `SELECT email, full_name FROM public.doulas WHERE id = $1::uuid LIMIT 1`,
        [doulaId]
      );
      if (!rows[0]) return null;
      return { email: rows[0].email, doulaName: rows[0].full_name };
    } catch (error) {
      if (isMissingRelationError(error, 'doulas')) return null;
      throw error;
    }
  }

  async getClientRecipient(clientId: string): Promise<RecipientLookup | null> {
    try {
      const { rows } = await this.pool.query<{
        email: string | null;
        client_number: string | null;
        first_name: string | null;
      }>(
        `
        SELECT email, client_number, first_name
        FROM public.phi_clients
        WHERE id = $1::uuid
        LIMIT 1
        `,
        [clientId]
      );
      if (!rows[0]) return null;
      return {
        email: rows[0].email,
        clientNumber: rows[0].client_number,
        clientFirstName: rows[0].first_name,
      };
    } catch (error) {
      if (isMissingRelationError(error, 'phi_clients')) return null;
      throw error;
    }
  }

  private async assertBookable(
    client: PoolClient,
    input: {
      doulaId: string;
      startAt: Date;
      endAt: Date;
      excludeBookingId?: string;
    }
  ): Promise<void> {
    const startIso = input.startAt.toISOString();
    const endIso = input.endAt.toISOString();

    const { rows: windows } = await client.query<{
      start_at: Date | string;
      end_at: Date | string;
    }>(
      `
      SELECT start_at, end_at
      FROM public.doula_availability
      WHERE doula_id = $1::uuid
        AND availability_status = 'available'
      `,
      [input.doulaId]
    );
    const inside = isFullyInsideAnyWindow(
      { startAt: input.startAt, endAt: input.endAt },
      windows.map((row) => ({
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
      }))
    );
    if (!inside) {
      throw new SchedulingConflictError(
        'Requested time is not inside an available window',
        'BOOKING_OUTSIDE_WINDOW'
      );
    }

    const { rows: blackouts } = await client.query<{
      start_at: Date | string;
      end_at: Date | string;
      reason: string | null;
    }>(
      `
      SELECT start_at, end_at, reason
      FROM public.doula_availability
      WHERE doula_id = $1::uuid
        AND availability_status = 'unavailable'
        AND start_at < $3::timestamptz
        AND end_at > $2::timestamptz
      ORDER BY start_at ASC
      LIMIT 1
      `,
      [input.doulaId, startIso, endIso]
    );
    if (blackouts[0]) {
      const reason = blackouts[0].reason ? ` (${blackouts[0].reason})` : '';
      throw new SchedulingConflictError(
        `Doula is unavailable for the requested time${reason}. Unavailable from ${toIso(blackouts[0].start_at)} to ${toIso(blackouts[0].end_at)}.`,
        'BOOKING_BLACKOUT'
      );
    }

    const params: unknown[] = [input.doulaId, startIso, endIso];
    let excludeSql = '';
    if (input.excludeBookingId) {
      params.push(input.excludeBookingId);
      excludeSql = `AND id <> $${params.length}::uuid`;
    }
    const { rows: overlaps } = await client.query<{ id: string }>(
      `
      SELECT id
      FROM public.doula_booking_requests
      WHERE doula_id = $1::uuid
        AND status IN ('pending', 'approved')
        AND start_at < $3::timestamptz
        AND end_at > $2::timestamptz
        ${excludeSql}
      LIMIT 1
      `,
      params
    );
    if (overlaps[0]) {
      throw new SchedulingConflictError(
        'This time overlaps another pending or approved visit',
        'BOOKING_OVERLAP'
      );
    }
  }
}

export const schedulingStoreTestUtils = {
  isMissingRelationError,
  isMissingColumnError,
};
