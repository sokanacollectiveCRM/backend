import { User } from 'entities/User';
import { NextFunction, Response } from 'express';
import { userRepository } from 'index';
import type { AuthRequest } from 'types';

// authorizeRoles
//
// Takes in an array of authorized roles (in lowercase) of 'patient', 'doula', 'admin'.
//

const authorizeRoles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  allowedRoles: string[]
): Promise<void> => {
  try {

    if (!req.user || !req.user.email) {
      res.status(401).json({ error: 'Unauthorized: No user found' });
    }

    // Fetch user from database
    const user: User = await userRepository.findByEmail(req.user.email)

    if (!user) {
      res.status(401).json({ error: 'User profile does not exist' });
    }

    // Check that the role is authorized 
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions ' });
    }

    next();
  }
  catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default authorizeRoles;
