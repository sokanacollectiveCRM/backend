'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SupabaseActivityRepository = void 0;
const Activity_1 = require('../entities/Activity');
class SupabaseActivityRepository {
  constructor(supabaseClient) {
    this.supabaseClient = supabaseClient;
  }
  async createActivity(activityData) {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .insert({
        client_id: activityData.clientId,
        type: activityData.type,
        description: activityData.description,
        metadata: activityData.metadata,
        timestamp: activityData.timestamp,
        created_by: activityData.createdBy,
      })
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }
    return this.mapToActivity(data);
  }
  async getActivitiesByClientId(clientId) {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }
    return data.map((row) => this.mapToActivity(row));
  }
  async getAllActivities() {
    const { data, error } = await this.supabaseClient
      .from('client_activities')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch all activities: ${error.message}`);
    }
    return data.map((row) => this.mapToActivity(row));
  }
  mapToActivity(data) {
    return new Activity_1.Activity(
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
exports.SupabaseActivityRepository = SupabaseActivityRepository;
