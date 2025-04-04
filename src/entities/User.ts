import { STATE, ACCOUNT_STATUS, ROLE } from "types";

export class User {
  id: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  createdAt: Date;
  updatedAt: Date;
  role: ROLE;
  address: string;
  city: string;
  state: STATE;
  country: string;
  zip_code: number;
  profile_picture: Buffer;  
  account_status: ACCOUNT_STATUS;
  business: string;
  bio: string;

  constructor(data: {
    id?: string;
    username: string;
    email: string;
    firstname?: string;
    lastname?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: ROLE;
    address?: string;
    city?: string;
    state?: STATE;
    country?: string;
    zip_code?: number;
    profile_picture?: Buffer;
    account_status?: ACCOUNT_STATUS;
    business?: string;
    bio?: string;  
    }) {
      this.id = data.id || crypto.randomUUID();
      this.username = data.username;
      this.email = data.email;
      this.firstname = data.firstname || '';
      this.lastname = data.lastname || '';
      this.createdAt = data.createdAt || new Date();
      this.updatedAt = data.updatedAt || new Date();
      this.role = data.role || ROLE.CLIENT;
      this.address = data.address;
      this.city = data.city;
      this.state = data.state;
      this.country = data.country;
      this.zip_code = data.zip_code;
      this.profile_picture = data.profile_picture;
      this.account_status = data.account_status; 
      this.business = data.business;
      this.bio = data.bio;    
  }

  getFullName(): string {
    return `${this.firstname} ${this.lastname}`.trim();
  }

  toJSON(): object {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      firstname: this.firstname,
      lastname: this.lastname,
      fullName: this.getFullName(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
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