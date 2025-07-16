"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const authorizeRoles_1 = __importDefault(require("../middleware/authorizeRoles"));
const clientRoutes = express_1.default.Router();
// Team specific routes
clientRoutes.get('/team/all', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.userController.getAllTeamMembers(req, res));
clientRoutes.delete('/team/:id', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']), (req, res) => index_1.userController.deleteMember(req, res));
clientRoutes.post("/team/add", authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin']), (req, res) => index_1.userController.addTeamMember(req, res));
// Client specific routes
clientRoutes.get('/fetchCSV', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'client']), (req, res) => index_1.clientController.exportCSV(req, res));
clientRoutes.get('/', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.getClients(req, res));
clientRoutes.get('/:id', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula', 'client']), (req, res) => index_1.clientController.getClientById(req, res));
clientRoutes.put('/status', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.updateClientStatus(req, res));
clientRoutes.put('/:id', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.updateClient(req, res));
clientRoutes.post('/:id/activity', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.createActivity(req, res));
exports.default = clientRoutes;
