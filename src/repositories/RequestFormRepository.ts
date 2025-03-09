import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY) 

export class RequestFormRepository{
    async saveData(formData){
        try {
            console.log(" Attempting to insert form data:", formData);
            const {data,error } = await supabase 
             .from('client_request_form') 
             .insert([
                {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone_number: formData.phone_number,
                    children_expected: formData.children_expected,
                    service_needed: formData.service_needed,
                    pronouns: formData.pronouns,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip_code: formData.zip_code,
                    health_history: formData.health_history,
                    allergies: formData.allergies,
                    due_date: formData.due_date,
                    hospital: formData.hospital,
                    baby_sex: formData.baby_sex,
                    annual_income: formData.annual_income,
                    service_specifics: formData.service_specifics,
                }
            ])

        if (error) {
            console.error("Supabase insert error:", error);
            throw new Error("Database insertion failed: " + error.message);        
        }

        console.log('Form saved successfully:', data);
        return data;


        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getRequestById(requestId: number) {
        const { data, error } = await supabase
            .from('client_request_form')
            .select('*')
            .eq('id', requestId)
            .single();
    
        if (error) {
            console.error("Failed to fetch request:", error);
            throw new Error("Failed to fetch request: " + error.message);
        }
    
        return data;
    }
    
    async getAllPendingRequests() {
        const { data, error } = await supabase
            .from('client_request_form')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
    
        if (error) {
            console.error("Failed to fetch pending requests:", error);
            throw new Error("Failed to fetch pending requests: " + error.message);
        }
    
        return data;
    }
    
    async updateRequestStatus(requestId: number, status: 'pending' | 'approved' | 'rejected') {
        const { data, error } = await supabase
            .from('client_request_form')
            .update({ status: status, created_at: new Date() })
            .eq('id', requestId)
            .select()
            .single();
    
        if (error) {
            console.error("Failed to update request status:", error);
            throw new Error("Failed to update request status: " + error.message);
        }
    
        return data;
    }
}