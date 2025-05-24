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
      this.address = data.address || "";
      this.city = data.city || "";
      this.state = data.state || STATE.IL;
      this.country = data.country || "";
      this.zip_code = data.zip_code || -1;
      this.profile_picture = data.profile_picture || null;
      this.account_status = data.account_status || ACCOUNT_STATUS.PENDING; 
      this.business = data.business || "";
      this.bio = data.bio || "";    
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