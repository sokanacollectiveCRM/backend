'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const index_1 = require('../index');
const supabase_1 = __importDefault(require('../supabase'));
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.['sb-access-token'];
    if (!token) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    const {
      data: { user },
      error,
    } = await supabase_1.default.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }
    // Your app’s user object
    const user_entity = await index_1.authService.getUserFromToken(token);
    req.user = user_entity;
    next();
  } catch {
    console.error('Auth middleware error:');
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.default = authMiddleware;
