import { AuthController } from 'controllers/authController';
import { ClientController } from 'controllers/clientController';
import { RequestFormController } from 'controllers/RequestFormController';
import { UserController } from 'controllers/userController';
import { RequestFormRepository } from 'repositories/RequestFormRepository';
import { SupabaseUserRepository } from 'repositories/supabaseUserRepository';
import { RequestFormService } from 'services/RequestFormService';
import { SupabaseAuthService } from 'services/supabaseAuthService';
import supabase from 'supabase';
import { AuthUseCase } from 'usecase/authUseCase';
import { ClientUseCase } from 'usecase/clientUseCase';
import { UserUseCase } from 'usecase/UserUseCase';

// ******** Auth Controller

// Instantiate low-level dependencies first
const userRepository = new SupabaseUserRepository(supabase);
const authService = new SupabaseAuthService(supabase, userRepository);

// Instantiate Use Case with dependencies
const authUseCase = new AuthUseCase(authService, userRepository);

// Instantiate Controller with Use Case
const authController = new AuthController(authUseCase);

// ******** Request Controller
const userUseCase = new UserUseCase(userRepository);
const userController = new UserController(userUseCase);

// Instantiate low-level dependencies first
const requestRepository = new RequestFormRepository(supabase);
const requestService = new RequestFormService(requestRepository);

// Instantiate Controller
const requestFormController = new RequestFormController(requestService);

// ******** Request Controller

const clientUseCase = new ClientUseCase(userRepository);
const clientController = new ClientController(clientUseCase);



// Export all of our controllers
export { authController, clientController, requestFormController, userRepository, userController };

