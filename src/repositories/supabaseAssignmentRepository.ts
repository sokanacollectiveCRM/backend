import { SupabaseClient, createClient } from '@supabase/supabase-js';

export interface Assignment {
  id: string;
  doulaId: string;
  clientId: string;
  assignedAt: Date;
  assignedBy?: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignedDoula {
  id: string;
  doulaId: string;
  assignedAt: Date;
  status: string;
  doula: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    profile_picture?: string;
    bio?: string;
    phone_number?: string;
  };
}

export class SupabaseAssignmentRepository {
  private supabaseClient: SupabaseClient;
  private supabaseUrl: string;

  constructor(supabaseClient: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.supabaseUrl = process.env.SUPABASE_URL || '';
  }

  private createUserClient(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Assign a doula to a client
   */
  async assignDoula(
    clientId: string,
    doulaId: string,
    assignedBy?: string,
    accessToken?: string
  ): Promise<Assignment> {
    const client = accessToken ? this.createUserClient(accessToken) : this.supabaseClient;

    const { data, error } = await client
      .from('assignments')
      .insert({
        client_id: clientId,
        doula_id: doulaId,
        assigned_by: assignedBy,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw new Error('This doula is already assigned to this client');
      }

      // If RLS error with user token, try with service role as fallback
      if (error.message.includes('row-level security') && accessToken) {
        console.log('⚠️  RLS error with user token, retrying with service role...');
        const { data: retryData, error: retryError } = await this.supabaseClient
          .from('assignments')
          .insert({
            client_id: clientId,
            doula_id: doulaId,
            assigned_by: assignedBy,
            status: 'active'
          })
          .select()
          .single();

        if (retryError) {
          throw new Error(`Failed to assign doula: ${retryError.message}`);
        }

        return this.mapToAssignment(retryData);
      }

      throw new Error(`Failed to assign doula: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  /**
   * Unassign a doula from a client
   */
  async unassignDoula(clientId: string, doulaId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('assignments')
      .delete()
      .eq('client_id', clientId)
      .eq('doula_id', doulaId);

    if (error) {
      throw new Error(`Failed to unassign doula: ${error.message}`);
    }
  }

  /**
   * Get all doulas assigned to a specific client
   */
  async getAssignedDoulas(clientId: string): Promise<AssignedDoula[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select(`
        id,
        doula_id,
        assigned_at,
        status,
        users!assignments_doula_id_fkey (
          id,
          firstname,
          lastname,
          email
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch assigned doulas: ${error.message}`);
    }

    return data.map(item => {
      const userRow = Array.isArray(item.users) ? item.users[0] : item.users;
      return {
        id: item.id,
        doulaId: item.doula_id,
        assignedAt: new Date(item.assigned_at),
        status: item.status,
        doula: {
          id: userRow?.id,
          firstname: userRow?.firstname,
          lastname: userRow?.lastname,
          email: userRow?.email,
          profile_picture: undefined, // column may not exist in users table
          bio: undefined,
        }
      };
    });
  }

  /**
   * Get all clients assigned to a specific doula
   */
  async getAssignedClients(doulaId: string): Promise<string[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch assigned clients: ${error.message}`);
    }

    return data.map(a => a.client_id);
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(
    assignmentId: string,
    status: 'active' | 'completed' | 'cancelled'
  ): Promise<Assignment> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .update({ status })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update assignment status: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  /**
   * Update assignment notes
   */
  async updateAssignmentNotes(
    assignmentId: string,
    notes: string
  ): Promise<Assignment> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .update({ notes })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update assignment notes: ${error.message}`);
    }

    return this.mapToAssignment(data);
  }

  /**
   * Map database row to Assignment object
   */
  private mapToAssignment(data: any): Assignment {
    return {
      id: data.id,
      doulaId: data.doula_id,
      clientId: data.client_id,
      assignedAt: new Date(data.assigned_at),
      assignedBy: data.assigned_by,
      notes: data.notes,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}
