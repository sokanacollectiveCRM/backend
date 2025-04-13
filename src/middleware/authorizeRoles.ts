import { NextFunction, Response } from 'express';
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

    // Check that the role is authorized 
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions ' });
    }

    next();
  }
  catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default authorizeRoles;
