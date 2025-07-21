'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.authenticateUser = void 0;
const jsonwebtoken_1 = __importDefault(require('jsonwebtoken'));
const config_1 = require('../config');
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jsonwebtoken_1.default.verify(
      token,
      config_1.config.jwtSecret
    );
    // Create a User instance from the decoded token data
    req.user = {
      id: decoded.id,
      role: decoded.role,
      getFullName: () => '',
      toJSON: () => ({ id: decoded.id, role: decoded.role }),
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
exports.authenticateUser = authenticateUser;
