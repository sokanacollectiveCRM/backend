import { NextFunction, Response } from 'express';
import { User } from '../entities/User';
import { authService } from '../index';
import supabase from '../supabase';
import type { AuthRequest } from '../types';

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.session;

    const token = authHeader ? authHeader.split(' ')[1] : cookieToken;

    if (!token) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    const user_entity: User = await authService.getUserFromToken(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    req.user = user_entity;
    next();
  } catch {
    console.error('Auth middleware error:');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default authMiddleware;
