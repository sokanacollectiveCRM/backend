"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const emailRoutes = express_1.default.Router();
// Protect all email routes with authentication
emailRoutes.use(authMiddleware_1.default);
// Route for sending client approval emails
emailRoutes.post('/client-approval', (req, res) => index_1.emailController.sendClientApproval(req, res));
// Route for sending team invite emails
emailRoutes.post('/team-invite', (req, res) => index_1.emailController.sendTeamInvite(req, res));
exports.default = emailRoutes;
