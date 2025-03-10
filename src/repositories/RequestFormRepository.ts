import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY) 



export class RequestFormRepository{
    async saveData(formData){
        try {
            console.log(" Attempting to insert form data:", formData);
            const {data,error } = await supabase 
             .from('requests') 
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

}