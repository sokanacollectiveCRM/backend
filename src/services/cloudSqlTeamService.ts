import { getPool } from '../db/cloudSqlPool';
import { getSupabaseAdmin } from '../supabase';
import crypto from 'crypto';

export interface TeamMemberDto {
  id: string;
  firstname: string;
  lastname: string;
  fullName: string;
  email: string;
  role: 'admin' | 'doula';
  account_status: 'approved';
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

type TeamRole = 'admin' | 'doula';

interface DoulaRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AdminRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function splitFullName(fullName: string): { firstname: string; lastname: string } {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstname: '', lastname: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstname: parts[0] || '',
    lastname: parts.slice(1).join(' '),
  };
}

function mapRow(row: DoulaRow): TeamMemberDto {
  const { firstname, lastname } = splitFullName(row.full_name);
  return {
    id: row.id,
    firstname,
    lastname,
    fullName: row.full_name,
    email: row.email ?? '',
    role: 'doula',
    account_status: 'approved',
    phone_number: row.phone ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function mapAdminRow(row: AdminRow): TeamMemberDto {
  const { firstname, lastname } = splitFullName(row.full_name);
  return {
    id: row.id,
    firstname,
    lastname,
    fullName: row.full_name,
    email: row.email ?? '',
    role: 'admin',
    account_status: 'approved',
    phone_number: row.phone ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export class CloudSqlTeamService {
  async listTeamMembers(): Promise<TeamMemberDto[]> {
    const pool = getPool();
    try {
      const { rows } = await pool.query<{
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        role: 'admin' | 'doula';
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `
        SELECT id, full_name, email, phone, 'doula'::text AS role, created_at, updated_at
        FROM public.doulas
        UNION ALL
        SELECT id, full_name, email, phone, 'admin'::text AS role, created_at, updated_at
        FROM public.admins
        ORDER BY full_name ASC
        `
      );
      return rows.map((r) => r.role === 'admin' ? mapAdminRow(r) : mapRow(r));
    } catch (error) {
      // Backward compatibility: if admins table doesn't exist yet, return doulas only.
      const msg = (error as Error)?.message || '';
      if (msg.includes('public.admins') && msg.includes('does not exist')) {
        const { rows } = await pool.query<DoulaRow>(
          `
          SELECT id, full_name, email, phone, created_at, updated_at
          FROM public.doulas
          ORDER BY full_name ASC
          `
        );
        return rows.map(mapRow);
      }
      throw error;
    }
  }

  async listDoulas(): Promise<TeamMemberDto[]> {
    return this.listTeamMembers();
  }

  async getTeamMemberById(id: string): Promise<TeamMemberDto | null> {
    const pool = getPool();
    const { rows } = await pool.query<DoulaRow>(
      `
      SELECT id, full_name, email, phone, created_at, updated_at
      FROM public.doulas
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [id]
    );
    if (rows[0]) return mapRow(rows[0]);

    try {
      const { rows: adminRows } = await pool.query<AdminRow>(
        `
        SELECT id, full_name, email, phone, created_at, updated_at
        FROM public.admins
        WHERE id = $1::uuid
        LIMIT 1
        `,
        [id]
      );
      return adminRows[0] ? mapAdminRow(adminRows[0]) : null;
    } catch (error) {
      const msg = (error as Error)?.message || '';
      if (msg.includes('public.admins') && msg.includes('does not exist')) {
        return null;
      }
      throw error;
    }
  }

  async addDoula(input: {
    id?: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number?: string | null;
  }): Promise<TeamMemberDto> {
    const fullName = `${input.firstname} ${input.lastname}`.trim();
    const { rows } = await getPool().query<DoulaRow>(
      `
      INSERT INTO public.doulas (id, full_name, email, phone, created_at, updated_at)
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, NOW(), NOW())
      RETURNING id, full_name, email, phone, created_at, updated_at
      `,
      [input.id ?? null, fullName, input.email.toLowerCase().trim(), input.phone_number ?? null]
    );
    return mapRow(rows[0]);
  }

  async addAdmin(input: {
    id?: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number?: string | null;
  }): Promise<TeamMemberDto> {
    const fullName = `${input.firstname} ${input.lastname}`.trim();
    const { rows } = await getPool().query<AdminRow>(
      `
      INSERT INTO public.admins (id, full_name, email, phone, created_at, updated_at)
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, NOW(), NOW())
      RETURNING id, full_name, email, phone, created_at, updated_at
      `,
      [input.id ?? null, fullName, input.email.toLowerCase().trim(), input.phone_number ?? null]
    );
    return mapAdminRow(rows[0]);
  }

  async addTeamMember(input: {
    firstname: string;
    lastname: string;
    email: string;
    role: TeamRole;
    phone_number?: string | null;
  }): Promise<{ id: string; firstname: string; lastname: string; email: string; role: TeamRole; phone_number: string | null }> {
    const supabaseAdmin = getSupabaseAdmin();
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedRole = input.role;
    const tempPassword = crypto.randomBytes(18).toString('base64url');

    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: input.firstname.trim(),
        last_name: input.lastname.trim(),
        role: normalizedRole,
      },
      app_metadata: {
        role: normalizedRole,
      },
    });

    if (createAuthError || !createdAuth.user) {
      throw new Error(createAuthError?.message || 'Failed to create Supabase auth user');
    }

    const authUserId = createdAuth.user.id;
    try {
      if (normalizedRole === 'doula') {
        const doula = await this.addDoula({
          id: authUserId,
          firstname: input.firstname,
          lastname: input.lastname,
          email: normalizedEmail,
          phone_number: input.phone_number ?? null,
        });

        return {
          id: doula.id,
          firstname: doula.firstname,
          lastname: doula.lastname,
          email: doula.email,
          role: 'doula',
          phone_number: doula.phone_number ?? null,
        };
      }

      const admin = await this.addAdmin({
        id: authUserId,
        firstname: input.firstname,
        lastname: input.lastname,
        email: normalizedEmail,
        phone_number: input.phone_number ?? null,
      });
      return {
        id: admin.id,
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email,
        role: 'admin',
        phone_number: admin.phone_number ?? null,
      };
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw err;
    }
  }

  async updateTeamMember(
    id: string,
    input: {
      firstname?: string;
      lastname?: string;
      fullName?: string;
      email?: string;
      phone_number?: string | null;
      phone?: string | null;
    }
  ): Promise<TeamMemberDto | null> {
    const existing = await this.getTeamMemberById(id);
    if (!existing) return null;

    const fullName = input.fullName?.trim()
      || `${input.firstname ?? existing.firstname} ${input.lastname ?? existing.lastname}`.trim();
    const email = input.email?.trim().toLowerCase() || existing.email;
    const phone = input.phone ?? input.phone_number ?? existing.phone_number ?? null;

    if (existing.role === 'admin') {
      const { rows } = await getPool().query<AdminRow>(
        `
        UPDATE public.admins
        SET full_name = $1,
            email = $2,
            phone = $3,
            updated_at = NOW()
        WHERE id = $4::uuid
        RETURNING id, full_name, email, phone, created_at, updated_at
        `,
        [fullName, email, phone, id]
      );
      return rows[0] ? mapAdminRow(rows[0]) : null;
    }

    const { rows } = await getPool().query<DoulaRow>(
      `
      UPDATE public.doulas
      SET full_name = $1,
          email = $2,
          phone = $3,
          updated_at = NOW()
      WHERE id = $4::uuid
      RETURNING id, full_name, email, phone, created_at, updated_at
      `,
      [fullName, email, phone, id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `
      DELETE FROM public.doulas
      WHERE id = $1::uuid
      `,
      [id]
    );
    if ((result.rowCount ?? 0) > 0) return true;

    try {
      const adminResult = await pool.query(
        `
        DELETE FROM public.admins
        WHERE id = $1::uuid
        `,
        [id]
      );
      return (adminResult.rowCount ?? 0) > 0;
    } catch (error) {
      const msg = (error as Error)?.message || '';
      if (msg.includes('public.admins') && msg.includes('does not exist')) {
        return false;
      }
      throw error;
    }
  }
}

