// infrastructure/repositories/SupabaseUserRepository.ts
import { File as MulterFile } from 'multer';

import { SupabaseClient } from '@supabase/supabase-js';

import { queryCloudSql } from '../db/cloudSqlPool';
import { WORK_ENTRY_ROW } from '../entities/Hours';
import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import {
  CloudSqlTeamService,
  TeamMemberDto,
} from '../services/cloudSqlTeamService';
import { ROLE } from '../types';
import { HourType } from '../utils/hourTypes';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupabaseUserRepository implements UserRepository {
  private team = new CloudSqlTeamService();

  constructor(supabaseClient: SupabaseClient) {
    void supabaseClient;
  }

  private memberToUser(member: TeamMemberDto): User {
    return new User({
      id: member.id,
      email: member.email,
      firstname: member.firstname,
      lastname: member.lastname,
      created_at: new Date(member.created_at || Date.now()),
      updated_at: new Date(member.updated_at || Date.now()),
      role: member.role === 'admin' ? ROLE.ADMIN : ROLE.DOULA,
      address: member.address ?? undefined,
      city: member.city ?? undefined,
      state: member.state as User['state'],
      country: member.country ?? undefined,
      zip_code: member.zip_code ? Number(member.zip_code) : undefined,
      profile_picture:
        member.profile_picture as unknown as User['profile_picture'],
      account_status: member.account_status as User['account_status'],
      bio: member.bio ?? undefined,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const member = await this.team.getStaffByEmail(email);
    return member ? this.memberToUser(member) : null;
  }

  async findByRole(role: string): Promise<User[]> {
    const members = await this.team.listTeamMembers();
    return members
      .filter((member) => member.role === role)
      .map((member) => this.memberToUser(member));
  }

  async save(user: User): Promise<User> {
    const existing = user.email
      ? await this.team.getStaffByEmail(user.email)
      : null;
    if (!existing) {
      throw new Error('Approved staff record not found');
    }
    const updated = await this.team.updateTeamMember(existing.id, {
      firstname: user.firstname || existing.firstname,
      lastname: user.lastname || existing.lastname,
    });
    if (!updated) {
      throw new Error('Approved staff record not found');
    }
    return this.memberToUser(updated);
  }

  async update(userId: string, fieldsToUpdate: Partial<User>): Promise<User> {
    const updated = await this.team.updateTeamMember(userId, {
      firstname: fieldsToUpdate.firstname,
      lastname: fieldsToUpdate.lastname,
      email: fieldsToUpdate.email,
      phone_number: fieldsToUpdate.phone_number,
      address: fieldsToUpdate.address,
      city: fieldsToUpdate.city,
      state: fieldsToUpdate.state ? String(fieldsToUpdate.state) : undefined,
      country: fieldsToUpdate.country,
      zip_code:
        fieldsToUpdate.zip_code != null
          ? String(fieldsToUpdate.zip_code)
          : undefined,
      account_status: fieldsToUpdate.account_status,
      bio: fieldsToUpdate.bio,
    });
    if (!updated) {
      throw new Error('Staff record not found');
    }
    return this.memberToUser(updated);
  }

  async findAll(): Promise<User[]> {
    const members = await this.team.listTeamMembers();
    return members.map((member) => this.memberToUser(member));
  }

  async findAllTeamMembers(): Promise<User[]> {
    const members = await this.team.listTeamMembers();
    return members.map((member) => this.memberToUser(member));
  }

  async addMember(
    firstname: string,
    lastname: string,
    userEmail: string,
    userRole: string
  ): Promise<User> {
    const role = userRole === 'admin' ? 'admin' : 'doula';
    const member = await this.team.addTeamMember({
      firstname,
      lastname,
      email: userEmail,
      role,
    });
    return this.memberToUser({
      ...member,
      fullName: `${member.firstname} ${member.lastname}`.trim(),
      account_status: 'approved',
      address: null,
      city: null,
      state: null,
      country: null,
      zip_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  async getHoursById(id: string): Promise<any> {
    try {
      const { rows } = await queryCloudSql<{
        id: string;
        start_time: Date | string;
        end_time: Date | string;
        type: HourType | null;
        doula_id: string;
        doula_full_name: string | null;
        client_id: string;
        client_first_name: string | null;
        client_last_name: string | null;
      }>(
        `
        SELECT
          h.id,
          h.start_time,
          h.end_time,
          h.type,
          h.doula_id,
          d.full_name AS doula_full_name,
          h.client_id,
          pc.first_name AS client_first_name,
          pc.last_name AS client_last_name
        FROM public.hours h
        LEFT JOIN public.doulas d ON d.id = h.doula_id
        LEFT JOIN public.phi_clients pc ON pc.id = h.client_id
        WHERE h.doula_id = $1::uuid
        ORDER BY h.start_time DESC
        `,
        [id]
      );

      return rows.map((entry) => {
        const doulaNameParts = (entry.doula_full_name || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const doulaFirstname = doulaNameParts[0] || '';
        const doulaLastname = doulaNameParts.slice(1).join(' ');
        const client = {
          id: entry.client_id,
          firstname: entry.client_first_name ?? '',
          lastname: entry.client_last_name ?? '',
          // Backward compatibility for UIs that still read client.user.*
          user: {
            id: entry.client_id,
            firstname: entry.client_first_name ?? '',
            lastname: entry.client_last_name ?? '',
          },
        };
        return {
          id: entry.id,
          start_time: entry.start_time,
          end_time: entry.end_time,
          startTime: entry.start_time,
          endTime: entry.end_time,
          type: entry.type ?? null,
          doula_id: entry.doula_id,
          client_id: entry.client_id,
          doula: {
            id: entry.doula_id,
            firstname: doulaFirstname,
            lastname: doulaLastname,
          },
          client,
          note: null,
        };
      });
    } catch (error) {
      throw new Error(`Failed to get user's hours: ${error.message}`);
    }
  }

  async getAllHours(): Promise<any> {
    try {
      const { rows } = await queryCloudSql<{
        id: string;
        start_time: Date | string;
        end_time: Date | string;
        type: HourType | null;
        doula_id: string;
        doula_full_name: string | null;
        client_id: string;
        client_first_name: string | null;
        client_last_name: string | null;
      }>(
        `
        SELECT
          h.id,
          h.start_time,
          h.end_time,
          h.type,
          h.doula_id,
          d.full_name AS doula_full_name,
          h.client_id,
          pc.first_name AS client_first_name,
          pc.last_name AS client_last_name
        FROM public.hours h
        LEFT JOIN public.doulas d ON d.id = h.doula_id
        LEFT JOIN public.phi_clients pc ON pc.id = h.client_id
        ORDER BY h.start_time DESC
        `
      );

      return rows.map((entry) => {
        const doulaNameParts = (entry.doula_full_name || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const doulaFirstname = doulaNameParts[0] || '';
        const doulaLastname = doulaNameParts.slice(1).join(' ');
        const client = {
          id: entry.client_id,
          firstname: entry.client_first_name ?? '',
          lastname: entry.client_last_name ?? '',
          // Backward compatibility for UIs that still read client.user.*
          user: {
            id: entry.client_id,
            firstname: entry.client_first_name ?? '',
            lastname: entry.client_last_name ?? '',
          },
        };
        return {
          id: entry.id,
          start_time: entry.start_time,
          end_time: entry.end_time,
          startTime: entry.start_time,
          endTime: entry.end_time,
          type: entry.type ?? null,
          doula_id: entry.doula_id,
          client_id: entry.client_id,
          doula: {
            id: entry.doula_id,
            firstname: doulaFirstname,
            lastname: doulaLastname,
          },
          client,
          note: null,
        };
      });
    } catch (error) {
      throw new Error(`Failed to get all hours: ${error.message}`);
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID_RE.test(id)) return null;
    const member = await this.team.getTeamMemberById(id);
    return member ? this.memberToUser(member) : null;
  }

  async delete(id: string): Promise<void> {
    await this.team.deleteTeamMember(id);
  }

  async uploadProfilePicture(user: User, profilePicture: MulterFile) {
    const { uploadProfilePictureObject } = await import(
      '../services/gcs/profilePictureStorage'
    );
    const { relativePath } = await uploadProfilePictureObject(
      user.id,
      profilePicture
    );
    // Persist relative GCS path; callers resolve to signed URLs on read.
    return relativePath;
  }

  async addNewHours(
    doula_id: string,
    client_id: string,
    start_time: Date,
    end_time: Date,
    note: string,
    type: HourType
  ): Promise<WORK_ENTRY_ROW> {
    const _ignoredNote = note;
    void _ignoredNote;
    const { rows } = await queryCloudSql<WORK_ENTRY_ROW>(
      `
      INSERT INTO public.hours (doula_id, client_id, start_time, end_time, type, created_at, updated_at)
      VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, $5::text, NOW(), NOW())
      RETURNING id, doula_id, client_id, start_time, end_time, type
      `,
      [doula_id, client_id, start_time, end_time, type]
    );
    return rows[0];
  }

  async updateHourType(
    hourId: string,
    type: HourType,
    doulaId?: string
  ): Promise<WORK_ENTRY_ROW | null> {
    const params: Array<string | Date> = [type, hourId];
    let sql = `
      UPDATE public.hours
      SET type = $1::text, updated_at = NOW()
      WHERE id = $2::uuid
    `;

    if (doulaId) {
      params.push(doulaId);
      sql += ` AND doula_id = $3::uuid`;
    }

    sql += `
      RETURNING id, doula_id, client_id, start_time, end_time, type
    `;

    const { rows } = await queryCloudSql<WORK_ENTRY_ROW>(sql, params);
    return rows[0] ?? null;
  }
}
