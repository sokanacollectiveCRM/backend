import { SupabaseClient } from '@supabase/supabase-js';
import { Activity } from '../entities/Activity';
import { ActivityRepository } from './interface/activityRepository';

export class SupabaseActivityRepository implements ActivityRepository {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
  }

  async createActivity(activityData: Omit<Activity, 'id'>): Promise<Activity> {
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