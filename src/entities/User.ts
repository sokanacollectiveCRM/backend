import { ACCOUNT_STATUS, ROLE, STATE } from '../types';

export class User {
  id: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  created_at?: Date;
  updated_at?: Date;
  role?: ROLE;
  address?: string;
  city?: string;
  state?: STATE;
  country?: string;
  zip_code?: number;
  children_expected?:string;
  pronouns?:string;
  health_history?:string;
  allergies?:string;
  due_date?:string;
  annual_income?:string;
  status?:string;
  hospital?:string;
  service_needed?:string;
  profile_picture?: File;
  account_status?: ACCOUNT_STATUS;
  business?: string;
  bio?: string;

  // Add all the missing fields that were causing the issue
  preferred_contact_method?: string;
  preferred_name?: string;
  payment_method?: string;  // Add this field
  home_type?: string;
  services_interested?: string[];
  phone_number?: string;
  health_notes?: string;
  service_specifics?: string;
  baby_sex?: string;
  baby_name?: string;
  birth_hospital?: string;
  birth_location?: string;
  number_of_babies?: number;
  provider_type?: string;
  pregnancy_number?: number;
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;
  service_support_details?: string;
  race_ethnicity?: string;
  primary_language?: string;
  client_age_range?: string;
  insurance?: string;
  demographics_multi?: string[];
  pronouns_other?: string;
  home_phone?: string;
  home_access?: string;
  pets?: string;
  relationship_status?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  mobile_phone?: string;
  work_phone?: string;
  referral_source?: string;
  referral_name?: string;
  referral_email?: string;

  constructor(data: {
    id?: string;
    email?: string;
    firstname?: string;
    lastname?: string;
    created_at?: Date;
    updated_at?: Date;
    role?: ROLE;
    address?: string;
    children_expected?:string;
    service_needed?:string;
    pronouns?:string;
    health_history?:string;
    allergies?:string;
    due_date?:string;
    annual_income?:string;
    status?:string;
    hospital?:string;
    city?: string;
    state?: STATE;
    country?: string;
    zip_code?: number;
    profile_picture?: File;
    account_status?: ACCOUNT_STATUS;
    business?: string;
    bio?: string;

    // Add all the missing fields that were causing the issue
    preferred_contact_method?: string;
    preferred_name?: string;
    payment_method?: string;  // Add this field
    home_type?: string;
    services_interested?: string[];
    phone_number?: string;
    health_notes?: string;
    service_specifics?: string;
    baby_sex?: string;
    baby_name?: string;
    birth_hospital?: string;
    birth_location?: string;
    number_of_babies?: number;
    provider_type?: string;
    pregnancy_number?: number;
    had_previous_pregnancies?: boolean;
    previous_pregnancies_count?: number;
    living_children_count?: number;
    past_pregnancy_experience?: string;
    service_support_details?: string;
    race_ethnicity?: string;
    primary_language?: string;
    client_age_range?: string;
    insurance?: string;
    demographics_multi?: string[];
    pronouns_other?: string;
    home_phone?: string;
    home_access?: string;
    pets?: string;
    relationship_status?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    mobile_phone?: string;
    work_phone?: string;
    referral_source?: string;
    referral_name?: string;
    referral_email?: string;
    }) {
      this.id = data.id;
      this.email = data.email || "";
      this.firstname = data.firstname || '';
      this.lastname = data.lastname || '';
      this.created_at = data.created_at || new Date();
      this.updated_at = data.updated_at || new Date();
      this.role = data.role || ROLE.CLIENT;
      this.children_expected = data.children_expected || "";
      this.service_needed = data.service_needed ||"";
      this.health_history = data.health_history || "";
      this.allergies = data.allergies || "";
      this.due_date = data.due_date || "";
      this.annual_income = data.annual_income || "";
      this.status = data.status || "";
      this.hospital = data.hospital || "";
      this.address = data.address || "";
      this.city = data.city || "";
      this.state = data.state || STATE.IL;
      this.country = data.country || "";
      this.zip_code = data.zip_code || -1;
      this.profile_picture = data.profile_picture || null;
      this.account_status = data.account_status || ACCOUNT_STATUS.PENDING;
      this.business = data.business || "";
      this.bio = data.bio || "";
      this.service_needed = data.service_needed || "";

      // Add all the missing fields that were causing the issue
      this.preferred_contact_method = data.preferred_contact_method;
      this.preferred_name = data.preferred_name;
      this.payment_method = data.payment_method;  // Add this field
      this.home_type = data.home_type;
      this.services_interested = data.services_interested;
      this.phone_number = data.phone_number;
      this.health_notes = data.health_notes;
      this.service_specifics = data.service_specifics;
      this.baby_sex = data.baby_sex;
      this.baby_name = data.baby_name;
      this.birth_hospital = data.birth_hospital;
      this.birth_location = data.birth_location;
      this.number_of_babies = data.number_of_babies;
      this.provider_type = data.provider_type;
      this.pregnancy_number = data.pregnancy_number;
      this.had_previous_pregnancies = data.had_previous_pregnancies;
      this.previous_pregnancies_count = data.previous_pregnancies_count;
      this.living_children_count = data.living_children_count;
      this.past_pregnancy_experience = data.past_pregnancy_experience;
      this.service_support_details = data.service_support_details;
      this.race_ethnicity = data.race_ethnicity;
      this.primary_language = data.primary_language;
      this.client_age_range = data.client_age_range;
      this.insurance = data.insurance;
      this.demographics_multi = data.demographics_multi;
      this.pronouns_other = data.pronouns_other;
      this.home_phone = data.home_phone;
      this.home_access = data.home_access;
      this.pets = data.pets;
      this.relationship_status = data.relationship_status;
      this.first_name = data.first_name;
      this.last_name = data.last_name;
      this.middle_name = data.middle_name;
      this.mobile_phone = data.mobile_phone;
      this.work_phone = data.work_phone;
      this.referral_source = data.referral_source;
      this.referral_name = data.referral_name;
      this.referral_email = data.referral_email;
  }

  getFullName(): string {
    return `${this.firstname} ${this.lastname}`.trim();
  }

  toJSON(): object {
    return {
      id: this.id,
      email: this.email,
      firstname: this.firstname,
      lastname: this.lastname,
      fullName: this.getFullName(),
      children_expected: this.children_expected,
      service_needed: this.service_needed,
      health_history: this.health_history,
      allergies: this.allergies,
      due_date:this.due_date,
      annual_income:this.annual_income,
      status:this.status,
      hospital:this.hospital,
      created_at: this.created_at,
      updatedAt: this.updated_at,
      role: this.role,
      address: this.address,
      city: this.city,
      state: this.state,
      country: this.country,
      zip_code: this.zip_code,
      profile_picture: this.profile_picture,
      account_status: this.account_status,
      business: this.business,
      bio: this.bio,

      // Add all the missing fields that were causing the issue
      preferred_contact_method: this.preferred_contact_method,
      preferred_name: this.preferred_name,
      payment_method: this.payment_method,  // Add this field
      home_type: this.home_type,
      services_interested: this.services_interested,
      phone_number: this.phone_number,
      health_notes: this.health_notes,
      service_specifics: this.service_specifics,
      baby_sex: this.baby_sex,
      baby_name: this.baby_name,
      birth_hospital: this.birth_hospital,
      birth_location: this.birth_location,
      number_of_babies: this.number_of_babies,
      provider_type: this.provider_type,
      pregnancy_number: this.pregnancy_number,
      had_previous_pregnancies: this.had_previous_pregnancies,
      previous_pregnancies_count: this.previous_pregnancies_count,
      living_children_count: this.living_children_count,
      past_pregnancy_experience: this.past_pregnancy_experience,
      service_support_details: this.service_support_details,
      race_ethnicity: this.race_ethnicity,
      primary_language: this.primary_language,
      client_age_range: this.client_age_range,
      insurance: this.insurance,
      demographics_multi: this.demographics_multi,
      pronouns_other: this.pronouns_other,
      home_phone: this.home_phone,
      home_access: this.home_access,
      pets: this.pets,
      relationship_status: this.relationship_status,
      first_name: this.first_name,
      last_name: this.last_name,
      middle_name: this.middle_name,
      mobile_phone: this.mobile_phone,
      work_phone: this.work_phone,
      referral_source: this.referral_source,
      referral_name: this.referral_name,
      referral_email: this.referral_email
    };
  }
}
