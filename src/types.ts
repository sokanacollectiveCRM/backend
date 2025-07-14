import { Request } from 'express';
import type { File as MulterFile } from 'multer';
import { User } from './entities/User';

export enum ServiceTypes{
  LABOR_SUPPORT = "Labor Support",
  POSTPARTUM_SUPPORT= "Postpartum Support",
  PERINATAL_EDUCATION= "Perinatal Education",
  FIRST_NIGHT = "First Night Care",
  LACTATION_SUPPORT = "Lactation Support",
  PHOTOGRAPHY = "Photography",
  OTHER = "Other"
}

export enum RequestStatus {
  PENDING = "pending",
  REVIEWING = "reviewing",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed"
}

export enum HomeType {
  HOUSE = "House",
  APARTMENT = "Apartment",
  CONDO = "Condo",
  TOWNHOUSE = "Townhouse",
  OTHER = "Other"
}

export enum RelationshipStatus {
  SINGLE = "Single",
  MARRIED = "Married",
  PARTNERED = "Partnered",
  DIVORCED = "Divorced",
  WIDOWED = "Widowed",
  OTHER = "Other"
}

export enum ProviderType {
  OB = "OB",
  MIDWIFE = "Midwife",
  FAMILY_PHYSICIAN = "Family Physician",
  OTHER = "Other"
}

export enum ClientAgeRange {
  UNDER_18 = "Under 18",
  AGE_18_24 = "18-24",
  AGE_25_34 = "25-34",
  AGE_35_44 = "35-44",
  AGE_45_54 = "45-54",
  AGE_55_PLUS = "55+"
}

export enum Pronouns{
  HE_HIM = "he/him",
  SHE_HER = "she/her",
  THEY_THEM = "they/them",
  OTHER = "other",
}

export enum Sex{
  MALE = "Male",
  FEMALE = "Female"
}

export enum IncomeLevel{
  FROM_0_TO_24999 = "$0 - $24,999",
  FROM_25000_TO_44999 = "$25,000 - $44,999",
  FROM_45000_TO_64999 = "$45,000 - $64,999",
  FROM_65000_TO_84999 = "$65,000 - $84,999",
  FROM_85000_TO_99999 = "$85,000 - $99,999",
  ABOVE_100000 = "$100,000 and above"
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface UpdateRequest extends Request {
  user?: User;
  file?: MulterFile;
}

export interface UserData {
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
}

export interface SignupBody {
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface TokenBody {
  access_token: string;
}

export interface PasswordResetBody {
  email: string;
}

export interface UpdatePasswordBody {
  password: string;
}

export interface RequestFormData {
  // Step 1: Client Details
  firstname: string;
  lastname: string;
  email: string;
  phone_number: string;
  pronouns?: Pronouns;
  pronouns_other?: string;
  
  // Step 2: Home Details
  address: string;
  city: string;
  state: STATE;
  zip_code: string;
  home_phone?: string;
  home_type?: HomeType;
  home_access?: string;
  pets?: string;
  
  // Step 3: Family Members
  relationship_status?: RelationshipStatus;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  mobile_phone?: string;
  work_phone?: string;
  
  // Step 4: Referral
  referral_source?: string;
  referral_name?: string;
  referral_email?: string;
  
  // Step 5: Health History
  health_history?: string;
  allergies?: string;
  health_notes?: string;
  
  // Step 6: Payment Info
  annual_income?: IncomeLevel;
  service_needed: ServiceTypes;
  service_specifics?: string;
  
  // Step 7: Pregnancy/Baby
  due_date?: Date;
  birth_location?: string;
  birth_hospital?: string;
  number_of_babies?: number;
  baby_name?: string;
  provider_type?: ProviderType;
  pregnancy_number?: number;
  
  // Step 8: Past Pregnancies
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;
  
  // Step 9: Services Interested
  services_interested?: string[];
  service_support_details?: string;
  
  // Step 10: Client Demographics (Optional)
  race_ethnicity?: string;
  primary_language?: string;
  client_age_range?: ClientAgeRange;
  insurance?: string;
  demographics_multi?: string[];
}

export interface RequestFormResponse {
  id: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
  // Include all RequestFormData fields
  firstname: string;
  lastname: string;
  email: string;
  phone_number: string;
  pronouns?: Pronouns;
  pronouns_other?: string;
  address: string;
  city: string;
  state: STATE;
  zip_code: string;
  home_phone?: string;
  home_type?: HomeType;
  home_access?: string;
  pets?: string;
  relationship_status?: RelationshipStatus;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  mobile_phone?: string;
  work_phone?: string;
  referral_source?: string;
  referral_name?: string;
  referral_email?: string;
  health_history?: string;
  allergies?: string;
  health_notes?: string;
  annual_income?: IncomeLevel;
  service_needed: ServiceTypes;
  service_specifics?: string;
  due_date?: string;
  birth_location?: string;
  birth_hospital?: string;
  number_of_babies?: number;
  baby_name?: string;
  provider_type?: ProviderType;
  pregnancy_number?: number;
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;
  services_interested?: string[];
  service_support_details?: string;
  race_ethnicity?: string;
  primary_language?: string;
  client_age_range?: ClientAgeRange;
  insurance?: string;
  demographics_multi?: string[];
}

export interface DatabaseError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface SupabaseUserMetadata {
  given_name?: string;
  family_name?: string;
  name?: string;
  [key: string]: unknown;
}

export enum CLIENT_STATUS {
  LEAD = 'lead',
  CONTACTED = 'contacted',
  MATCHING = 'matching',
  INTERVIEWING = 'interviewing',
  'FOLLOW UP' = 'follow up',
  CONTRACT = 'contract',
  ACTIVE = 'active',
  COMPLETE = 'complete',
};

export enum ACCOUNT_STATUS {
  PENDING = "pending",
  APPROVED = "approved"
};

export enum ROLE {
  ADMIN = "admin",
  DOULA = "doula",
  CLIENT = "client"
};

export enum STATE {
  AL = "AL",
  AK = "AK",
  AZ = "AZ",
  AR = "AR",
  CA = "CA",
  CO = "CO",
  CT = "CT",
  DE = "DE",
  FL = "FL",
  GA = "GA",
  HI = "HI",
  ID = "ID",
  IL = "IL",
  IN = "IN",
  IA = "IA",
  KS = "KS",
  KY = "KY",
  LA = "LA",
  ME = "ME",
  MD = "MD",
  MA = "MA",
  MI = "MI",
  MN = "MN",
  MS = "MS",
  MO = "MO",
  MT = "MT",
  NE = "NE",
  NV = "NV",
  NH = "NH",
  NJ = "NJ",
  NM = "NM",
  NY = "NY",
  NC = "NC",
  ND = "ND",
  OH = "OH",
  OK = "OK",
  OR = "OR",
  PA = "PA",
  RI = "RI",
  SC = "SC",
  SD = "SD",
  TN = "TN",
  TX = "TX",
  UT = "UT",
  VT = "VT",
  VA = "VA",
  WA = "WA",
  WV = "WV",
  WI = "WI",
  WY = "WY"  
};