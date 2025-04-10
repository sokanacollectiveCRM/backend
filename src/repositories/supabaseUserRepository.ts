// infrastructure/repositories/SupabaseUserRepository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { User } from 'entities/User';
import { userInfo } from 'os';
import { UserRepository } from 'repositories/interface/userRepository';
import { ROLE } from 'types';
import { UserData } from 'types';

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
      .select('first_name, last_name, service_needed, requested, updated_at, status');

    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    return data.map((client) => ({
      firstName: client.first_name,
      lastName: client.last_name,
      serviceNeeded: client.service_needed,
      requestedAt: new Date(client.requested), // Ensure it's a Date object
      updatedAt: new Date(client.updated_at), // Ensure it's a Date object
      status: client.status,
    }));
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

  async update(user): Promise<void> {

    console.assert(user.id !== undefined, "paramter `user` does not have an id, which is required for this function");
    const updateData: UserData = {};

    // soooo we want to only update if it exists in the database so this is a workaround
    if (user.username !== undefined) updateData.username = user.username;
    if (user.email !== undefined) updateData.email = user.email;
    if (user.firstname !== undefined) updateData.firstname = user.firstname;
    if (user.lastname !== undefined) updateData.lastname = user.lastname;
    if (user.updated_at !== undefined) updateData.updated_at = user.updated_at;
    if (user.role !== undefined) updateData.role = user.role;
    if (user.address !== undefined) updateData.address = user.address;
    if (user.city !== undefined) updateData.city = user.city;
    if (user.state !== undefined) updateData.state = user.state;
    if (user.country !== undefined) updateData.country = user.country;
    if (user.zip_code !== undefined) updateData.zip_code = user.zip_code;
    if (user.profile_picture !== undefined) updateData.profile_picture = user.profile_picture;
    if (user.account_status !== undefined) updateData.account_status = user.account_status;
    if (user.business !== undefined) updateData.business = user.business;
    if (user.bio !== undefined) updateData.bio = user.bio;

    const { data, error } = await this.supabaseClient
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.log("error updating user", error);
      throw new Error(error.message);
    }
    // return this.mapToUser(data);
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
}