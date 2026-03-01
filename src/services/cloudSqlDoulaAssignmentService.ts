import { getPool } from '../db/cloudSqlPool';

export type DoulaAssignmentRole = 'primary' | 'backup';

export function normalizeDoulaAssignmentRole(raw: unknown): DoulaAssignmentRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'primary' || normalized === 'backup') {
    return normalized;
  }
  return null;
}

export interface CloudSqlAssignmentResult {
  id: string;
  clientId: string;
  doulaId: string;
  assignedAt: Date | null;
  assignedBy?: string;
  notes?: string;
  role?: DoulaAssignmentRole | null;
  status: 'active';
  updatedAt: Date;
}

export interface CloudSqlDoulaRow {
  id: string;
  fullName: string;
  email: string | null;
}

export interface CloudSqlAssignedDoula {
  id: string;
  doulaId: string;
  assignedAt: Date | null;
  role?: DoulaAssignmentRole | null;
  status: 'active';
  doula: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number?: string;
  };
}

export class CloudSqlDoulaAssignmentService {
  async getClientIdByAuthUserId(authUserId: string): Promise<string | null> {
    const { rows } = await getPool().query<{ id: string }>(
      `
      SELECT id
      FROM public.phi_clients
      WHERE user_id = $1::uuid
      LIMIT 1
      `,
      [authUserId]
    );
    return rows[0]?.id ?? null;
  }

  async getDoulaById(doulaId: string): Promise<CloudSqlDoulaRow | null> {
    const { rows } = await getPool().query<{
      id: string;
      full_name: string;
      email: string | null;
    }>(
      `
      SELECT id, full_name, email
      FROM public.doulas
      WHERE id = $1::uuid
      `,
      [doulaId]
    );

    if (!rows[0]) return null;

    return {
      id: rows[0].id,
      fullName: rows[0].full_name,
      email: rows[0].email,
    };
  }

  async assignmentExists(clientId: string, doulaId: string): Promise<boolean> {
    const { rowCount } = await getPool().query(
      `
      SELECT 1
      FROM public.doula_assignments
      WHERE client_id = $1::uuid AND doula_id = $2::uuid
      LIMIT 1
      `,
      [clientId, doulaId]
    );
    return (rowCount ?? 0) > 0;
  }

  async assignDoula(
    clientId: string,
    doulaId: string,
    assignedBy?: string,
    notes?: string,
    role?: DoulaAssignmentRole
  ): Promise<CloudSqlAssignmentResult> {
    const { rows } = await getPool().query<{
      client_id: string;
      doula_id: string;
      assigned_at: Date | null;
      notes: string | null;
      role: string | null;
      updated_at: Date;
    }>(
      `
      INSERT INTO public.doula_assignments (client_id, doula_id, notes, role, assigned_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, NOW())
      RETURNING client_id, doula_id, assigned_at, notes, role, updated_at
      `,
      [clientId, doulaId, notes ?? null, role ?? null]
    );

    const row = rows[0];
    const normalizedRole = normalizeDoulaAssignmentRole(row.role);
    return {
      id: `${row.client_id}:${row.doula_id}`,
      clientId: row.client_id,
      doulaId: row.doula_id,
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
      assignedBy,
      notes: row.notes ?? undefined,
      role: normalizedRole,
      status: 'active',
      updatedAt: new Date(row.updated_at),
    };
  }

  async unassignDoula(clientId: string, doulaId: string): Promise<boolean> {
    const result = await getPool().query(
      `
      DELETE FROM public.doula_assignments
      WHERE client_id = $1::uuid
        AND doula_id = $2::uuid
      `,
      [clientId, doulaId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getAssignedDoulas(clientId: string): Promise<CloudSqlAssignedDoula[]> {
    const { rows } = await getPool().query<{
      client_id: string;
      doula_id: string;
      assigned_at: Date | null;
      role: string | null;
      doula_email: string | null;
      doula_phone: string | null;
      full_name: string | null;
    }>(
      `
      SELECT
        da.client_id,
        da.doula_id,
        da.assigned_at,
        da.role,
        d.email AS doula_email,
        d.phone AS doula_phone,
        d.full_name
      FROM public.doula_assignments da
      LEFT JOIN public.doulas d ON d.id = da.doula_id
      WHERE da.client_id = $1::uuid
      ORDER BY da.assigned_at DESC NULLS LAST
      `,
      [clientId]
    );

    return rows.map((row) => {
      const fullName = row.full_name || '';
      const [first = '', ...rest] = fullName.trim().split(/\s+/);
      const last = rest.join(' ');
      const normalizedRole = normalizeDoulaAssignmentRole(row.role);
      return {
        id: `${row.client_id}:${row.doula_id}`,
        doulaId: row.doula_id,
        assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
        role: normalizedRole,
        status: 'active',
        doula: {
          id: row.doula_id,
          firstname: first,
          lastname: last,
          email: row.doula_email || '',
          phone_number: row.doula_phone || undefined,
        },
      };
    });
  }
}

