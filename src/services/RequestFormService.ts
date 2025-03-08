import { RequestForm, ServiceTypes, Pronouns, Sex, IncomeLevel } from "../entities/RequestForm";
import { RequestFormRepository } from "../repositories/RequestFormRepository";
import { ValidationError } from "../domainErrors";

export class RequestFormService {
  private repository: RequestFormRepository;

  constructor() {
    this.repository = new RequestFormRepository();
  }

  async newForm(formData: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    children_expected: number;
    service_needed: ServiceTypes;
    pronouns: Pronouns;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    health_history: string;
    allergies: string;
    due_date: Date;
    hopsital: string;
    baby_sex: Sex;
    annual_income: IncomeLevel;
  }): Promise<RequestForm> {
    // Validate required fields
    if (!formData.first_name || !formData.last_name || !formData.service_needed) {
      throw new ValidationError("Missing required fields: name and service type");
    }
    
    if (!formData.email || !formData.email.includes('@')) {
      throw new ValidationError("Valid email is required");
    }
    
    if (!formData.phone_number) {
      throw new ValidationError("Phone number is required");
    }

    // Create request form entity
    const requestForm = new RequestForm(
      formData.first_name,
      formData.last_name,
      formData.email,
      formData.phone_number,
      formData.children_expected,
      formData.service_needed
    );

    // Save to repository
    await this.repository.saveData(requestForm);
    
    return requestForm;
  }
}