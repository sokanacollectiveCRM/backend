import { AuthController } from 'controllers/authController';
import { ClientController } from 'controllers/clientController';
import { RequestFormController } from 'controllers/RequestFormController';
import { RequestFormRepository } from 'repositories/RequestFormRepository';
import { SupabaseUserRepository } from 'repositories/supabaseUserRepository';
import { RequestFormService } from 'services/RequestFormService';
import { SupabaseAuthService } from 'services/supabaseAuthService';
import supabase from 'supabase';
import { AuthUseCase } from 'usecase/authUseCase';
import { ClientUseCase } from 'usecase/clientUseCase';

const userRepository = new SupabaseUserRepository(supabase);
const requestRepository = new RequestFormRepository(supabase);

// ******** Auth Controller
const authService = new SupabaseAuthService(supabase, userRepository);
const authUseCase = new AuthUseCase(authService, userRepository);
const authController = new AuthController(authUseCase);

// ******** Request Controller
const requestService = new RequestFormService(requestRepository);
const requestFormController = new RequestFormController(requestService);

// ******** Request Controller
const clientUseCase = new ClientUseCase(userRepository);
const clientController = new ClientController(clientUseCase);

// Export all of our controllers + services
export { authController, authService, clientController, requestFormController, userRepository };

