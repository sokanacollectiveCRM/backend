import { User } from "domain/entities/User";

export interface UserRepository {
  signUp(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<string>; // Returns token
  logout(): Promise<void>;
  getMe(): Promise<User | null>;
  verifyEmail(token: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  googleAuth(): Promise<string>; // Redirect URL
  handleOAuthCallback(code: string): Promise<string>; // Returns token
  handleToken(token: string): Promise<User | null>;
  requestPasswordReset(email: string): Promise<void>;
  handlePasswordRecovery(token: string, newPassword: string): Promise<void>;
  updatePassword(oldPassword: string, newPassword: string): Promise<void>;
}