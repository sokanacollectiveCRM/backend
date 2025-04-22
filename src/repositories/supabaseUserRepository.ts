// infrastructure/repositories/SupabaseUserRepository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'entities/Client';
import { User } from 'entities/User';
import { File as MulterFile } from 'multer';
import { UserRepository } from 'repositories/interface/userRepository';
import { ROLE } from 'types';

export class SupabaseUserRepository implements UserRepository {
  private supabaseClient: SupabaseClient;
  
  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabaseClient = supabaseClient;
  }
  
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return this.mapToUser(data);
  }

  async findByRole(role: string): Promise<User[]> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('role', role)
      .order('first_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ${role} users: ${error.message}`);
    }

    return data.map(this.mapToUser);
  }

  async findClientsAll(): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        id,
        first_name,
        last_name,
        service_needed,
        requested,
        updated_at,
        status,
        user_id,
        users (
          email,
          first_name,
          last_name
        )
      `);

    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    return data.map(this.mapToClient);
  }

  async findClientsByDoula(doulaId: string): Promise<User[]> {
    const { data: assignments, error: assignmentsError } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    // Return if there are no assigned clients
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // store out client ids into an array
    const clientIds = assignments.map(assignment => assignment.client_id);

    // grab our users
    const { data: users, error: getUsersError } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', clientIds);

    if (getUsersError) {
      throw new Error(`Failed to fetch clients: ${getUsersError.message}`);
    }

    return users.map(this.mapToUser);
  }
  
  async save(user: User): Promise<User> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
      })
      .select()
      .single();
      
    if (error) {
      console.log(error.message)
      throw new Error(error.message);
    }
    
    return this.mapToUser(data);
  }

  async update(userId: string, fieldsToUpdate: Partial<User>): Promise<User> {

    const { data: updatedUser, error: updatedUserError } = await this.supabaseClient
      .from('users')
      .update(fieldsToUpdate)
      .eq('id', userId)
      .select()
      .single()

    console.log(updatedUserError);

    if (updatedUserError) throw new Error(updatedUserError.message);
    return this.mapToUser(updatedUser);
  }
  
  async findAll(): Promise<User[]> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('username, email, firstname, lastname')
      .order('username', { ascending: true });
      
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    
    return data.map(this.mapToUser);
  }
  
  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return this.mapToUser(data);
  }
  
  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('users')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
  
  async uploadProfilePicture(user: User, profilePicture: MulterFile) {
    const filePath = `${user.id}/${Date.now()}_${profilePicture.originalname}`;

    // upload to supabase
    const { data, error: uploadError } = await this.supabaseClient.storage
    .from('profile-pictures')
    .upload(filePath, profilePicture.buffer, {
      contentType: profilePicture.mimetype,
      upsert: true,
    });

    if (uploadError) {
      console.log('Upload error', uploadError);
      throw new Error('failed to stash profile picture');
    }

    // grab the link to it
    const { data: { publicUrl }} = await this.supabaseClient.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);

    console.log("this is the data", publicUrl);

    return publicUrl;
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
  private mapToClient(client: any): Client {

    // grab the user data from users table
    const userData = client.users ?? {
      id: client.user_id,
      first_name: client.first_name,
      last_name: client.last_name,
      email: null,
    };

    // if user doesn't exist (not approved), we fill fields from client_info table
    const user = this.mapToUser({
      id: userData.id ?? client.user_id,
      firstname: userData.first_name,
      lastname: userData.last_name,
      email: userData.email,
      created_at: client.created_at ?? null,
      updated_at: client.updated_at ?? null,
      role: 'client',
    })

    return new Client(
      user,
      client.service_needed,
      new Date(client.requested),
      new Date(client.updated_at),
      client.status
    )
  }
}