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

  async findClientsLiteAll(): Promise<Client[]> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        id,
        firstname,
        lastname,
        email,
        status,
        service_needed,
        requested,
        updated_at,
        users (
          firstname,
          lastname,
          profile_picture
        )
      `);

    if (error) throw new Error(error.message);
    return data.map(row => this.mapToClient(row));
  }

  async exportCSV():Promise<string | null>{
    const {data,error} = await this.supabaseClient
    .from('client_info')
    .select('firstname,lastname,zip_code,annual_income,pronouns')
    .csv()

    if(error || !data){
      throw new Error(`Failed to fetch CSV Data ${error.message}`);
    }
    return data;
  }

  async findClientsLiteByDoula(userId: string): Promise<Client[]> {
    const clientIds = await this.getClientIdsAssignedToDoula(userId);
    
    if (clientIds.length === 0) {
      console.log("clientIDs.length is 0");
      return [];
    }
    // console.log("clientIds is ", clientIds);

    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        id,
        firstname,
        lastname,
        email,
        status,
        users (
          firstname,
          lastname,
          profile_picture
        )
      `)
      .in('id', clientIds);


    if (error) throw new Error(error.message);
    return data.map(user => this.mapToClient(user));
  }

  async findClientsDetailedAll(): Promise<Client[]> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users (
          *
        )
        `);
        
        if (error) throw new Error(error.message);
        return data.map(user => this.mapToClient(user));
      }
      
      async findClientsDetailedByDoula(userId: string): Promise<Client[]> {
        const clientIds = await this.getClientIdsAssignedToDoula(userId);
        
        if (clientIds.length === 0) return [];
        
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users (
          *
        )
      `)
      .in('id', clientIds);

    if (error) throw new Error(error.message);
    // return data.map(this.mapToClient);
    return data.map(user => this.mapToClient(user));
  }
  
  async findClientLiteById(clientId: string): Promise<Client> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        id,
        firstname,
        lastname,
        email,
        status,
        users (
          firstname,
          lastname,
          profile_picture
        )
      `)
      .eq('id', clientId)
      .single();

    if (error) throw new Error(error.message);
    return this.mapToClient(data);
  }

  async findClientDetailedById(clientId: string): Promise<Client> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users (*)
      `)
      .eq('id', clientId)
      .single();

    if (error) throw new Error(error.message);
    return this.mapToClient(data);
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

  // Helper to find client id's for a given doula
  private async getClientIdsAssignedToDoula(doulaId: string): Promise<string[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId);

    if (error) throw new Error(error.message);
    return data.map(entry => entry.client_id);
  }

  // Helper to map database user to domain User
  private mapToUser(data: any): User {
    return new User({
      id: data.id,
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
      bio: data.bio,
      children_expected: data.children_expected,
      service_needed: data.service_needed,
      health_history: data.health_history,
      allergies: data.allergies,
      due_date: data.due_date,
      annual_income:data.annual_income,
      status: data.status,
      hospital:data.hospital,

    });
  }

  private mapToClient(data: any): Client {
    const userRecord = data.users ?? {};

    const user = this.mapToUser({
      id: userRecord.id || data.user_id || data.id,
      email: userRecord.email || data.email || '',
      firstname: userRecord.firstname || data.firstname || '',
      lastname: userRecord.lastname || data.lastname || '',
      created_at: userRecord.created_at || data.created_at,
      updated_at: userRecord.updated_at || data.updated_at,
      role: userRecord.role || 'client',
      address: userRecord.address || data.address || '',
      city: userRecord.city || data.city || '',
      state: userRecord.state || data.state || '',
      country: userRecord.country || data.country || '',
      zip_code: userRecord.zip_code || data.zip_code || '',
      profile_picture: userRecord.profile_picture || '',
      account_status: userRecord.account_status || null,
      business: userRecord.business || null,
      bio: userRecord.bio || '',
      children_expected: userRecord.children_expected || data.children_expected || '',
      service_needed: userRecord.service_needed || data.service_needed || '',
      health_history: userRecord.health_history || data.health_history || '',
      allergies: userRecord.allergies || data.allergies || '',
      due_date: userRecord.due_date || data.due_date || '',
      annual_income: userRecord.annual_income || data.annual_income || '',
      status: userRecord.status || data.status || '',
      hospital: userRecord.hospital || data.hospital|| ''


    });

    return new Client(
      data.id,
      user,
      data.service_needed ?? null,
      data.requested ? new Date(data.requested) : null,
      data.updated_at ? new Date(data.updated_at) : new Date(),
      data.status ?? 'lead',

      // Optional detailed fields
      data.children_expected ?? undefined,
      data.pronouns ?? undefined,
      data.health_history ?? undefined,
      data.allergies ?? undefined,
      data.due_date ? new Date(data.due_date) : undefined,
      data.hospital ?? undefined,
      data.baby_sex ?? undefined,
      data.annual_income ?? undefined,
      data.service_specifics ?? undefined
    );
  }
}