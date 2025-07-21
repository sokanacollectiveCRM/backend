"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const index_1 = require("../index");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const userRoutes = express_1.default.Router();
// route for retrieving specific user's information
userRoutes.get('/:id', authMiddleware_1.default, (req, res) => index_1.userController.getUserById(req, res));
userRoutes.get('/:id/hours', authMiddleware_1.default, (req, res) => index_1.userController.getHours(req, res));
userRoutes.post('/:id/addhours', authMiddleware_1.default, (req, res) => index_1.userController.addNewHours(req, res));
// uploading a profile picture requires multer
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});
userRoutes.put('/update', authMiddleware_1.default, upload.single('profile_picture'), (req, res) => index_1.userController.updateUser(req, res));
exports.default = userRoutes;
