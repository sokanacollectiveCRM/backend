'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.userRepository =
  exports.userController =
  exports.requestFormController =
  exports.emailController =
  exports.contractController =
  exports.clientController =
  exports.authService =
  exports.authController =
    void 0;
const authController_1 = require('./controllers/authController');
const clientController_1 = require('./controllers/clientController');
const contractController_1 = require('./controllers/contractController');
const emailController_1 = require('./controllers/emailController');
const requestFormController_1 = require('./controllers/requestFormController');
const userController_1 = require('./controllers/userController');
const requestFormRepository_1 = require('./repositories/requestFormRepository');
const supabaseActivityRepository_1 = require('./repositories/supabaseActivityRepository');
const supabaseClientRepository_1 = require('./repositories/supabaseClientRepository');
const supabaseUserRepository_1 = require('./repositories/supabaseUserRepository');
const RequestFormService_1 = require('./services/RequestFormService');
const supabaseAuthService_1 = require('./services/supabaseAuthService');
const supabaseContractService_1 = require('./services/supabaseContractService');
const supabase_1 = __importDefault(require('./supabase'));
const authUseCase_1 = require('./usecase/authUseCase');
const clientUseCase_1 = require('./usecase/clientUseCase');
const contractUseCase_1 = require('./usecase/contractUseCase');
const userUseCase_1 = require('./usecase/userUseCase');
//-----------------------------------------------
// Repositories (Data Access Layer)
//-----------------------------------------------
const userRepository = new supabaseUserRepository_1.SupabaseUserRepository(
  supabase_1.default
);
exports.userRepository = userRepository;
const requestRepository = new requestFormRepository_1.RequestFormRepository(
  supabase_1.default
);
const clientRepository =
  new supabaseClientRepository_1.SupabaseClientRepository(supabase_1.default);
const activityRepository =
  new supabaseActivityRepository_1.SupabaseActivityRepository(
    supabase_1.default
  );
//-----------------------------------------------
// Services (External Integrations)
//-----------------------------------------------
const authService = new supabaseAuthService_1.SupabaseAuthService(
  supabase_1.default,
  userRepository
);
exports.authService = authService;
const requestService = new RequestFormService_1.RequestFormService(
  requestRepository
);
const contractService = new supabaseContractService_1.SupabaseContractService(
  supabase_1.default
);
//-----------------------------------------------
// Use Cases (Business Logic)
//-----------------------------------------------
const authUseCase = new authUseCase_1.AuthUseCase(authService, userRepository);
const userUseCase = new userUseCase_1.UserUseCase(userRepository);
const clientUseCase = new clientUseCase_1.ClientUseCase(
  clientRepository,
  activityRepository
);
const contractUseCase = new contractUseCase_1.ContractUseCase(contractService);
//-----------------------------------------------
// Controllers (API Layer)
//-----------------------------------------------
const authController = new authController_1.AuthController(authUseCase);
exports.authController = authController;
const userController = new userController_1.UserController(userUseCase);
exports.userController = userController;
const requestFormController = new requestFormController_1.RequestFormController(
  requestService
);
exports.requestFormController = requestFormController;
const clientController = new clientController_1.ClientController(clientUseCase);
exports.clientController = clientController;
const contractController = new contractController_1.ContractController(
  contractUseCase
);
exports.contractController = contractController;
const emailController = new emailController_1.EmailController();
exports.emailController = emailController;
