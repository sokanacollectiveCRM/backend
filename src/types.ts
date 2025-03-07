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
