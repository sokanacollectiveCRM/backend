import { AuthController } from './controllers/authController';
import { ClientController } from './controllers/clientController';
import { ContractController } from './controllers/contractController';
import { DoulaController } from './controllers/doulaController';
import { EmailController } from './controllers/emailController';
import { RequestFormController } from './controllers/requestFormController';
import { UserController } from './controllers/userController';
import { ClientDocumentRepository } from './repositories/clientDocumentRepository';
import { CloudSqlActivityRepository } from './repositories/cloudSqlActivityRepository';
import { CloudSqlClientRepository } from './repositories/cloudSqlClientRepository';
import { DoulaDocumentRepository } from './repositories/doulaDocumentRepository';
import { RequestFormRepository } from './repositories/requestFormRepository';
import { SupabaseAssignmentRepository } from './repositories/supabaseAssignmentRepository';
import { SupabaseUserRepository } from './repositories/supabaseUserRepository';
import { RequestFormService } from './services/RequestFormService';
import { ClientDocumentUploadService } from './services/clientDocumentUploadService';
import { DoulaDocumentCompletenessService } from './services/doulaDocumentCompletenessService';
import { DoulaDocumentUploadService } from './services/doulaDocumentUploadService';
import { IdentityPlatformTokenService } from './services/identityPlatform/identityPlatformTokenService';
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
// Client data comes only from Cloud SQL (sokana_private). Supabase is auth only.
const clientRepository = new CloudSqlClientRepository();
const activityRepository = new CloudSqlActivityRepository(supabase);
const assignmentRepository = new SupabaseAssignmentRepository(supabase);
const doulaDocumentRepository = new DoulaDocumentRepository(supabase);
const clientDocumentRepository = new ClientDocumentRepository(supabase);

//-----------------------------------------------
// Services (External Integrations)
//-----------------------------------------------
const authService = new SupabaseAuthService(supabase, userRepository);
const identityTokenService = new IdentityPlatformTokenService(userRepository);
const requestService = new RequestFormService(requestRepository);
const contractService = new SupabaseContractService(supabase);
const doulaDocumentUploadService = new DoulaDocumentUploadService();
const clientDocumentUploadService = new ClientDocumentUploadService();
//-----------------------------------------------
// Use Cases (Business Logic)
//-----------------------------------------------
const authUseCase = new AuthUseCase(authService, userRepository);
const userUseCase = new UserUseCase(userRepository);
const clientUseCase = new ClientUseCase(clientRepository, activityRepository);
const contractUseCase = new ContractUseCase(contractService);

//-----------------------------------------------
// Controllers (API Layer)
//-----------------------------------------------
const doulaDocumentCompletenessService = new DoulaDocumentCompletenessService(
  doulaDocumentRepository
);
const authController = new AuthController(authUseCase, identityTokenService);
const userController = new UserController(
  userUseCase,
  doulaDocumentCompletenessService
);
const requestFormController = new RequestFormController(requestService);
const clientController = new ClientController(
  clientUseCase,
  assignmentRepository,
  clientRepository,
  clientDocumentRepository,
  clientDocumentUploadService
);
const contractController = new ContractController(contractUseCase);
const emailController = new EmailController();
const doulaController = new DoulaController(
  doulaDocumentRepository,
  assignmentRepository,
  userRepository,
  activityRepository,
  doulaDocumentUploadService,
  userUseCase,
  clientUseCase
);

export {
  authController,
  authService,
  identityTokenService,
  clientController,
  contractController,
  doulaController,
  emailController,
  requestFormController,
  userController,
  userRepository,
  clientRepository,
  assignmentRepository,
};
