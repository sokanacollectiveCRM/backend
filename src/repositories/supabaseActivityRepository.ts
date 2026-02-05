import { SupabaseClient } from '@supabase/supabase-js';
import { Activity } from '../entities/Activity';
import { ActivityRepository } from './interface/activityRepository';

/**
 * Canonical row type for activities (used in split-DB PRIMARY mode).
 * Maps to DTO field names for direct transformation.
 */
export interface ActivityRow {
  id: string;
  client_id: string;
  created_by: string | null;
  activity_type: string;
  content: string;
  created_at: string;
}

export class SupabaseActivityRepository implements ActivityRepository {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  // ============================================
  // CANONICAL METHODS (SPLIT_DB_READ_MODE=primary)
  // ============================================

  /**
   * Get activities for a client with explicit column selection (canonical mode).
   * HIPAA COMPLIANCE: Returns ONLY operational fields - NO PHI.
   * Uses explicit SELECT - never SELECT *.
   * 
   * @param clientId - The client UUID
   * @returns Array of activity rows for mapping to ActivityDTO[]
   */
  async getActivitiesByClientIdCanonical(clientId: string): Promise<ActivityRow[]> {
    // EXPLICIT column selection with aliases to match DTO field names
    // Table columns: id, client_id, type, description, timestamp, created_by
    // DTO fields:    id, client_id, activity_type, content, created_at, created_by
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .select(`
        id,
        client_id,
        created_by,
        type,
        description,
        timestamp
      `)
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    // Map column names to DTO-compatible field names
    return (data || []).map(row => ({
      id: row.id,
      client_id: row.client_id,
      created_by: row.created_by,
      activity_type: row.type,
      content: row.description || '',
      created_at: row.timestamp,
    }));
  }

  /**
   * Create an activity with explicit column selection (canonical mode).
   * HIPAA COMPLIANCE: Returns ONLY operational fields - NO PHI.
   * Uses explicit SELECT - never SELECT *.
   * 
   * @param clientId - The client UUID
   * @param createdBy - The user ID who created the activity (nullable)
   * @param activityType - The type of activity (note, call, text, etc.)
   * @param content - The activity content/description
   * @returns Created activity row for mapping to ActivityDTO
   */
  async createActivityCanonical(
    clientId: string,
    createdBy: string | null,
    activityType: string,
    content: string
  ): Promise<ActivityRow> {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .insert({
        client_id: clientId,
        type: activityType,
        description: content,
        timestamp: new Date().toISOString(),
        created_by: createdBy,
      })
      .select(`
        id,
        client_id,
        created_by,
        type,
        description,
        timestamp
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }

    // Map column names to DTO-compatible field names
    return {
      id: data.id,
      client_id: data.client_id,
      created_by: data.created_by,
      activity_type: data.type,
      content: data.description || '',
      created_at: data.timestamp,
    };
  }

  // ============================================
  // LEGACY METHODS (non-primary modes)
  // ============================================

  async createActivity(activityData: {
    clientId: string;
    type: string;
    description?: string;
    metadata?: any;
    timestamp: Date;
    createdBy?: string;
  }): Promise<Activity> {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .insert({
        client_id: activityData.clientId,
        type: activityData.type,
        description: activityData.description,
        metadata: activityData.metadata,
        timestamp: activityData.timestamp,
        created_by: activityData.createdBy
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }

    return this.mapToActivity(data);
  }

  async getActivitiesByClientId(clientId: string): Promise<Activity[]> {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    return data.map(row => this.mapToActivity(row));
  }

  async getAllActivities(): Promise<Activity[]> {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch all activities: ${error.message}`);
    }

    return data.map(row => this.mapToActivity(row));
  }

  private mapToActivity(data: any): Activity {
    return new Activity(
      data.id,
      data.client_id,
      data.type,
      data.description,
      data.metadata,
      new Date(data.timestamp),
      data.created_by
    );
  }
}
