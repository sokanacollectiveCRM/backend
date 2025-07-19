'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const multer_1 = __importDefault(require('multer'));
const index_1 = require('../index');
const authMiddleware_1 = __importDefault(
  require('../middleware/authMiddleware')
);
const authorizeRoles_1 = __importDefault(
  require('../middleware/authorizeRoles')
);
const clientRoutes = express_1.default.Router();
const upload = (0, multer_1.default)({
  storage: multer_1.default.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});
// generate a contract for a client given a template
clientRoutes.post(
  '/',
  authMiddleware_1.default,
  (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']),
  (req, res) => index_1.contractController.generateContract(req, res)
);
// get a preview of an already generated contract
clientRoutes.get(
  '/:id/preview',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => index_1.contractController.previewContract(req, res)
);
// get the list of templates
clientRoutes.get(
  '/templates',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula', 'admin']),
  (req, res) => index_1.contractController.getAllTemplates(req, res)
);
// delete a template
clientRoutes.delete(
  '/templates/:name',
  authMiddleware_1.default,
  (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']),
  (req, res) => index_1.contractController.deleteTemplate(req, res)
);
// update a template
clientRoutes.put(
  '/templates/:name',
  authMiddleware_1.default,
  (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']),
  upload.single('contract'),
  (req, res) => index_1.contractController.updateTemplate(req, res)
);
// upload a template
clientRoutes.post(
  '/templates',
  authMiddleware_1.default,
  (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']),
  upload.single('contract'),
  (req, res) => index_1.contractController.uploadTemplate(req, res)
);
// request a filled template
clientRoutes.post(
  '/templates/generate',
  authMiddleware_1.default,
  (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']),
  (req, res) => index_1.contractController.generateTemplate(req, res)
);
exports.default = clientRoutes;
