import { User } from '@supabase/supabase-js';
import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
}

export interface UserData {
  id: string;
  username: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
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