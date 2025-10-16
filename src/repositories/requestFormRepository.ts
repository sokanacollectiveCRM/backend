import { SupabaseClient } from "@supabase/supabase-js";
import { RequestFormData, RequestFormResponse, RequestStatus } from "../types";

export class RequestFormRepository {
    private supabaseClient: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    async saveData(formData: RequestFormData): Promise<RequestFormResponse> {
        try {
            const { data, error } = await this.supabaseClient
                .from('client_info')
                .insert([
                    {
                        // Step 1: Client Details
                        firstname: formData.firstname,
                        lastname: formData.lastname,
                        email: formData.email,
                        phone_number: formData.phone_number,
                        preferred_contact_method: formData.preferred_contact_method,
                        preferred_name: formData.preferred_name,
                        pronouns: formData.pronouns,
                        pronouns_other: formData.pronouns_other,

                        // Step 2: Home Details
                        address: formData.address,
                        city: formData.city,
                        state: formData.state,
                        zip_code: formData.zip_code,
                        home_phone: formData.home_phone,
                        home_type: formData.home_type,
                        home_access: formData.home_access,
                        pets: formData.pets,

                        // Step 3: Family Members
                        relationship_status: formData.relationship_status,
                        first_name: formData.first_name,
                        last_name: formData.last_name,
                        middle_name: formData.middle_name,
                        mobile_phone: formData.mobile_phone,
                        work_phone: formData.work_phone,

                        // Step 4: Referral
                        referral_source: formData.referral_source,
                        referral_name: formData.referral_name,
                        referral_email: formData.referral_email,

                        // Step 5: Health History
                        health_history: formData.health_history,
                        allergies: formData.allergies,
                        health_notes: formData.health_notes,

                        // Step 6: Payment Info
                        payment_method: formData.payment_method,
                        annual_income: formData.annual_income,
                        service_needed: formData.service_needed,
                        service_specifics: formData.service_specifics,

                        // Step 7: Pregnancy/Baby
                        due_date: formData.due_date,
                        birth_location: formData.birth_location,
                        birth_hospital: formData.birth_hospital,
                        number_of_babies: formData.number_of_babies,
                        baby_name: formData.baby_name,
                        provider_type: formData.provider_type,
                        pregnancy_number: formData.pregnancy_number,

                        // Step 8: Past Pregnancies
                        had_previous_pregnancies: formData.had_previous_pregnancies,
                        previous_pregnancies_count: formData.previous_pregnancies_count,
                        living_children_count: formData.living_children_count,
                        past_pregnancy_experience: formData.past_pregnancy_experience,

                        // Step 9: Services Interested
                        services_interested: formData.services_interested,
                        service_support_details: formData.service_support_details,

                        // Step 10: Client Demographics
                        race_ethnicity: formData.race_ethnicity,
                        primary_language: formData.primary_language,
                        client_age_range: formData.client_age_range,
                        insurance: formData.insurance,
                        demographics_multi: formData.demographics_multi,

                        // System fields
                        status: 'lead'
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error("Supabase insert error:", error);
                throw new Error("Database insertion failed: " + error.message);
            }

            console.log('Request form saved successfully:', data);
            return data as RequestFormResponse;

        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getUserRequests(userId: string): Promise<RequestFormResponse[]> {
        try {
            const { data, error } = await this.supabaseClient
                .from('requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase select error:", error);
                throw new Error("Database query failed: " + error.message);
            }

            return data as RequestFormResponse[];
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getRequestById(requestId: string, userId: string): Promise<RequestFormResponse | null> {
        try {
            const { data, error } = await this.supabaseClient
                .from('requests')
                .select('*')
                .eq('id', requestId)
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // No rows returned
                }
                console.error("Supabase select error:", error);
                throw new Error("Database query failed: " + error.message);
            }

            return data as RequestFormResponse;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getAllRequests(): Promise<RequestFormResponse[]> {
        try {
            const { data, error } = await this.supabaseClient
                .from('requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase select error:", error);
                throw new Error("Database query failed: " + error.message);
            }

            return data as RequestFormResponse[];
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getRequestByIdAdmin(requestId: string): Promise<RequestFormResponse | null> {
        try {
            const { data, error } = await this.supabaseClient
                .from('requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // No rows returned
                }
                console.error("Supabase select error:", error);
                throw new Error("Database query failed: " + error.message);
            }

            return data as RequestFormResponse;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async updateRequestStatus(requestId: string, status: RequestStatus): Promise<RequestFormResponse> {
        try {
            const { data, error } = await this.supabaseClient
                .from('requests')
                .update({ status })
                .eq('id', requestId)
                .select()
                .single();

            if (error) {
                console.error("Supabase update error:", error);
                throw new Error("Database update failed: " + error.message);
            }

            return data as RequestFormResponse;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}
