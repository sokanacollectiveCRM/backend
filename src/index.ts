import { AuthController } from 'controllers/authController';
import { SupabaseUserRepository } from 'repositories/supabaseUserRepository';
import { SupabaseAuthService } from 'services/supabaseAuthService';
import supabase from 'supabase';
import { AuthUseCase } from 'usecase/authUseCase';

// Instantiate low-level dependencies first
const userRepository = new SupabaseUserRepository(supabase);
const authService = new SupabaseAuthService(supabase, userRepository);

// Instantiate Use Case with dependencies
const authUseCase = new AuthUseCase(authService, userRepository);

// Instantiate Controller with Use Case
const authController = new AuthController(authUseCase);

export default authController;
