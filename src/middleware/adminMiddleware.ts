import { NextFunction, Response } from 'express';
import { AuthRequest } from 'types';

const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // TEMPORARY WAY TO CHECK IF ADMIN, SHOULD IMPLEMENT CORRECT WAY 
    // lowkey i think this is safe but not entirely sure
    const isAdmin = req.user.email == 'sokanacollective245@gmail.com'; //boolean check if admin, temporary

    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default adminMiddleware;