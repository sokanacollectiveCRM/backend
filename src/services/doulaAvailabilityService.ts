import { ConflictError, NotFoundError, ValidationError } from '../domains/errors';
import { getPool } from '../db/cloudSqlPool';

export type DoulaAvailabilityStatus = 'available' | 'unavailable';

export interface DoulaAvailabilityRecord {
  id: string;
  doulaId: string;
  startAt: string;
  endAt: string;
  availabilityStatus: DoulaAvailabilityStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoulaAvailabilitySummary {
  status: 'available' | 'unavailable';
  reason: string | null;
  startAt: string | null;
  endAt: string | null;
}

interface DoulaAvailabilityRow {
  id: string;
  doula_id: string;
  start_at: Date | string;
  end_at: Date | string;
  availability_status: DoulaAvailabilityStatus;
  reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseStatus(value: unknown): DoulaAvailabilityStatus {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'available' || normalized === 'unavailable') {
    return normalized;
  }
  throw new ValidationError('availabilityStatus must be either "available" or "unavailable"');
}

function parseDateTime(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required and must be an ISO datetime string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO datetime string`);
  }
  return date;
}

function validateRange(startAt: Date, endAt: Date): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ValidationError('startAt and endAt must be valid ISO datetime strings');
  }
  if (startAt >= endAt) {
    throw new ValidationError('startAt must be earlier than endAt');
  }
}

function mapAvailabilityRow(row: DoulaAvailabilityRow): DoulaAvailabilityRecord {
  return {
    id: row.id,
    doulaId: row.doula_id,
    startAt: toIso(row.start_at) ?? new Date(0).toISOString(),
    endAt: toIso(row.end_at) ?? new Date(0).toISOString(),
    availabilityStatus: row.availability_status,
    reason: row.reason,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes(relationName.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('relation'))
  );
}

export class DoulaAvailabilityService {
  async listAvailabilityByDoulaId(doulaId: string): Promise<DoulaAvailabilityRecord[]> {
    try {
      const { rows } = await getPool().query<DoulaAvailabilityRow>(
        `
        SELECT id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE doula_id = $1::uuid
        ORDER BY start_at DESC, created_at DESC
        `,
        [doulaId]
      );
      return rows.map(mapAvailabilityRow);
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) {
        return [];
      }
      throw error;
    }
  }

  async createAvailability(input: {
    doulaId: string;
    startAt: unknown;
    endAt: unknown;
    availabilityStatus: unknown;
    reason?: unknown;
  }): Promise<DoulaAvailabilityRecord> {
    const startAt = parseDateTime(input.startAt, 'startAt');
    const endAt = parseDateTime(input.endAt, 'endAt');
    validateRange(startAt, endAt);
    const availabilityStatus = parseStatus(input.availabilityStatus);
    const reason = normalizeReason(input.reason);

    const { rows } = await getPool().query<DoulaAvailabilityRow>(
      `
      INSERT INTO public.doula_availability (
        doula_id,
        start_at,
        end_at,
        availability_status,
        reason
      )
      VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, $4, $5)
      RETURNING id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
      `,
      [input.doulaId, startAt.toISOString(), endAt.toISOString(), availabilityStatus, reason]
    );

    return mapAvailabilityRow(rows[0]);
  }

  async updateAvailability(input: {
    availabilityId: string;
    doulaId: string;
    startAt?: unknown;
    endAt?: unknown;
    availabilityStatus?: unknown;
    reason?: unknown;
  }): Promise<DoulaAvailabilityRecord> {
    const existing = await this.getAvailabilityById(input.availabilityId, input.doulaId);
    if (!existing) {
      throw new NotFoundError('Availability record not found');
    }

    const startAt = input.startAt === undefined ? new Date(existing.startAt) : parseDateTime(input.startAt, 'startAt');
    const endAt = input.endAt === undefined ? new Date(existing.endAt) : parseDateTime(input.endAt, 'endAt');
    validateRange(startAt, endAt);

    const availabilityStatus =
      input.availabilityStatus === undefined
        ? existing.availabilityStatus
        : parseStatus(input.availabilityStatus);
    const reason = input.reason === undefined ? existing.reason : normalizeReason(input.reason);

    const { rows } = await getPool().query<DoulaAvailabilityRow>(
      `
      UPDATE public.doula_availability
      SET start_at = $1::timestamptz,
          end_at = $2::timestamptz,
          availability_status = $3,
          reason = $4,
          updated_at = NOW()
      WHERE id = $5::uuid
        AND doula_id = $6::uuid
      RETURNING id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
      `,
      [startAt.toISOString(), endAt.toISOString(), availabilityStatus, reason, input.availabilityId, input.doulaId]
    );

    if (!rows[0]) {
      throw new NotFoundError('Availability record not found');
    }

    return mapAvailabilityRow(rows[0]);
  }

  async deleteAvailability(availabilityId: string, doulaId: string): Promise<boolean> {
    try {
      const result = await getPool().query(
        `
        DELETE FROM public.doula_availability
        WHERE id = $1::uuid
          AND doula_id = $2::uuid
        `,
        [availabilityId, doulaId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) {
        return false;
      }
      throw error;
    }
  }

  async getAvailabilityById(
    availabilityId: string,
    doulaId: string
  ): Promise<DoulaAvailabilityRecord | null> {
    try {
      const { rows } = await getPool().query<DoulaAvailabilityRow>(
        `
        SELECT id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE id = $1::uuid
          AND doula_id = $2::uuid
        LIMIT 1
        `,
        [availabilityId, doulaId]
      );
      return rows[0] ? mapAvailabilityRow(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) {
        return null;
      }
      throw error;
    }
  }

  async getAvailabilityStatusForDoulas(
    doulaIds: string[],
    at: Date = new Date()
  ): Promise<Map<string, DoulaAvailabilitySummary>> {
    const summaries = new Map<string, DoulaAvailabilitySummary>();
    for (const doulaId of doulaIds) {
      summaries.set(doulaId, {
        status: 'available',
        reason: null,
        startAt: null,
        endAt: null,
      });
    }

    if (!doulaIds.length) return summaries;

    try {
      const { rows } = await getPool().query<DoulaAvailabilityRow>(
        `
        SELECT DISTINCT ON (doula_id)
          id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE doula_id = ANY($1::uuid[])
          AND availability_status = 'unavailable'
          AND start_at <= $2::timestamptz
          AND end_at > $2::timestamptz
        ORDER BY doula_id, start_at ASC, created_at ASC
        `,
        [doulaIds, at.toISOString()]
      );

      for (const row of rows) {
        summaries.set(row.doula_id, {
          status: 'unavailable',
          reason: row.reason,
          startAt: toIso(row.start_at),
          endAt: toIso(row.end_at),
        });
      }

      return summaries;
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) {
        return summaries;
      }
      throw error;
    }
  }

  async getCurrentAvailabilityStatus(doulaId: string, at: Date = new Date()): Promise<DoulaAvailabilitySummary> {
    const map = await this.getAvailabilityStatusForDoulas([doulaId], at);
    return map.get(doulaId) ?? {
      status: 'available',
      reason: null,
      startAt: null,
      endAt: null,
    };
  }

  async assertDoulaAvailableForPeriod(doulaId: string, startAt: Date, endAt: Date): Promise<void> {
    validateRange(startAt, endAt);

    try {
      const { rows } = await getPool().query<DoulaAvailabilityRow>(
        `
        SELECT id, doula_id, start_at, end_at, availability_status, reason, created_at, updated_at
        FROM public.doula_availability
        WHERE doula_id = $1::uuid
          AND availability_status = 'unavailable'
          AND start_at < $3::timestamptz
          AND end_at > $2::timestamptz
        ORDER BY start_at ASC
        LIMIT 1
        `,
        [doulaId, startAt.toISOString(), endAt.toISOString()]
      );

      const overlap = rows[0];
      if (!overlap) return;

      const reason = overlap.reason ? ` (${overlap.reason})` : '';
      throw new ConflictError(
        `Doula is unavailable for the requested time${reason}. Unavailable from ${toIso(overlap.start_at)} to ${toIso(overlap.end_at)}.`
      );
    } catch (error) {
      if (isMissingRelationError(error, 'doula_availability')) {
        return;
      }
      throw error;
    }
  }

  async isClientInContractStage(clientId: string): Promise<boolean> {
    try {
      const { rows } = await getPool().query<{ id: string }>(
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
      if (isMissingRelationError(error, 'phi_contracts')) {
        return false;
      }
      throw error;
    }
  }

  async createBookingRequest(input: {
    clientId: string;
    doulaId: string;
    requestedBy: string | null;
    startAt: unknown;
    endAt: unknown;
    notes?: unknown;
  }): Promise<{
    id: string;
    clientId: string;
    doulaId: string;
    startAt: string;
    endAt: string;
    status: string;
    notes: string | null;
    requestedBy: string | null;
    createdAt: string;
  }> {
    const startAt = parseDateTime(input.startAt, 'startAt');
    const endAt = parseDateTime(input.endAt, 'endAt');
    validateRange(startAt, endAt);

    await this.assertDoulaAvailableForPeriod(input.doulaId, startAt, endAt);

    const { rows } = await getPool().query<{
      id: string;
      client_id: string;
      doula_id: string;
      start_at: Date | string;
      end_at: Date | string;
      status: string;
      notes: string | null;
      requested_by: string | null;
      created_at: Date | string;
    }>(
      `
      INSERT INTO public.doula_booking_requests (
        client_id,
        doula_id,
        requested_by,
        start_at,
        end_at,
        notes,
        status
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5::timestamptz, $6, 'pending')
      RETURNING id, client_id, doula_id, start_at, end_at, status, notes, requested_by, created_at
      `,
      [
        input.clientId,
        input.doulaId,
        input.requestedBy,
        startAt.toISOString(),
        endAt.toISOString(),
        normalizeReason(input.notes),
      ]
    );

    const row = rows[0];
    return {
      id: row.id,
      clientId: row.client_id,
      doulaId: row.doula_id,
      startAt: toIso(row.start_at) ?? new Date(0).toISOString(),
      endAt: toIso(row.end_at) ?? new Date(0).toISOString(),
      status: row.status,
      notes: row.notes,
      requestedBy: row.requested_by,
      createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    };
  }
}

export const doulaAvailabilityTestUtils = {
  parseDateTime,
  validateRange,
  isMissingRelationError,
};
