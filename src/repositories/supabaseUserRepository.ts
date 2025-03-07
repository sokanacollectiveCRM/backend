// infrastructure/repositories/SupabaseUserRepository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { User } from 'entities/User';
import { UserRepository } from 'repositories/interface/userRepository';

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
  
  async findByUsername(username: string): Promise<User | null> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return this.mapToUser(data);
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
      createdAt: new Date(data.created_at || Date.now()),
      updatedAt: new Date(data.updated_at || Date.now())
    });
  }
}