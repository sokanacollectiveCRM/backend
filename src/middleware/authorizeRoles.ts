import { NextFunction, Response } from 'express';
import type { AuthRequest } from 'types';

// authorizeRoles
//
// Takes in an array of authorized roles (in lowercase) of 'patient', 'doula', 'admin'.
//

const authorizeRoles = (
  allowedRoles: string[]
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    // Check if user exists
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized ' });
    }

    // Grab the role
    const { role } = req.user;

    // Check that the role is authorized 
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions ' });
    }

    // Continue to controller
    next();
  };
};

export default authorizeRoles;
