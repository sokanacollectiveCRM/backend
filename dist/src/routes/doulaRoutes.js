"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const authorizeRoles_1 = __importDefault(require("../middleware/authorizeRoles"));
const doulaRoutes = express_1.default.Router();
doulaRoutes.get('/', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.getClients(req, res));
doulaRoutes.put('/status', authMiddleware_1.default, (req, res, next) => (0, authorizeRoles_1.default)(req, res, next, ['admin', 'doula']), (req, res) => index_1.clientController.updateClientStatus(req, res));
exports.default = doulaRoutes;
