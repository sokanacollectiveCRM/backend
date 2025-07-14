import { ValidationError } from "../domains/errors";
import { RequestForm } from '../entities/RequestForm';
import { RequestFormRepository } from "../repositories/requestFormRepository";
import {
    RequestFormData,
    RequestFormResponse,
    RequestStatus
} from "../types";

export class RequestFormService {
  private repository: RequestFormRepository;

  constructor(requestFormRepository: RequestFormRepository) {
    this.repository = requestFormRepository;
  }

  async createRequest(formData: RequestFormData): Promise<RequestFormResponse> {
    // Validate required fields
    if (!formData.firstname || !formData.lastname) {
      throw new ValidationError("Missing required fields: first name and last name");
    }

    if (!formData.service_needed) {
      throw new ValidationError("Missing required field: service_needed");
    }
    
    if (!formData.email || !formData.email.includes('@')) {
      throw new ValidationError("Valid email is required");
    }
    
    if (!formData.phone_number) {
      throw new ValidationError("Phone number is required");
    }

    if (!formData.address || !formData.city || !formData.state || !formData.zip_code) {
      throw new ValidationError("Complete address is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
      throw new ValidationError("Invalid phone number format");
    }

    // Validate zip code format
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(formData.zip_code)) {
      throw new ValidationError("Invalid zip code format");
    }

    // Save to repository (no userId)
    return await this.repository.saveData(formData);
  }

  async getUserRequests(userId: string): Promise<RequestFormResponse[]> {
    return await this.repository.getUserRequests(userId);
  }

  async getRequestById(requestId: string, userId: string): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestById(requestId, userId);
  }

  async getAllRequests(): Promise<RequestFormResponse[]> {
    return await this.repository.getAllRequests();
  }

  async getRequestByIdAdmin(requestId: string): Promise<RequestFormResponse | null> {
    return await this.repository.getRequestByIdAdmin(requestId);
  }

  async updateRequestStatus(requestId: string, status: RequestStatus): Promise<RequestFormResponse> {
    // Validate status
    const validStatuses = Object.values(RequestStatus);
    if (!validStatuses.includes(status)) {
      throw new ValidationError("Invalid status value");
    }

    return await this.repository.updateRequestStatus(requestId, status);
  }

  // Updated method to handle all 10-step form fields
  async newForm(formData: any): Promise<RequestForm> {
    try {
      // Validate required fields
      if (!formData.firstname || !formData.lastname) {
        throw new ValidationError("Missing required fields: first name and last name");
      }

      if (!formData.service_needed) {
        throw new ValidationError("Missing required field: service_needed");
      }
      
      if (!formData.email || !formData.email.includes('@')) {
        throw new ValidationError("Valid email is required");
      }
      
      if (!formData.phone_number) {
        throw new ValidationError("Phone number is required");
      }

      if (!formData.address || !formData.city || !formData.state || !formData.zip_code) {
        throw new ValidationError("Complete address is required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new ValidationError("Invalid email format");
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone_number.replace(/[\s\-\(\)]/g, ''))) {
        throw new ValidationError("Invalid phone number format");
      }

      // Validate zip code format
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(formData.zip_code)) {
        throw new ValidationError("Invalid zip code format");
      }

      // Convert to RequestFormData format
      const newFormData: RequestFormData = {
        // Step 1: Client Details
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        phone_number: formData.phone_number,
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
        demographics_multi: formData.demographics_multi
      };

      // Save to repository (no userId)
      const response = await this.repository.saveData(newFormData);
      
      // Convert response back to old format for backward compatibility
      return new RequestForm(
        response.firstname,
        response.lastname,
        response.email,
        response.phone_number,
        response.service_needed,
        response.address,
        response.city,
        response.state,
        response.zip_code
      );
    } catch (error) {
      console.error("Error in newForm:", error);
      throw error;
    }
  }
}