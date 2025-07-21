import {
    ClientAgeRange,
    HomeType,
    IncomeLevel,
    Pronouns,
    ProviderType,
    RelationshipStatus,
    RequestStatus,
    ServiceTypes,
    STATE
} from '../types';

export class RequestForm {
  public id?: string;
  public status?: RequestStatus; // Remove default value
  public user_id?: string;
  public created_at?: Date;
  public updated_at?: Date;
  public requested?: string;
  
  constructor(
    // Step 1: Client Details (Required)
    public firstname: string,
    public lastname: string,
    public email: string,
    public phone_number: string,
    public service_needed: ServiceTypes,
    
    // Step 2: Home Details (Required)
    public address: string,
    public city: string,
    public state: STATE,
    public zip_code: string,
    
    // Step 1: Client Details (Optional)
    public pronouns?: Pronouns,
    public pronouns_other?: string,
    public children_expected?: string,
    
    // Step 2: Home Details (Optional)
    public home_phone?: string,
    public home_type?: HomeType,
    public home_access?: string,
    public pets?: string,
    
    // Step 3: Family Members
    public relationship_status?: RelationshipStatus,
    public first_name?: string,
    public last_name?: string,
    public middle_name?: string,
    public mobile_phone?: string,
    public work_phone?: string,
    
    // Step 4: Referral
    public referral_source?: string,
    public referral_name?: string,
    public referral_email?: string,
    
    // Step 5: Health History
    public health_history?: string,
    public allergies?: string,
    public health_notes?: string,
    
    // Step 6: Payment Info (Optional)
    public annual_income?: IncomeLevel,
    public service_specifics?: string,
    
    // Step 7: Pregnancy/Baby
    public due_date?: Date,
    public birth_location?: string,
    public birth_hospital?: string,
    public number_of_babies?: number,
    public baby_name?: string,
    public provider_type?: ProviderType,
    public pregnancy_number?: number,
    public hospital?: string,
    public baby_sex?: string,
    
    // Step 8: Past Pregnancies
    public had_previous_pregnancies?: boolean,
    public previous_pregnancies_count?: number,
    public living_children_count?: number,
    public past_pregnancy_experience?: string,
    
    // Step 9: Services Interested
    public services_interested?: string[],
    public service_support_details?: string,
    
    // Step 10: Client Demographics (Optional)
    public race_ethnicity?: string,
    public primary_language?: string,
    public client_age_range?: ClientAgeRange,
    public insurance?: string,
    public demographics_multi?: string[]
  ) {}
}