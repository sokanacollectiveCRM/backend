import { SupabaseClient } from '@supabase/supabase-js';
import { Activity } from '../entities/Activity';
import { queryCloudSql } from '../db/cloudSqlPool';
import { ActivityRepository } from './interface/activityRepository';

type ActivityRow = {
  id: string;
  client_id: string;
  type: string;
  description: string | null;
  metadata: Record<string, any> | null;
  timestamp: Date | string;
  created_by: string | null;
  created_by_name: string;
  created_by_role: string | null;
};

export class CloudSqlActivityRepository implements ActivityRepository {
  // Keep constructor compatible with existing wiring while using Cloud SQL under the hood.
  constructor(_supabaseClient?: SupabaseClient) {}

  private readonly creatorSelectSql = `
    a.id,
    a.client_id,
    a.type,
    a.description,
    a.metadata,
    a.timestamp,
    a.created_by,
    COALESCE(
      NULLIF(TRIM(COALESCE(d.full_name, ad.full_name, '')), ''),
      NULLIF(COALESCE(d.email, ad.email, ''), ''),
      NULLIF(COALESCE(a.metadata->>'createdByName', ''), ''),
      'Staff member'
    ) AS created_by_name,
    COALESCE(
      CASE WHEN d.id IS NOT NULL THEN 'doula' END,
      CASE WHEN ad.id IS NOT NULL THEN 'admin' END,
      NULLIF(COALESCE(a.metadata->>'createdByRole', ''), '')
    ) AS created_by_role
  `;

  async createActivity(activityData: {
    clientId: string;
    type: string;
    description?: string;
    metadata?: any;
    timestamp: Date;
    createdBy?: string;
  }): Promise<Activity> {
    const sql = `
      WITH inserted AS (
        INSERT INTO public.client_activities (
          client_id,
          type,
          description,
          metadata,
          timestamp,
          created_by
        )
        VALUES ($1::uuid, $2, $3, $4::jsonb, $5::timestamptz, $6::uuid)
        RETURNING id, client_id, type, description, metadata, timestamp, created_by
      )
      SELECT
        ${this.creatorSelectSql}
      FROM inserted a
      LEFT JOIN public.doulas d ON d.id = a.created_by
      LEFT JOIN public.admins ad ON ad.id = a.created_by
    `;

    const { rows } = await queryCloudSql<ActivityRow>(sql, [
      activityData.clientId,
      activityData.type,
      activityData.description ?? null,
      JSON.stringify(activityData.metadata ?? {}),
      activityData.timestamp,
      activityData.createdBy ?? null,
    ]);

    return this.mapToActivity(rows[0]);
  }

  async getActivitiesByClientId(clientId: string): Promise<Activity[]> {
    const sql = `
      SELECT
        ${this.creatorSelectSql}
      FROM public.client_activities a
      LEFT JOIN public.doulas d ON d.id = a.created_by
      LEFT JOIN public.admins ad ON ad.id = a.created_by
      WHERE a.client_id = $1::uuid
      ORDER BY a.timestamp DESC
    `;

    const { rows } = await queryCloudSql<ActivityRow>(sql, [clientId]);
    return rows.map((row) => this.mapToActivity(row));
  }

  async getAllActivities(): Promise<Activity[]> {
    const sql = `
      SELECT
        ${this.creatorSelectSql}
      FROM public.client_activities a
      LEFT JOIN public.doulas d ON d.id = a.created_by
      LEFT JOIN public.admins ad ON ad.id = a.created_by
      ORDER BY a.timestamp DESC
    `;

    const { rows } = await queryCloudSql<ActivityRow>(sql);
    return rows.map((row) => this.mapToActivity(row));
  }

  async updateActivityMetadataMerge(
    activityId: string,
    clientId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Activity | null> {
    const sql = `
      WITH updated AS (
        UPDATE public.client_activities
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1::uuid AND client_id = $2::uuid
        RETURNING id, client_id, type, description, metadata, timestamp, created_by
      )
      SELECT
        ${this.creatorSelectSql}
      FROM updated a
      LEFT JOIN public.doulas d ON d.id = a.created_by
      LEFT JOIN public.admins ad ON ad.id = a.created_by
    `;
    const { rows } = await queryCloudSql<ActivityRow>(sql, [
      activityId,
      clientId,
      JSON.stringify(metadataPatch),
    ]);
    if (!rows.length) {
      return null;
    }
    return this.mapToActivity(rows[0]);
  }

  private mapToActivity(row: ActivityRow): Activity {
    return new Activity(
      row.id,
      row.client_id,
      row.type,
      row.description ?? '',
      row.metadata ?? {},
      new Date(row.timestamp),
      row.created_by ?? undefined,
      row.created_by_name || 'Staff member',
      row.created_by_role ?? undefined
    );
  }
}
