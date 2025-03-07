import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY) 

export class RequestFormRepository{
    async saveData(formData){
        try {
            const {data,error } = await supabase 
             .from('user_requests') // this will take whatever table we store this data in, not sure if we should have a seperate requests table
             .insert([
                {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone_number: formData.phone_number,
                    children_expected: formData.children_expected,
                    service_needed: formData.service_needed
                }
            ]);

        if (error) {
            throw new Error(error.message);
        }

        console.log('Form saved successfully:', data);

        } catch (error) {
            console.error(error)
        }
    }

}