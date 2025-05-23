import { AuthController } from './controllers/authController';
import { ClientController } from './controllers/clientController';
import { ContractController } from './controllers/contractController';
import { EmailController } from './controllers/emailController';
import { RequestFormController } from './controllers/requestFormController';
import { UserController } from './controllers/userController';
import { RequestFormRepository } from './repositories/requestFormRepository';
import { SupabaseClientRepository } from './repositories/supabaseClientRepository';
import { SupabaseUserRepository } from './repositories/supabaseUserRepository';
import { RequestFormService } from './services/RequestFormService';
import { SupabaseAuthService } from './services/supabaseAuthService';
import { SupabaseContractService } from './services/supabaseContractService';
import supabase from './supabase';
import { AuthUseCase } from './usecase/authUseCase';
import { ClientUseCase } from './usecase/clientUseCase';
import { ContractUseCase } from './usecase/contractUseCase';
import { UserUseCase } from './usecase/userUseCase';

//-----------------------------------------------
// Repositories (Data Access Layer)
//-----------------------------------------------
const userRepository = new SupabaseUserRepository(supabase);
const requestRepository = new RequestFormRepository(supabase);
const clientRepository = new SupabaseClientRepository(supabase);

//-----------------------------------------------
// Services (External Integrations)
//-----------------------------------------------
const authService = new SupabaseAuthService(supabase, userRepository);
const requestService = new RequestFormService(requestRepository);
const contractService = new SupabaseContractService(supabase);
//-----------------------------------------------
// Use Cases (Business Logic)
//-----------------------------------------------
const authUseCase = new AuthUseCase(authService, userRepository);
const userUseCase = new UserUseCase(userRepository);
const clientUseCase = new ClientUseCase(clientRepository);
const contractUseCase = new ContractUseCase(contractService);

//-----------------------------------------------
// Controllers (API Layer)
//-----------------------------------------------
const authController = new AuthController(authUseCase);
const userController = new UserController(userUseCase);
const requestFormController = new RequestFormController(requestService);
const clientController = new ClientController(clientUseCase);
const contractController = new ContractController(contractUseCase);
const emailController = new EmailController();

export { authController, authService, clientController, contractController, emailController, requestFormController, userController, userRepository };

