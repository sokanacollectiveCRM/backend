// infrastructure/repositories/SupabaseUserRepository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Client } from '../entities/Client';
import { User } from '../entities/User';
import { ROLE } from '../types';

export class SupabaseClientRepository  {
  private supabaseClient: SupabaseClient;
  
  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabaseClient = supabaseClient;
  }

  async updateStatus(clientId: string, status: string): Promise<Client> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .update({ status })
      .eq('id', clientId)
      .select(`
        id,
        firstname,
        lastname,
        service_needed,
        requested,
        updated_at,
        status,
        user_id,
        users (
          profile_picture,
          firstname,
          lastname
        )
      `)
      .single()

    if (error) {
      throw new Error(`${error.message}`);
    }

    return this.mapToClient(data);
  }

  // Helper to map database user to domain User
  private mapToUser(data: any): User {
    return new User({
      id: data.id,
      username: data.username,
      email: data.email,
      firstname: data.firstname,
      lastname: data.lastname,
      created_at: new Date(data.created_at || Date.now()),
      updated_at: new Date(data.updated_at || Date.now()),
      role: data.role || ROLE.CLIENT,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      zip_code: data.zip_code,
      profile_picture: data.profile_picture,
      account_status: data.account_status,
      business: data.business,
      bio: data.bio
    });
  }

  // Helper to map to client entity
  private mapToClient(data: any): Client {
    // If the user has created a profile, grab user data from users table. If not, grab details
    // from the request form (client_info table).
    const userData = data.users ? {
      id: data.users.user_id,
      firstname: data.users.firstname,
      lastname: data.users.lastname,
      profile_picture: data.users,
    } :
    {
      id: data.id,
      firstname: data.firstname,
      lastname: data.lastname,
      profile_picture: ''
    };

    // if user doesn't exist (not approved), we fill fields from client_info table
    const user = this.mapToUser({
      id: userData.id ?? data.id,
      firstname: userData.firstname,
      lastname: userData.lastname,
      profile_picture: userData.profile_picture,
      role: 'client',
    })

    return new Client(
      user,
      data.service_needed,
      new Date(data.requested),
      new Date(data.updated_at),
      data.status
    )
  }
}