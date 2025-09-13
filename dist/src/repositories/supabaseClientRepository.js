"use strict";
// infrastructure/repositories/SupabaseUserRepository.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseClientRepository = void 0;
const Client_1 = require("../entities/Client");
const User_1 = require("../entities/User");
const types_1 = require("../types");
class SupabaseClientRepository {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }
    async findClientsLiteAll() {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
        id,
        firstname,
        lastname,
        email,
        phone_number,
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
        if (error)
            throw new Error(error.message);
        return data.map(row => this.mapToClient(row));
    }
    async exportCSV() {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select('firstname,lastname,zip_code,annual_income,pronouns')
            .csv();
        if (error || !data) {
            throw new Error(`Failed to fetch CSV Data ${error.message}`);
        }
        return data;
    }
    async findClientsLiteByDoula(userId) {
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
        phone_number,
        status,
        users (
          firstname,
          lastname,
          profile_picture
        )
      `)
            .in('id', clientIds);
        if (error)
            throw new Error(error.message);
        return data.map(user => this.mapToClient(user));
    }
    async findClientsDetailedAll() {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
        *,
        users (
          *
        )
        `);
        if (error)
            throw new Error(error.message);
        return data.map(user => this.mapToClient(user));
    }
    async findClientsDetailedByDoula(userId) {
        const clientIds = await this.getClientIdsAssignedToDoula(userId);
        if (clientIds.length === 0)
            return [];
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
        *,
        users (
          *
        )
      `)
            .in('id', clientIds);
        if (error)
            throw new Error(error.message);
        // return data.map(this.mapToClient);
        return data.map(user => this.mapToClient(user));
    }
    async findClientLiteById(clientId) {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
        id,
        firstname,
        lastname,
        email,
        phone_number,
        status,
        users (
          firstname,
          lastname,
          profile_picture
        )
      `)
            .eq('id', clientId)
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToClient(data);
    }
    async findClientDetailedById(clientId) {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
        *,
        users (*)
      `)
            .eq('id', clientId)
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToClient(data);
    }
    async updateStatus(clientId, status) {
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
        users (
          profile_picture,
          firstname,
          lastname
        )
      `)
            .single();
        if (error) {
            throw new Error(`${error.message}`);
        }
        return this.mapToClient(data);
    }
    async updateClient(clientId, fieldsToUpdate) {
        console.log('Repository: Updating client with ID:', clientId);
        console.log('Repository: Fields to update:', JSON.stringify(fieldsToUpdate, null, 2));
        // Map request body fields to database column names
        const updateData = {};
        // Map the fields from the request body to database columns
        if (fieldsToUpdate.user?.firstname !== undefined)
            updateData.firstname = fieldsToUpdate.user.firstname;
        if (fieldsToUpdate.user?.lastname !== undefined)
            updateData.lastname = fieldsToUpdate.user.lastname;
        if (fieldsToUpdate.user?.email !== undefined)
            updateData.email = fieldsToUpdate.user.email;
        if (fieldsToUpdate.user?.role !== undefined)
            updateData.role = fieldsToUpdate.user.role;
        if (fieldsToUpdate.serviceNeeded !== undefined)
            updateData.service_needed = fieldsToUpdate.serviceNeeded;
        if (fieldsToUpdate.childrenExpected !== undefined)
            updateData.children_expected = fieldsToUpdate.childrenExpected;
        if (fieldsToUpdate.pronouns !== undefined)
            updateData.pronouns = fieldsToUpdate.pronouns;
        if (fieldsToUpdate.health_history !== undefined)
            updateData.health_history = fieldsToUpdate.health_history;
        if (fieldsToUpdate.allergies !== undefined)
            updateData.allergies = fieldsToUpdate.allergies;
        if (fieldsToUpdate.due_date !== undefined)
            updateData.due_date = fieldsToUpdate.due_date;
        if (fieldsToUpdate.hospital !== undefined)
            updateData.hospital = fieldsToUpdate.hospital;
        if (fieldsToUpdate.annual_income !== undefined)
            updateData.annual_income = fieldsToUpdate.annual_income;
        if (fieldsToUpdate.service_specifics !== undefined)
            updateData.service_specifics = fieldsToUpdate.service_specifics;
        // Handle direct field mappings from request body
        if (fieldsToUpdate.firstname !== undefined)
            updateData.firstname = fieldsToUpdate.firstname;
        if (fieldsToUpdate.lastname !== undefined)
            updateData.lastname = fieldsToUpdate.lastname;
        if (fieldsToUpdate.email !== undefined)
            updateData.email = fieldsToUpdate.email;
        if (fieldsToUpdate.phoneNumber !== undefined)
            updateData.phone_number = fieldsToUpdate.phoneNumber;
        if (fieldsToUpdate.phone_number !== undefined)
            updateData.phone_number = fieldsToUpdate.phone_number;
        if (fieldsToUpdate.status !== undefined)
            updateData.status = fieldsToUpdate.status;
        console.log('Repository: phoneNumber field check:', {
            hasPhoneNumber: 'phoneNumber' in fieldsToUpdate,
            phoneNumberValue: fieldsToUpdate.phoneNumber,
            phoneNumberType: typeof fieldsToUpdate.phoneNumber
        });
        console.log('Repository: Mapped update data:', updateData);
        // Check if client exists first
        const { data: existingClient, error: checkError } = await this.supabaseClient
            .from('client_info')
            .select('id, firstname, lastname, phone_number')
            .eq('id', clientId)
            .maybeSingle();
        if (checkError) {
            console.error('Repository: Error checking client existence:', checkError);
            throw new Error(`Error checking client existence: ${checkError.message}`);
        }
        if (!existingClient) {
            console.error('Repository: Client not found with ID:', clientId);
            throw new Error(`Client not found with ID: ${clientId}`);
        }
        console.log('Repository: Found existing client:', existingClient);
        // Perform the update
        const { data: updateResult, error: updateError } = await this.supabaseClient
            .from('client_info')
            .update(updateData)
            .eq('id', clientId);
        if (updateError) {
            console.error('Repository: Update error:', updateError);
            throw new Error(`Failed to update client: ${updateError.message}`);
        }
        console.log('Repository: Update completed, fetching updated data');
        // Fetch the updated client data
        const { data, error: fetchError } = await this.supabaseClient
            .from('client_info')
            .select(`
        *,
        users (*)
      `)
            .eq('id', clientId)
            .single();
        if (fetchError) {
            console.error('Repository: Error fetching updated client:', fetchError);
            throw new Error(`Failed to fetch updated client: ${fetchError.message}`);
        }
        if (!data) {
            console.error('Repository: No data returned after update');
            throw new Error(`No data returned after update for client ID: ${clientId}`);
        }
        console.log('Repository: Raw database response after update:', data);
        console.log('Repository: Update successful, mapping data');
        return this.mapToClient(data);
    }
    async deleteClient(clientId) {
        const { error } = await this.supabaseClient
            .from('client_info')
            .delete()
            .eq('id', clientId);
        if (error)
            throw new Error(error.message);
    }
    // Helper to find client id's for a given doula
    async getClientIdsAssignedToDoula(doulaId) {
        const { data, error } = await this.supabaseClient
            .from('assignments')
            .select('client_id')
            .eq('doula_id', doulaId);
        if (error)
            throw new Error(error.message);
        return data.map(entry => entry.client_id);
    }
    // Helper to map database user to domain User
    mapToUser(data) {
        return new User_1.User({
            id: data.id,
            email: data.email,
            firstname: data.firstname,
            lastname: data.lastname,
            created_at: new Date(data.created_at || Date.now()),
            updated_at: new Date(data.updated_at || Date.now()),
            role: data.role || types_1.ROLE.CLIENT,
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
        });
    }
    mapToClient(data) {
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
            hospital: userRecord.hospital || data.hospital || ''
        });
        return new Client_1.Client(data.id, user, data.service_needed ?? null, data.requested ? new Date(data.requested) : null, data.updated_at ? new Date(data.updated_at) : new Date(), data.status ?? 'lead', 
        // Optional detailed fields
        data.children_expected ?? undefined, data.pronouns ?? undefined, data.health_history ?? undefined, data.allergies ?? undefined, data.due_date ? new Date(data.due_date) : undefined, data.hospital ?? undefined, data.baby_sex ?? undefined, data.annual_income ?? undefined, data.service_specifics ?? undefined, data.phone_number ?? undefined // Add phone number mapping
        );
    }
}
exports.SupabaseClientRepository = SupabaseClientRepository;
