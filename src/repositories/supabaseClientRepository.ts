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
        *,
        users!user_id (*)
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

  /**
   * Get clients by status
   */
  async findClientsByStatus(status: string): Promise<Client[]> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users!user_id (*)
      `)
      .eq('status', status);

    if (error) {
      throw new Error(`Failed to fetch clients by status: ${error.message}`);
    }

    return data.map(row => this.mapToClient(row));
  }

  /**
   * Find a client by ID (uses lite version)
   */
  async findById(clientId: string): Promise<Client | null> {
    try {
      return await this.findClientLiteById(clientId);
    } catch (error: any) {
      if (error.message?.includes('No rows')) {
        return null;
      }
      throw error;
    }
  }

  async findClientsLiteByDoula(userId: string): Promise<Client[]> {
    const clientIds = await this.getClientIdsAssignedToDoula(userId);

    if (clientIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users!user_id (*)
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
        users!user_id (
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
        users!user_id (
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
        *,
        users!user_id (*)
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
        users!user_id (*)
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
        phone_number,
        service_needed,
        requested,
        updated_at,
        status,
        user_id,
        users!user_id (
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

  async updateClient(clientId: string, fieldsToUpdate: any): Promise<Client> {
    // Map request body fields to database column names
    const updateData: any = {};

    // Map the fields from the request body to database columns
    // Handle nested user object fields
    if (fieldsToUpdate.user?.firstname !== undefined) updateData.firstname = fieldsToUpdate.user.firstname;
    if (fieldsToUpdate.user?.lastname !== undefined) updateData.lastname = fieldsToUpdate.user.lastname;
    if (fieldsToUpdate.user?.email !== undefined) updateData.email = fieldsToUpdate.user.email;
    if (fieldsToUpdate.user?.role !== undefined) updateData.role = fieldsToUpdate.user.role;

    // Handle direct field mappings from request body (top-level fields)
    if (fieldsToUpdate.firstname !== undefined) updateData.firstname = fieldsToUpdate.firstname;
    if (fieldsToUpdate.lastname !== undefined) updateData.lastname = fieldsToUpdate.lastname;
    if (fieldsToUpdate.email !== undefined) updateData.email = fieldsToUpdate.email;
    if (fieldsToUpdate.phoneNumber !== undefined) updateData.phone_number = fieldsToUpdate.phoneNumber;
    if (fieldsToUpdate.phone_number !== undefined) updateData.phone_number = fieldsToUpdate.phone_number;
    if (fieldsToUpdate.status !== undefined) updateData.status = fieldsToUpdate.status;
    if (fieldsToUpdate.serviceNeeded !== undefined) updateData.service_needed = fieldsToUpdate.serviceNeeded;
    if (fieldsToUpdate.childrenExpected !== undefined) updateData.children_expected = fieldsToUpdate.childrenExpected;
    if (fieldsToUpdate.pronouns !== undefined) updateData.pronouns = fieldsToUpdate.pronouns;
    if (fieldsToUpdate.health_history !== undefined) updateData.health_history = fieldsToUpdate.health_history;
    if (fieldsToUpdate.allergies !== undefined) updateData.allergies = fieldsToUpdate.allergies;
    if (fieldsToUpdate.due_date !== undefined) updateData.due_date = fieldsToUpdate.due_date;
    if (fieldsToUpdate.hospital !== undefined) updateData.hospital = fieldsToUpdate.hospital;
    if (fieldsToUpdate.annual_income !== undefined) updateData.annual_income = fieldsToUpdate.annual_income;
    if (fieldsToUpdate.service_specifics !== undefined) updateData.service_specifics = fieldsToUpdate.service_specifics;

    // Add ALL the missing fields that can be updated
    if (fieldsToUpdate.preferred_contact_method !== undefined) updateData.preferred_contact_method = fieldsToUpdate.preferred_contact_method;
    if (fieldsToUpdate.preferred_name !== undefined) updateData.preferred_name = fieldsToUpdate.preferred_name;
    if (fieldsToUpdate.payment_method !== undefined) updateData.payment_method = fieldsToUpdate.payment_method;  // Add this field
    if (fieldsToUpdate.home_type !== undefined) updateData.home_type = fieldsToUpdate.home_type;
    if (fieldsToUpdate.services_interested !== undefined) updateData.services_interested = fieldsToUpdate.services_interested;
    if (fieldsToUpdate.health_notes !== undefined) updateData.health_notes = fieldsToUpdate.health_notes;
    if (fieldsToUpdate.baby_sex !== undefined) updateData.baby_sex = fieldsToUpdate.baby_sex;
    if (fieldsToUpdate.baby_name !== undefined) updateData.baby_name = fieldsToUpdate.baby_name;
    if (fieldsToUpdate.birth_hospital !== undefined) updateData.birth_hospital = fieldsToUpdate.birth_hospital;
    if (fieldsToUpdate.birth_location !== undefined) updateData.birth_location = fieldsToUpdate.birth_location;
    if (fieldsToUpdate.number_of_babies !== undefined) updateData.number_of_babies = fieldsToUpdate.number_of_babies;
    if (fieldsToUpdate.provider_type !== undefined) updateData.provider_type = fieldsToUpdate.provider_type;
    if (fieldsToUpdate.pregnancy_number !== undefined) updateData.pregnancy_number = fieldsToUpdate.pregnancy_number;
    if (fieldsToUpdate.had_previous_pregnancies !== undefined) updateData.had_previous_pregnancies = fieldsToUpdate.had_previous_pregnancies;
    if (fieldsToUpdate.previous_pregnancies_count !== undefined) updateData.previous_pregnancies_count = fieldsToUpdate.previous_pregnancies_count;
    if (fieldsToUpdate.living_children_count !== undefined) updateData.living_children_count = fieldsToUpdate.living_children_count;
    if (fieldsToUpdate.past_pregnancy_experience !== undefined) updateData.past_pregnancy_experience = fieldsToUpdate.past_pregnancy_experience;
    if (fieldsToUpdate.service_support_details !== undefined) updateData.service_support_details = fieldsToUpdate.service_support_details;
    if (fieldsToUpdate.race_ethnicity !== undefined) updateData.race_ethnicity = fieldsToUpdate.race_ethnicity;
    if (fieldsToUpdate.primary_language !== undefined) updateData.primary_language = fieldsToUpdate.primary_language;
    if (fieldsToUpdate.client_age_range !== undefined) updateData.client_age_range = fieldsToUpdate.client_age_range;
    if (fieldsToUpdate.insurance !== undefined) updateData.insurance = fieldsToUpdate.insurance;
    if (fieldsToUpdate.demographics_multi !== undefined) updateData.demographics_multi = fieldsToUpdate.demographics_multi;
    if (fieldsToUpdate.pronouns_other !== undefined) updateData.pronouns_other = fieldsToUpdate.pronouns_other;
    if (fieldsToUpdate.home_phone !== undefined) updateData.home_phone = fieldsToUpdate.home_phone;
    if (fieldsToUpdate.home_access !== undefined) updateData.home_access = fieldsToUpdate.home_access;
    if (fieldsToUpdate.pets !== undefined) updateData.pets = fieldsToUpdate.pets;
    if (fieldsToUpdate.relationship_status !== undefined) updateData.relationship_status = fieldsToUpdate.relationship_status;
    if (fieldsToUpdate.first_name !== undefined) updateData.first_name = fieldsToUpdate.first_name;
    if (fieldsToUpdate.last_name !== undefined) updateData.last_name = fieldsToUpdate.last_name;
    if (fieldsToUpdate.middle_name !== undefined) updateData.middle_name = fieldsToUpdate.middle_name;
    if (fieldsToUpdate.mobile_phone !== undefined) updateData.mobile_phone = fieldsToUpdate.mobile_phone;
    if (fieldsToUpdate.work_phone !== undefined) updateData.work_phone = fieldsToUpdate.work_phone;
    if (fieldsToUpdate.referral_source !== undefined) updateData.referral_source = fieldsToUpdate.referral_source;
    if (fieldsToUpdate.referral_name !== undefined) updateData.referral_name = fieldsToUpdate.referral_name;
    if (fieldsToUpdate.referral_email !== undefined) updateData.referral_email = fieldsToUpdate.referral_email;
    if (fieldsToUpdate.address !== undefined) updateData.address = fieldsToUpdate.address;
    if (fieldsToUpdate.city !== undefined) updateData.city = fieldsToUpdate.city;
    if (fieldsToUpdate.state !== undefined) updateData.state = fieldsToUpdate.state;
    if (fieldsToUpdate.country !== undefined) updateData.country = fieldsToUpdate.country;
    if (fieldsToUpdate.zip_code !== undefined) updateData.zip_code = fieldsToUpdate.zip_code;
    if (fieldsToUpdate.profile_picture !== undefined) updateData.profile_picture = fieldsToUpdate.profile_picture;
    if (fieldsToUpdate.account_status !== undefined) updateData.account_status = fieldsToUpdate.account_status;
    if (fieldsToUpdate.business !== undefined) updateData.business = fieldsToUpdate.business;
    if (fieldsToUpdate.bio !== undefined) updateData.bio = fieldsToUpdate.bio;

    // Check if client exists first
    const { data: existingClient, error: checkError } = await this.supabaseClient
      .from('client_info')
      .select('id, firstname, lastname, phone_number')
      .eq('id', clientId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Error checking client existence: ${checkError.message}`);
    }

    if (!existingClient) {
      throw new Error(`Client not found with ID: ${clientId}`);
    }

    // Perform the update
    const { data: updateResult, error: updateError } = await this.supabaseClient
      .from('client_info')
      .update(updateData)
      .eq('id', clientId);

    if (updateError) {
      throw new Error(`Failed to update client: ${updateError.message}`);
    }

    // Fetch the updated client data
    const { data, error: fetchError } = await this.supabaseClient
      .from('client_info')
      .select(`
        *,
        users!user_id (*)
      `)
      .eq('id', clientId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated client: ${fetchError.message}`);
    }

    if (!data) {
      throw new Error(`No data returned after update for client ID: ${clientId}`);
    }

    return this.mapToClient(data);
  }

  async deleteClient(clientId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('client_info')
      .delete()
      .eq('id', clientId);
    if (error) throw new Error(error.message);
  }

  // Helper to find client id's for a given doula
  private async getClientIdsAssignedToDoula(doulaId: string): Promise<string[]> {
    const { data, error } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)
      .eq('status', 'active'); // Only get active assignments

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
      annual_income: data.annual_income,
      status: data.status,
      hospital: data.hospital,
      // Add missing fields that were causing the issue
      preferred_contact_method: data.preferred_contact_method,
      preferred_name: data.preferred_name,
      pronouns: data.pronouns,
      home_type: data.home_type,
      services_interested: data.services_interested,
      phone_number: data.phone_number,
      health_notes: data.health_notes,
      service_specifics: data.service_specifics,
      baby_sex: data.baby_sex,
      baby_name: data.baby_name,
      birth_hospital: data.birth_hospital,
      birth_location: data.birth_location,
      number_of_babies: data.number_of_babies,
      provider_type: data.provider_type,
      pregnancy_number: data.pregnancy_number,
      had_previous_pregnancies: data.had_previous_pregnancies,
      previous_pregnancies_count: data.previous_pregnancies_count,
      living_children_count: data.living_children_count,
      past_pregnancy_experience: data.past_pregnancy_experience,
      service_support_details: data.service_support_details,
      race_ethnicity: data.race_ethnicity,
      primary_language: data.primary_language,
      client_age_range: data.client_age_range,
      insurance: data.insurance,
      demographics_multi: data.demographics_multi,
      pronouns_other: data.pronouns_other,
      home_phone: data.home_phone,
      home_access: data.home_access,
      pets: data.pets,
      relationship_status: data.relationship_status,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: data.middle_name,
      mobile_phone: data.mobile_phone,
      work_phone: data.work_phone,
      referral_source: data.referral_source,
      referral_name: data.referral_name,
      referral_email: data.referral_email
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
      hospital: userRecord.hospital || data.hospital|| '',

      // Add all the missing fields from data
      preferred_contact_method: userRecord.preferred_contact_method || data.preferred_contact_method,
      preferred_name: userRecord.preferred_name || data.preferred_name,
      payment_method: userRecord.payment_method || data.payment_method,  // Add this field
      pronouns: userRecord.pronouns || data.pronouns,
      home_type: userRecord.home_type || data.home_type,
      services_interested: userRecord.services_interested || data.services_interested,
      phone_number: userRecord.phone_number || data.phone_number,
      health_notes: userRecord.health_notes || data.health_notes,
      service_specifics: userRecord.service_specifics || data.service_specifics,
      baby_sex: userRecord.baby_sex || data.baby_sex,
      baby_name: userRecord.baby_name || data.baby_name,
      birth_hospital: userRecord.birth_hospital || data.birth_hospital,
      birth_location: userRecord.birth_location || data.birth_location,
      number_of_babies: userRecord.number_of_babies || data.number_of_babies,
      provider_type: userRecord.provider_type || data.provider_type,
      pregnancy_number: userRecord.pregnancy_number || data.pregnancy_number,
      had_previous_pregnancies: userRecord.had_previous_pregnancies || data.had_previous_pregnancies,
      previous_pregnancies_count: userRecord.previous_pregnancies_count || data.previous_pregnancies_count,
      living_children_count: userRecord.living_children_count || data.living_children_count,
      past_pregnancy_experience: userRecord.past_pregnancy_experience || data.past_pregnancy_experience,
      service_support_details: userRecord.service_support_details || data.service_support_details,
      race_ethnicity: userRecord.race_ethnicity || data.race_ethnicity,
      primary_language: userRecord.primary_language || data.primary_language,
      client_age_range: userRecord.client_age_range || data.client_age_range,
      insurance: userRecord.insurance || data.insurance,
      demographics_multi: userRecord.demographics_multi || data.demographics_multi,
      pronouns_other: userRecord.pronouns_other || data.pronouns_other,
      home_phone: userRecord.home_phone || data.home_phone,
      home_access: userRecord.home_access || data.home_access,
      pets: userRecord.pets || data.pets,
      relationship_status: userRecord.relationship_status || data.relationship_status,
      first_name: userRecord.first_name || data.first_name,
      last_name: userRecord.last_name || data.last_name,
      middle_name: userRecord.middle_name || data.middle_name,
      mobile_phone: userRecord.mobile_phone || data.mobile_phone,
      work_phone: userRecord.work_phone || data.work_phone,
      referral_source: userRecord.referral_source || data.referral_source,
      referral_name: userRecord.referral_name || data.referral_name,
      referral_email: userRecord.referral_email || data.referral_email
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
      data.service_specifics ?? undefined,
      data.phone_number ?? undefined, // Add phone number mapping
      data.portal_status ?? undefined // Portal invite status
    );
  }
}
