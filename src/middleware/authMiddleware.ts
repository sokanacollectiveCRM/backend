import { NextFunction, Response } from 'express';
import { authService } from '../index';
import supabase from '../supabase';
import type { AuthRequest } from '../types';

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const cookieToken = req.cookies?.session
    const token = authHeader ? authHeader.split(' ')[1] : cookieToken

    if (!token) {
      console.warn('⚠️ [Auth] No token provided:', {
        path: req.path,
        hasAuthHeader: !!authHeader,
        hasCookie: !!cookieToken,
        method: req.method
      });
      res.status(401).json({ error: 'No session token provided' })
      return
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.warn('⚠️ [Auth] Invalid or expired token:', {
        path: req.path,
        error: error?.message,
        hasUser: !!user
      });
      res.status(401).json({ error: 'Invalid or expired session token' })
      return
    }

    // Your app's user object
    const user_entity = await authService.getUserFromToken(token)
    req.user = user_entity;
    next();
  } catch (err: any) {
    console.error('❌ [Auth] Middleware error:', {
      path: req.path,
      error: err?.message,
      stack: err?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};



export default authMiddleware
