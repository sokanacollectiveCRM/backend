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
const doulaRoutes = express_1.default.Router();
const upload = (0, multer_1.default)({
  storage: multer_1.default.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const profilePictureUpload = (0, multer_1.default)({
  storage: multer_1.default.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
doulaRoutes.get(
  '/',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']),
  (req, res) => index_1.clientController.getClients(req, res)
);
doulaRoutes.put(
  '/status',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']),
  (req, res) => index_1.clientController.updateClientStatus(req, res)
);
doulaRoutes.post(
  '/documents',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  upload.single('file'),
  (req, res) => index_1.doulaController.uploadDocument(req, res)
);
doulaRoutes.get(
  '/documents',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getMyDocuments(req, res)
);
doulaRoutes.delete(
  '/documents/:documentId',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.deleteDocument(req, res)
);
doulaRoutes.get(
  '/clients',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getMyClients(req, res)
);
doulaRoutes.get(
  '/clients/:clientId',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getClientDetails(req, res)
);
doulaRoutes.post(
  '/hours',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.logHours(req, res)
);
doulaRoutes.get(
  '/hours',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getMyHours(req, res)
);
doulaRoutes.post(
  '/clients/:clientId/activities',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.addClientActivity(req, res)
);
doulaRoutes.get(
  '/clients/:clientId/activities',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getClientActivities(req, res)
);
doulaRoutes.patch(
  '/clients/:clientId/activities/:activityId',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.patchClientActivity(req, res)
);
doulaRoutes.get(
  '/profile',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.getMyProfile(req, res)
);
doulaRoutes.put(
  '/profile',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  (req, res) => index_1.doulaController.updateMyProfile(req, res)
);
doulaRoutes.post(
  '/profile/picture',
  authMiddleware_1.default,
  (req, res, next) =>
    (0, authorizeRoles_1.default)(req, res, next, ['doula']),
  profilePictureUpload.single('profile_picture'),
  (req, res) => index_1.doulaController.uploadProfilePicture(req, res)
);
exports.default = doulaRoutes;
