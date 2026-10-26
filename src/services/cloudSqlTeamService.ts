import crypto from 'crypto';

import { getPool } from '../db/cloudSqlPool';
import { ConflictError } from '../domains/errors';
import {
  defaultAddressCountry,
  normalizePhone,
  normalizeUnitNumber,
} from '../features/doulas/domain/profile';
import {
  type Certification,
  serializeCertifications,
} from '../features/doulas/domain/profile';
import { readTenantRequestState } from '../features/tenancy/application/tenantRequestStore';
import { DoulaAvailabilityService } from './doulaAvailabilityService';
import {
  resolveProfilePictureFields,
  resolveProfilePictureUrl,
} from './gcs/profilePictureStorage';
import { getFirebaseAuth } from './identityPlatform/firebaseAdmin';

export interface TeamMemberDto {
  id: string;
  firstname: string;
  lastname: string;
  fullName: string;
  email: string;
  role: 'admin' | 'doula' | 'hr';
  account_status: string;
  phone_number: string | null;
  address: string | null;
  unit_number?: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  certifications?: Certification[] | null;
  profile_submitted_at?: string | null;
  profile_review_status?: string;
  profile_review_reason?: string | null;
  profile_review_version?: number;
  bio?: string | null;
  profile_picture?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  race_ethnicity?: string[] | null;
  languages_other_than_english?: string[] | null;
  race_ethnicity_other?: string | null;
  other_demographic_details?: string | null;
  scheduling_url?: string | null;
  availability_status?: 'available' | 'unavailable' | null;
  availability_note?: string | null;
  unavailable_from?: string | null;
  unavailable_until?: string | null;
  created_at: string;
  updated_at: string;
}

type TeamRole = 'admin' | 'doula' | 'hr';

interface DoulaRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  account_status?: string | null;
  address?: string | null;
  unit_number?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  certifications?: Certification[] | null;
  profile_submitted_at?: string | null;
  profile_review_status?: string;
  profile_review_reason?: string | null;
  profile_review_version?: number;
  bio?: string | null;
  profile_picture?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  race_ethnicity?: string[] | null;
  languages_other_than_english?: string[] | null;
  race_ethnicity_other?: string | null;
  other_demographic_details?: string | null;
  scheduling_url?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AdminRow {
  staff_role?: 'admin' | 'hr';
  role?: string;
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  bio?: string | null;
  profile_picture?: string | null;
  address?: string | null;
  unit_number?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date(0).toISOString()
    : d.toISOString();
}

function splitFullName(fullName: string): {
  firstname: string;
  lastname: string;
} {
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
  const race =
    row.race_ethnicity == null
      ? null
      : Array.isArray(row.race_ethnicity)
        ? [...row.race_ethnicity]
        : null;
  const languages =
    row.languages_other_than_english == null
      ? null
      : Array.isArray(row.languages_other_than_english)
        ? row.languages_other_than_english
            .filter((l): l is string => typeof l === 'string')
            .map((l) => l.trim())
            .filter(Boolean)
        : null;
  return {
    id: row.id,
    firstname,
    lastname,
    fullName: row.full_name,
    email: row.email ?? '',
    role: 'doula',
    account_status: row.account_status ?? 'approved',
    phone_number: row.phone ?? null,
    address: row.address ?? null,
    unit_number: row.unit_number ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: defaultAddressCountry(row.country),
    zip_code: row.zip_code ?? null,
    certifications: serializeCertifications(row.certifications),
    profile_submitted_at: row.profile_submitted_at ?? null,
    profile_review_status:
      row.profile_review_status ??
      (row.account_status === 'approved'
        ? 'approved'
        : row.profile_submitted_at
          ? 'submitted'
          : 'draft'),
    profile_review_reason: row.profile_review_reason ?? null,
    profile_review_version: row.profile_review_version ?? 0,
    bio: row.bio ?? null,
    profile_picture: row.profile_picture ?? null,
    gender: row.gender ?? null,
    pronouns: row.pronouns ?? null,
    race_ethnicity: race,
    languages_other_than_english: languages,
    race_ethnicity_other: row.race_ethnicity_other ?? null,
    other_demographic_details: row.other_demographic_details ?? null,
    scheduling_url: row.scheduling_url ?? null,
    availability_status: null,
    availability_note: null,
    unavailable_from: null,
    unavailable_until: null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function mapAdminRow(row: AdminRow): TeamMemberDto {
  const split = splitFullName(row.full_name);
  const firstname = (row.first_name || '').trim() || split.firstname;
  const lastname = (row.last_name || '').trim() || split.lastname;
  return {
    id: row.id,
    firstname,
    lastname,
    fullName: row.full_name || `${firstname} ${lastname}`.trim(),
    email: row.email ?? '',
    role: row.staff_role === 'hr' || row.role === 'hr' ? 'hr' : 'admin',
    account_status: 'approved',
    phone_number: row.phone ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: row.country ?? null,
    zip_code: row.zip_code ?? null,
    bio: row.bio ?? null,
    profile_picture: row.profile_picture ?? null,
    availability_status: null,
    availability_note: null,
    unavailable_from: null,
    unavailable_until: null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export class CloudSqlTeamService {
  private readonly doulaAvailabilityService = new DoulaAvailabilityService();

  private async withResolvedProfilePictures(
    members: TeamMemberDto[]
  ): Promise<TeamMemberDto[]> {
    return resolveProfilePictureFields(members);
  }

  private async withResolvedProfilePicture(
    member: TeamMemberDto | null
  ): Promise<TeamMemberDto | null> {
    if (!member) return null;
    return {
      ...member,
      profile_picture: await resolveProfilePictureUrl(member.profile_picture),
    };
  }

  async listTeamMembers(): Promise<TeamMemberDto[]> {
    const pool = getPool();
    try {
      const { rows } = await pool.query<
        DoulaRow & { role: 'admin' | 'doula' | 'hr' }
      >(
        `
        SELECT id, unit_number, full_name, NULL::text AS first_name, NULL::text AS last_name, email, phone, account_status, address, city, state, country, zip_code, bio, profile_picture, languages_other_than_english, scheduling_url, certifications, profile_submitted_at, profile_review_status, profile_review_reason, profile_review_version, 'doula'::text AS role, created_at, updated_at
        FROM public.doulas WHERE tenant_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id=doulas.tenant_id AND m.principal_id=doulas.id AND m.status='inactive')
        UNION ALL
        SELECT id, NULL::text AS unit_number, full_name, first_name, last_name, email, phone, 'approved'::text, address, city, state, country, zip_code, bio, profile_picture, NULL::text[], NULL::text, NULL::jsonb, NULL::timestamptz, 'approved'::text, NULL::text, 0::integer, COALESCE(to_jsonb(admins)->>'staff_role','admin') AS role, created_at, updated_at
        FROM public.admins WHERE tenant_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id=admins.tenant_id AND m.principal_id=admins.id AND m.status='inactive')
        ORDER BY full_name ASC
        `,
        [readTenantRequestState().tenantId]
      );
      const withAvailability = await this.withAvailabilitySummary(
        rows.map((r) =>
          r.role !== 'doula' ? mapAdminRow(r as unknown as AdminRow) : mapRow(r)
        )
      );
      return this.withResolvedProfilePictures(withAvailability);
    } catch (error) {
      // Backward compatibility: if admins table doesn't exist yet, return doulas only.
      const msg = (error as Error)?.message || '';
      if (msg.includes('public.admins') && msg.includes('does not exist')) {
        const { rows } = await pool.query<DoulaRow>(
          `
          SELECT id, unit_number, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, profile_picture, languages_other_than_english, scheduling_url, certifications, profile_submitted_at, profile_review_status, profile_review_reason, profile_review_version, created_at, updated_at
          FROM public.doulas WHERE tenant_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id=doulas.tenant_id AND m.principal_id=doulas.id AND m.status='inactive')
          ORDER BY full_name ASC
          `,
          [readTenantRequestState().tenantId]
        );
        const withAvailability = await this.withAvailabilitySummary(
          rows.map(mapRow)
        );
        return this.withResolvedProfilePictures(withAvailability);
      }
      throw error;
    }
  }

  async listDoulas(): Promise<TeamMemberDto[]> {
    return this.listTeamMembers();
  }

  async getStaffByEmail(email: string): Promise<TeamMemberDto | null> {
    const doula = await this.getDoulaByEmail(email);
    if (doula) return doula;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const pool = getPool();
    const { rows } = await pool.query<AdminRow>(
      `
      SELECT COALESCE(to_jsonb(admins)->>'staff_role','admin') AS staff_role, id, NULL::text AS unit_number, full_name, first_name, last_name, email, phone, bio, profile_picture, address, city, state, country, zip_code, created_at, updated_at
      FROM public.admins
      WHERE lower(email) = $1
      LIMIT 1
      `,
      [normalized]
    );
    return this.withResolvedProfilePicture(
      rows[0] ? mapAdminRow(rows[0]) : null
    );
  }

  async getDoulaByEmail(email: string): Promise<TeamMemberDto | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const pool = getPool();
    const { rows } = await pool.query<DoulaRow>(
      `
      SELECT id, unit_number, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, profile_picture, scheduling_url,
             certifications, profile_submitted_at, profile_review_status, profile_review_reason, profile_review_version, gender, pronouns, race_ethnicity, languages_other_than_english, race_ethnicity_other, other_demographic_details,
             created_at, updated_at
      FROM public.doulas
      WHERE lower(email) = $1
      LIMIT 1
      `,
      [normalized]
    );
    return this.withResolvedProfilePicture(rows[0] ? mapRow(rows[0]) : null);
  }

  async getTeamMemberById(id: string): Promise<TeamMemberDto | null> {
    const pool = getPool();
    const { rows } = await pool.query<DoulaRow>(
      `
      SELECT id, unit_number, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, profile_picture, scheduling_url,
             certifications, profile_submitted_at, profile_review_status, profile_review_reason, profile_review_version, gender, pronouns, race_ethnicity, languages_other_than_english, race_ethnicity_other, other_demographic_details,
             created_at, updated_at
      FROM public.doulas
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [id]
    );
    if (rows[0]) return this.withResolvedProfilePicture(mapRow(rows[0]));

    try {
      const { rows: adminRows } = await pool.query<AdminRow>(
        `
        SELECT COALESCE(to_jsonb(admins)->>'staff_role','admin') AS staff_role, id, NULL::text AS unit_number, full_name, first_name, last_name, email, phone, bio, profile_picture, address, city, state, country, zip_code, created_at, updated_at
        FROM public.admins
        WHERE id = $1::uuid
        LIMIT 1
        `,
        [id]
      );
      return this.withResolvedProfilePicture(
        adminRows[0] ? mapAdminRow(adminRows[0]) : null
      );
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
      INSERT INTO public.doulas (
        id, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, scheduling_url, created_at, updated_at
      )
      VALUES (
        COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, 'active', NULL, NULL, NULL, 'United States', NULL, NULL, NULL, NOW(), NOW()
      )
      RETURNING id, unit_number, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, scheduling_url, created_at, updated_at
      `,
      [
        input.id ?? null,
        fullName,
        input.email.toLowerCase().trim(),
        input.phone_number ?? null,
      ]
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
    const firstName = input.firstname.trim();
    const lastName = input.lastname.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const { rows } = await getPool().query<AdminRow>(
      `
      INSERT INTO public.admins (id, full_name, first_name, last_name, email, phone, created_at, updated_at)
      VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, full_name, first_name, last_name, email, phone, created_at, updated_at
      `,
      [
        input.id ?? null,
        fullName,
        firstName,
        lastName,
        input.email.toLowerCase().trim(),
        input.phone_number ?? null,
      ]
    );
    return mapAdminRow(rows[0]);
  }

  async addTeamMember(input: {
    firstname: string;
    lastname: string;
    email: string;
    role: TeamRole;
    invitedById?: string;
    invitedByEmail?: string;
    phone_number?: string | null;
  }): Promise<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    role: TeamRole;
    phone_number: string | null;
    invitation_status?: 'pending';
    account_status?: string;
  }> {
    const tenantId = readTenantRequestState().tenantId;
    if (!tenantId)
      throw new Error('An organization is required to invite a team member.');
    if (!['admin', 'doula', 'hr'].includes(input.role))
      throw new Error('Invalid staff role');
    if (input.role === 'hr' && !input.invitedById)
      throw new Error('An inviting admin is required for HR');
    const normalizedEmail = input.email.toLowerCase().trim();
    const auth = getFirebaseAuth();
    let createdAuth;
    try {
      createdAuth = await auth.createUser({
        email: normalizedEmail,
        password: crypto.randomBytes(18).toString('base64url'),
        emailVerified: true,
        displayName:
          `${input.firstname.trim()} ${input.lastname.trim()}`.trim(),
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/email-already-exists')
        throw error;
      const { createStaffInvitation } = await import(
        '../features/team/application/staffInvitationService'
      );
      const pending = await createStaffInvitation({
        tenantId,
        firstname: input.firstname,
        lastname: input.lastname,
        email: normalizedEmail,
        role: input.role,
        invitedByEmail: input.invitedByEmail ?? input.invitedById ?? null,
        invitedById: input.invitedById,
      });
      return { ...pending, phone_number: null };
    }
    let client;
    try {
      client = await getPool().connect();
      await client.query('BEGIN');
      const firstname = input.firstname.trim();
      const lastname = input.lastname.trim();
      const values = [
        `${firstname} ${lastname}`.trim(),
        normalizedEmail,
        input.phone_number ?? null,
        createdAuth.uid,
        tenantId,
      ];
      const inserted =
        input.role === 'doula'
          ? await client.query(
              `INSERT INTO public.doulas
            (id, full_name, email, phone, identity_platform_uid, tenant_id, account_status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::uuid, 'active') RETURNING id`,
              values
            )
          : await client.query(
              `INSERT INTO public.admins
            (id, full_name, email, phone, identity_platform_uid, tenant_id, first_name, last_name, staff_role)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::uuid, $6, $7, $8) RETURNING id`,
              [...values, firstname, lastname, input.role]
            );
      const id = inserted.rows[0].id;
      if (input.role === 'hr') {
        await client.query(
          `INSERT INTO public.memberships
          (tenant_id, principal_type, principal_id, identity_platform_uid, email, role, status)
          VALUES ($1::uuid, 'admin', $2::uuid, $3, $4, 'hr', 'active')`,
          [tenantId, id, createdAuth.uid, normalizedEmail]
        );
        await client.query(
          `INSERT INTO public.doula_hr_permissions(tenant_id,admin_id,department) VALUES($1::uuid,$2,'hr')`,
          [tenantId, id]
        );
        await client.query(
          `INSERT INTO public.staff_permission_events(tenant_id,actor_id,admin_id,capability,old_value,new_value) VALUES($1::uuid,$2,$3,'hr',false,true)`,
          [tenantId, input.invitedById, id]
        );
      } else {
        await client.query(
          `INSERT INTO public.memberships
          (tenant_id, principal_type, principal_id, identity_platform_uid, email, role, status)
         VALUES ($1::uuid, $2, $3::uuid, $4, $5, $2, 'active')`,
          [tenantId, input.role, id, createdAuth.uid, normalizedEmail]
        );
      }
      await client.query('COMMIT');
      return {
        id,
        firstname,
        lastname,
        email: normalizedEmail,
        role: input.role,
        phone_number: input.phone_number ?? null,
      };
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      await auth.deleteUser(createdAuth.uid);
      throw err;
    } finally {
      client?.release();
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
      address?: string | null;
      unit_number?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      zip_code?: string | null;
      account_status?: string;
      certifications?: Certification[];
      bio?: string | null;
      gender?: string | null;
      pronouns?: string | null;
      race_ethnicity?: string[] | null;
      languages_other_than_english?: string[] | null;
      race_ethnicity_other?: string | null;
      other_demographic_details?: string | null;
      scheduling_url?: string | null;
      profile_picture?: string | null;
    }
  ): Promise<TeamMemberDto | null> {
    const existing = await this.getTeamMemberById(id);
    if (!existing) return null;

    const firstName = (input.firstname ?? existing.firstname ?? '').trim();
    const lastName = (input.lastname ?? existing.lastname ?? '').trim();
    const fullName =
      input.fullName?.trim() ||
      `${firstName} ${lastName}`.trim() ||
      existing.fullName;
    const email = input.email?.trim().toLowerCase() || existing.email;
    const phoneInput =
      input.phone !== undefined ? input.phone : input.phone_number;
    const phone =
      existing.role === 'doula' && phoneInput !== undefined
        ? normalizePhone(phoneInput)
        : (phoneInput ?? existing.phone_number ?? null);
    const address =
      input.address !== undefined ? input.address : (existing.address ?? null);
    const city =
      input.city !== undefined ? input.city : (existing.city ?? null);
    const state =
      input.state !== undefined ? input.state : (existing.state ?? null);
    const country =
      existing.role === 'doula'
        ? defaultAddressCountry(existing.country)
        : input.country !== undefined
          ? input.country
          : (existing.country ?? null);
    const unitNumber =
      input.unit_number !== undefined
        ? normalizeUnitNumber(input.unit_number)
        : (existing.unit_number ?? null);
    const zipCode =
      input.zip_code !== undefined
        ? input.zip_code
        : (existing.zip_code ?? null);
    const accountStatus =
      input.account_status?.trim() || existing.account_status || 'approved';
    const bio = input.bio !== undefined ? input.bio : (existing.bio ?? null);
    const profilePicture =
      input.profile_picture !== undefined
        ? input.profile_picture
        : (existing.profile_picture ?? null);
    const gender =
      input.gender !== undefined ? input.gender : (existing.gender ?? null);
    const pronouns =
      input.pronouns !== undefined
        ? input.pronouns
        : (existing.pronouns ?? null);
    const raceEthnicity =
      input.race_ethnicity !== undefined
        ? input.race_ethnicity
        : (existing.race_ethnicity ?? null);
    const languagesOtherThanEnglish =
      input.languages_other_than_english !== undefined
        ? input.languages_other_than_english
        : (existing.languages_other_than_english ?? null);
    const raceEthnicityOther =
      input.race_ethnicity_other !== undefined
        ? input.race_ethnicity_other
        : (existing.race_ethnicity_other ?? null);
    const otherDemographicDetails =
      input.other_demographic_details !== undefined
        ? input.other_demographic_details
        : (existing.other_demographic_details ?? null);
    const schedulingUrl =
      input.scheduling_url !== undefined
        ? input.scheduling_url
        : (existing.scheduling_url ?? null);

    if (existing.role === 'admin' || existing.role === 'hr') {
      const { rows } = await getPool().query<AdminRow>(
        `
        UPDATE public.admins
        SET full_name = $1,
            first_name = $2,
            last_name = $3,
            email = $4,
            phone = $5,
            bio = $6,
            profile_picture = $7,
            address = $8,
            city = $9,
            state = $10,
            country = $11,
            zip_code = $12,
            updated_at = NOW()
        WHERE id = $13::uuid
        RETURNING staff_role, id, full_name, first_name, last_name, email, phone, bio, profile_picture, address, city, state, country, zip_code, created_at, updated_at
        `,
        [
          fullName,
          firstName,
          lastName,
          email,
          phone,
          bio,
          profilePicture,
          address,
          city,
          state,
          country,
          zipCode,
          id,
        ]
      );
      return this.withResolvedProfilePicture(
        rows[0] ? mapAdminRow(rows[0]) : null
      );
    }

    const { rows } = await getPool().query<DoulaRow>(
      `
      UPDATE public.doulas
      SET full_name = $1,
          email = $2,
          phone = $3,
          address = $4,
          city = $5,
          state = $6,
          country = $7,
          zip_code = $8,
          account_status = $9,
          bio = $10,
          gender = $11,
          pronouns = $12,
          race_ethnicity = $13,
          languages_other_than_english = $14,
          race_ethnicity_other = $15,
          other_demographic_details = $16,
          scheduling_url = $17,
          profile_picture = $18,
          unit_number = $21,
          certifications = COALESCE($20::jsonb, certifications),
          updated_at = NOW()
      WHERE id = $19::uuid
      RETURNING id, unit_number, full_name, email, phone, account_status, address, city, state, country, zip_code, bio, profile_picture,
               certifications, profile_submitted_at, profile_review_status, profile_review_reason, profile_review_version, gender, pronouns, race_ethnicity, languages_other_than_english, race_ethnicity_other, other_demographic_details, scheduling_url,
                created_at, updated_at
      `,
      [
        fullName,
        email,
        phone,
        address,
        city,
        state,
        country,
        zipCode,
        accountStatus,
        bio,
        gender,
        pronouns,
        raceEthnicity,
        languagesOtherThanEnglish,
        raceEthnicityOther,
        otherDemographicDetails,
        schedulingUrl,
        profilePicture,
        id,
        input.certifications === undefined
          ? null
          : JSON.stringify(
              input.certifications.map((entry) => {
                const previous = existing.certifications?.find(
                  (stored) =>
                    stored.name === entry.name &&
                    stored.issuingOrganization === entry.issuingOrganization
                );
                return previous?.year !== undefined && entry.year === undefined
                  ? { ...entry, year: previous.year }
                  : entry;
              })
            ),
        unitNumber,
      ]
    );
    return this.withResolvedProfilePicture(rows[0] ? mapRow(rows[0]) : null);
  }

  private async withAvailabilitySummary(
    members: TeamMemberDto[]
  ): Promise<TeamMemberDto[]> {
    const doulaIds = members
      .filter((member) => member.role === 'doula')
      .map((member) => member.id);
    if (!doulaIds.length) return members;

    const availabilityMap =
      await this.doulaAvailabilityService.getAvailabilityStatusForDoulas(
        doulaIds
      );

    return members.map((member) => {
      if (member.role !== 'doula') return member;
      const availability = availabilityMap.get(member.id) ?? {
        status: 'available' as const,
        reason: null,
        startAt: null,
        endAt: null,
      };

      return {
        ...member,
        availability_status: availability.status,
        availability_note: availability.reason,
        unavailable_from: availability.startAt,
        unavailable_until: availability.endAt,
      };
    });
  }

  async updateDoulaProfilePicture(
    doulaId: string,
    profilePictureUrl: string
  ): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `
      UPDATE public.doulas
      SET profile_picture = $1, updated_at = NOW()
      WHERE id = $2::uuid
      `,
      [profilePictureUrl, doulaId]
    );
    if ((result.rowCount ?? 0) > 0) {
      try {
        const { recordHeadshotNotice } = await import(
          '../features/notifications/application/eventNotices'
        );
        await recordHeadshotNotice(doulaId);
      } catch {
        // A missing notice table must not block the headshot save.
      }
    }
    return (result.rowCount ?? 0) > 0;
  }

  async deleteTeamMember(
    id: string,
    tenantId = readTenantRequestState().tenantId,
    actorId = 'organization-admin'
  ): Promise<boolean> {
    if (!tenantId)
      throw new Error('A tenant is required to remove a team member');
    const db = await getPool().connect();
    try {
      await db.query('BEGIN');
      await db.query(
        'LOCK TABLE public.doula_hr_permissions IN EXCLUSIVE MODE'
      );
      let kind = 'doula';
      let result = await db.query(
        'SELECT id,email,identity_platform_uid FROM public.doulas WHERE id=$1::uuid AND tenant_id=$2::uuid FOR UPDATE',
        [id, tenantId]
      );
      if (!result.rows.length) {
        kind = 'admin';
        result = await db.query(
          'SELECT id,email,identity_platform_uid FROM public.admins WHERE id=$1::uuid AND tenant_id=$2::uuid FOR UPDATE',
          [id, tenantId]
        );
      }
      const member = result.rows[0];
      if (!member) {
        await db.query('ROLLBACK');
        return false;
      }
      const prior = await db.query(
        'SELECT status FROM public.memberships WHERE tenant_id=$1::uuid AND principal_id=$2::uuid FOR UPDATE',
        [tenantId, id]
      );
      if (prior.rows[0]?.status === 'inactive') {
        await db.query('COMMIT');
        return true;
      }
      const grants = await db.query(
        'SELECT department FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2',
        [tenantId, id]
      );
      if (grants.rows.length) {
        const remaining = await db.query(
          `SELECT 1 FROM public.doula_hr_permissions p JOIN public.admins a ON a.tenant_id=p.tenant_id AND a.id::text=p.admin_id
          WHERE p.tenant_id=$1::uuid AND p.admin_id<>$2 AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.tenant_id=p.tenant_id AND m.principal_id=a.id AND m.status='inactive') LIMIT 1`,
          [tenantId, id]
        );
        if (!remaining.rowCount)
          throw new ConflictError(
            'Cannot remove the last person with HR/payroll access. Grant access to another admin first.'
          );
        await db.query(
          `INSERT INTO public.staff_permission_events(tenant_id,actor_id,admin_id,capability,old_value,new_value)
          SELECT tenant_id,$3,admin_id,department,true,false FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2`,
          [tenantId, id, actorId]
        );
        await db.query(
          'DELETE FROM public.doula_hr_permissions WHERE tenant_id=$1::uuid AND admin_id=$2',
          [tenantId, id]
        );
      }
      await db.query(
        `INSERT INTO public.memberships(tenant_id,principal_type,principal_id,identity_platform_uid,email,role,status)
        VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,'inactive') ON CONFLICT(tenant_id,principal_type,principal_id)
        DO UPDATE SET status='inactive',updated_at=now()`,
        [tenantId, kind, id, member.identity_platform_uid, member.email, kind]
      );
      await db.query(
        "INSERT INTO public.staff_membership_events(tenant_id,principal_id,event,actor_id) VALUES($1::uuid,$2::uuid,'removed',$3)",
        [tenantId, id, actorId]
      );
      await db.query('COMMIT');
      return true;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
}
