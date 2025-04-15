import { AuthController } from 'controllers/authController';
import { ClientController } from 'controllers/clientController';
import { RequestFormController } from 'controllers/requestFormController';
import { UserController } from 'controllers/userController';
import { RequestFormRepository } from 'repositories/requestFormRepository';
import { SupabaseUserRepository } from 'repositories/supabaseUserRepository';
import { RequestFormService } from 'services/RequestFormService';
import { SupabaseAuthService } from 'services/supabaseAuthService';
import supabase from 'supabase';
import { AuthUseCase } from 'usecase/authUseCase';
import { ClientUseCase } from 'usecase/clientUseCase';
import { UserUseCase } from 'usecase/userUseCase';

//-----------------------------------------------
// Repositories (Data Access Layer)
//-----------------------------------------------
const userRepository = new SupabaseUserRepository(supabase);
const requestRepository = new RequestFormRepository(supabase);

//-----------------------------------------------
// Services (External Integrations)
//-----------------------------------------------
const authService = new SupabaseAuthService(supabase, userRepository);
const requestService = new RequestFormService(requestRepository);

//-----------------------------------------------
// Use Cases (Business Logic)
//-----------------------------------------------
const authUseCase = new AuthUseCase(authService, userRepository);
const userUseCase = new UserUseCase(userRepository);
const clientUseCase = new ClientUseCase(userRepository);

//-----------------------------------------------
// Controllers (API Layer)
//-----------------------------------------------
const authController = new AuthController(authUseCase);
const userController = new UserController(userUseCase);
const requestFormController = new RequestFormController(requestService);
const clientController = new ClientController(clientUseCase);

export {
    authController, authService, clientController,
    requestFormController, userController, userRepository
};
