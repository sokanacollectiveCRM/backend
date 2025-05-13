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
  username?: string;
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
  username: string;
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