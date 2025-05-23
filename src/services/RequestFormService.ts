import { ValidationError } from "../domains/errors";
import { RequestForm } from '../entities/RequestForm';
import { RequestFormRepository } from "../repositories/requestFormRepository";
import { IncomeLevel, Pronouns, ServiceTypes, Sex } from "../types";

export class RequestFormService {
  private repository: RequestFormRepository;

  constructor(requestFormRepository: RequestFormRepository) {
    this.repository = requestFormRepository;
  }

  async newForm(formData: {
    firstname: string;
    lastname: string;
    email: string;
    phone_number: string;
    children_expected: string;
    service_needed: ServiceTypes;
    pronouns: Pronouns;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    health_history: string;
    allergies: string;
    due_date: Date;
    hospital: string;
    baby_sex: Sex;
    annual_income: IncomeLevel;
    service_specifics: string;
  }): Promise<RequestForm> {
    if (!formData.firstname || !formData.lastname || !formData.service_needed) {
      throw new ValidationError("Missing required fields: first name or last name");
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

    // Create request form entity
    const requestForm = new RequestForm(
      formData.firstname,
      formData.lastname,
      formData.email,
      formData.phone_number,
      formData.children_expected,
      formData.service_needed,
      formData.pronouns, 
      formData.address, 
      formData.city, 
      formData.state, 
      formData.zip_code, 
      formData.health_history, 
      formData.allergies, 
      formData.due_date, 
      formData.hospital, 
      formData.baby_sex, 
      formData.annual_income,
      formData.service_specifics,
    );

    // Save to repository
    await this.repository.saveData(requestForm);
    
    return requestForm;
  }
}