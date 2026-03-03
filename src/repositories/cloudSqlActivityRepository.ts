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
};

export class CloudSqlActivityRepository implements ActivityRepository {
  // Keep constructor compatible with existing wiring while using Cloud SQL under the hood.
  constructor(_supabaseClient?: SupabaseClient) {}

  async createActivity(activityData: {
    clientId: string;
    type: string;
    description?: string;
    metadata?: any;
    timestamp: Date;
    createdBy?: string;
  }): Promise<Activity> {
    const sql = `
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
      SELECT id, client_id, type, description, metadata, timestamp, created_by
      FROM public.client_activities
      WHERE client_id = $1::uuid
      ORDER BY timestamp DESC
    `;

    const { rows } = await queryCloudSql<ActivityRow>(sql, [clientId]);
    return rows.map((row) => this.mapToActivity(row));
  }

  async getAllActivities(): Promise<Activity[]> {
    const sql = `
      SELECT id, client_id, type, description, metadata, timestamp, created_by
      FROM public.client_activities
      ORDER BY timestamp DESC
    `;

    const { rows } = await queryCloudSql<ActivityRow>(sql);
    return rows.map((row) => this.mapToActivity(row));
  }

  private mapToActivity(row: ActivityRow): Activity {
    return new Activity(
      row.id,
      row.client_id,
      row.type,
      row.description ?? '',
      row.metadata ?? {},
      new Date(row.timestamp),
      row.created_by ?? undefined
    );
  }
}
