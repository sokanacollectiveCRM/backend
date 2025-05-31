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
      bio: this.bio
    };
  }
}