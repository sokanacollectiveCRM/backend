import { getPool } from '../db/cloudSqlPool';

export type DoulaAssignmentRole = 'primary' | 'backup';

function normalizeDoulaAssignmentRole(raw: unknown): DoulaAssignmentRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'primary' || normalized === 'backup') {
    return normalized;
  }
  return null;
}

export interface DoulaListQuery {
  q?: string;
  includeCounts: boolean;
  limit: number;
  offset: number;
}

export interface DoulaAssignmentsQuery {
  q?: string;
  doulaId?: string;
  hospital?: string;
  dateFrom?: string;
  dateTo?: string;
  sort: 'updated_at_desc' | 'assigned_at_desc';
  limit: number;
  offset: number;
  clientId?: string;
}

export interface DoulaRowDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  assignmentsCount: number | null;
  updatedAt: string;
}

export interface DoulaAssignmentRowDto {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  doulaId: string;
  doulaFullName: string;
  doulaEmail: string | null;
  hospital: string | null;
  assignedAt: string | null;
  role: DoulaAssignmentRole | null;
  sourceTimestamp: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface UpdateDoulaAssignmentInput {
  hospital?: string | null;
  notes?: string | null;
  assignedAt?: string | null;
  role?: DoulaAssignmentRole | null;
  sourceTimestamp?: string | null;
}

interface CountRow {
  count: string | number;
}

interface DoulaDbRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  assignments_count: number | string | null;
  updated_at: Date | string;
}

interface DoulaAssignmentDbRow {
  client_id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string | null;
  client_phone: string | null;
  doula_id: string;
  doula_full_name: string;
  doula_email: string | null;
  hospital: string | null;
  assigned_at: Date | string | null;
  role: string | null;
  source_timestamp: Date | string | null;
  notes: string | null;
  updated_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function mapAssignmentRow(row: DoulaAssignmentDbRow): DoulaAssignmentRowDto {
  const normalizedRole = normalizeDoulaAssignmentRole(row.role);
  return {
    clientId: row.client_id,
    clientFirstName: row.client_first_name,
    clientLastName: row.client_last_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    doulaId: row.doula_id,
    doulaFullName: row.doula_full_name,
    doulaEmail: row.doula_email,
    hospital: row.hospital,
    assignedAt: toIso(row.assigned_at),
    role: normalizedRole,
    sourceTimestamp: toText(row.source_timestamp),
    notes: row.notes,
    updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function buildDoulasWhere(q?: string): { whereClause: string; values: string[] } {
  const where: string[] = [];
  const values: string[] = [];

  if (q) {
    values.push(q);
    const idx = values.length;
    where.push(`(d.full_name ILIKE '%' || $${idx} || '%' OR d.email ILIKE '%' || $${idx} || '%')`);
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

function buildAssignmentsWhere(filters: DoulaAssignmentsQuery): { whereClause: string; values: string[] } {
  const where: string[] = [];
  const values: string[] = [];

  if (filters.clientId) {
    values.push(filters.clientId);
    where.push(`da.client_id = $${values.length}::uuid`);
  }

  if (filters.doulaId) {
    values.push(filters.doulaId);
    where.push(`da.doula_id = $${values.length}::uuid`);
  }

  if (filters.hospital) {
    values.push(filters.hospital);
    where.push(`da.hospital ILIKE '%' || $${values.length} || '%'`);
  }

  if (filters.q) {
    values.push(filters.q);
    const qIndex = values.length;
    where.push(`
      (
        (pc.first_name || ' ' || pc.last_name) ILIKE '%' || $${qIndex} || '%'
        OR pc.email ILIKE '%' || $${qIndex} || '%'
        OR d.full_name ILIKE '%' || $${qIndex} || '%'
        OR d.email ILIKE '%' || $${qIndex} || '%'
        OR regexp_replace(coalesce(pc.phone, ''), '[^0-9]', '', 'g')
           ILIKE '%' || regexp_replace($${qIndex}, '[^0-9]', '', 'g') || '%'
      )
    `);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    where.push(`(da.assigned_at IS NOT NULL AND da.assigned_at >= $${values.length}::date)`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    where.push(`(da.assigned_at IS NOT NULL AND da.assigned_at < ($${values.length}::date + interval '1 day'))`);
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

export class DoulasService {
  async listDoulas(query: DoulaListQuery): Promise<{ data: DoulaRowDto[]; count: number }> {
    const pool = getPool();
    const { whereClause, values } = buildDoulasWhere(query.q);

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM public.doulas d
      ${whereClause}
    `;
    const countRes = await pool.query<CountRow>(countSql, values);
    const count = toNumber(countRes.rows[0]?.count);

    const paginationValues = [...values, query.limit, query.offset];
    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;

    const dataSql = query.includeCounts
      ? `
        SELECT
          d.id,
          d.full_name,
          d.email,
          d.phone,
          COUNT(da.*)::int AS assignments_count,
          d.updated_at
        FROM public.doulas d
        LEFT JOIN public.doula_assignments da ON da.doula_id = d.id
        ${whereClause}
        GROUP BY d.id, d.full_name, d.email, d.phone, d.updated_at
        ORDER BY d.full_name ASC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
      `
      : `
        SELECT
          d.id,
          d.full_name,
          d.email,
          d.phone,
          NULL::int AS assignments_count,
          d.updated_at
        FROM public.doulas d
        ${whereClause}
        ORDER BY d.full_name ASC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
      `;

    const dataRes = await pool.query<DoulaDbRow>(dataSql, paginationValues);
    const data: DoulaRowDto[] = dataRes.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      assignmentsCount: query.includeCounts ? toNumber(row.assignments_count) : null,
      updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
    }));

    return { data, count };
  }

  async listDoulaAssignments(query: DoulaAssignmentsQuery): Promise<{ data: DoulaAssignmentRowDto[]; count: number }> {
    const pool = getPool();
    const { whereClause, values } = buildAssignmentsWhere(query);
    const sortClause =
      query.sort === 'assigned_at_desc'
        ? 'ORDER BY da.assigned_at DESC NULLS LAST, da.updated_at DESC'
        : 'ORDER BY da.updated_at DESC';

    const fromSql = `
      FROM public.doula_assignments da
      JOIN public.doulas d ON d.id = da.doula_id
      JOIN public.phi_clients pc ON pc.id = da.client_id
      ${whereClause}
    `;

    const countSql = `SELECT COUNT(*)::int AS count ${fromSql}`;
    const countRes = await pool.query<CountRow>(countSql, values);
    const count = toNumber(countRes.rows[0]?.count);

    const limitIdx = values.length + 1;
    const offsetIdx = values.length + 2;
    const dataSql = `
      SELECT
        da.client_id,
        pc.first_name AS client_first_name,
        pc.last_name AS client_last_name,
        pc.email AS client_email,
        pc.phone AS client_phone,
        da.doula_id,
        d.full_name AS doula_full_name,
        d.email AS doula_email,
        da.hospital,
        da.assigned_at,
        da.role,
        da.source_timestamp,
        da.notes,
        da.updated_at
      ${fromSql}
      ${sortClause}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `;
    const dataRes = await pool.query<DoulaAssignmentDbRow>(dataSql, [...values, query.limit, query.offset]);

    const data: DoulaAssignmentRowDto[] = dataRes.rows.map(mapAssignmentRow);

    return { data, count };
  }

  async getDoulaAssignment(clientId: string, doulaId: string): Promise<DoulaAssignmentRowDto | null> {
    const pool = getPool();
    const { rows } = await pool.query<DoulaAssignmentDbRow>(
      `
      SELECT
        da.client_id,
        pc.first_name AS client_first_name,
        pc.last_name AS client_last_name,
        pc.email AS client_email,
        pc.phone AS client_phone,
        da.doula_id,
        d.full_name AS doula_full_name,
        d.email AS doula_email,
        da.hospital,
        da.assigned_at,
        da.role,
        da.source_timestamp,
        da.notes,
        da.updated_at
      FROM public.doula_assignments da
      JOIN public.doulas d ON d.id = da.doula_id
      JOIN public.phi_clients pc ON pc.id = da.client_id
      WHERE da.client_id = $1::uuid AND da.doula_id = $2::uuid
      LIMIT 1
      `,
      [clientId, doulaId]
    );

    return rows[0] ? mapAssignmentRow(rows[0]) : null;
  }

  async updateDoulaAssignment(
    clientId: string,
    doulaId: string,
    input: UpdateDoulaAssignmentInput
  ): Promise<DoulaAssignmentRowDto | null> {
    const setClauses: string[] = [];
    const values: Array<string | null> = [];

    if (input.hospital !== undefined) {
      values.push(input.hospital ?? null);
      setClauses.push(`hospital = $${values.length}`);
    }

    if (input.notes !== undefined) {
      values.push(input.notes ?? null);
      setClauses.push(`notes = $${values.length}`);
    }

    if (input.assignedAt !== undefined) {
      values.push(input.assignedAt ?? null);
      setClauses.push(`assigned_at = $${values.length}::timestamp`);
    }

    if (input.role !== undefined) {
      values.push(input.role ?? null);
      setClauses.push(`role = $${values.length}`);
    }

    if (input.sourceTimestamp !== undefined) {
      values.push(input.sourceTimestamp ?? null);
      setClauses.push(`source_timestamp = $${values.length}`);
    }

    if (!setClauses.length) {
      return this.getDoulaAssignment(clientId, doulaId);
    }

    setClauses.push('updated_at = NOW()');
    values.push(clientId, doulaId);
    const clientParamIdx = values.length - 1;
    const doulaParamIdx = values.length;

    const pool = getPool();
    const { rows } = await pool.query<DoulaAssignmentDbRow>(
      `
      UPDATE public.doula_assignments
      SET ${setClauses.join(', ')}
      WHERE client_id = $${clientParamIdx}::uuid
        AND doula_id = $${doulaParamIdx}::uuid
      RETURNING
        client_id,
        (SELECT first_name FROM public.phi_clients WHERE id = client_id) AS client_first_name,
        (SELECT last_name FROM public.phi_clients WHERE id = client_id) AS client_last_name,
        (SELECT email FROM public.phi_clients WHERE id = client_id) AS client_email,
        (SELECT phone FROM public.phi_clients WHERE id = client_id) AS client_phone,
        doula_id,
        (SELECT full_name FROM public.doulas WHERE id = doula_id) AS doula_full_name,
        (SELECT email FROM public.doulas WHERE id = doula_id) AS doula_email,
        hospital,
        assigned_at,
        role,
        source_timestamp,
        notes,
        updated_at
      `,
      values
    );

    return rows[0] ? mapAssignmentRow(rows[0]) : null;
  }
}

