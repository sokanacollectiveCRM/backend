import { NextFunction, Response } from 'express';
import { authService } from '../index';
import supabase from '../supabase';
import type { AuthRequest } from '../types';
import { logger } from '../common/utils/logger';

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.['sb-access-token'];

    if (!token) {
      logger.warn({
        context: 'authMiddleware',
        path: req.path,
        method: req.method
      }, 'No token provided');
      res.status(401).json({ error: 'No session token provided' })
      return
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      logger.warn({
        context: 'authMiddleware',
        path: req.path,
        error: error?.message,
        hasUser: !!user
      }, 'Invalid or expired token');
      res.status(401).json({ error: 'Invalid or expired session token' })
      return
    }

    // Your app's user object
    const user_entity = await authService.getUserFromToken(token)
    req.user = user_entity;
    next();
  } catch (err: any) {
    logger.error({ err, context: 'authMiddleware', path: req.path }, 'Middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
};



export default authMiddleware
