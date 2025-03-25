import { NextFunction, Response } from 'express';
import { userRepository } from 'index';
import { User } from 'entities/User';
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

    console.log(req.user.email)
    // Grab the role
    const user = userRepository.findByEmail(req.user.email)

    // Check that the role is authorized 
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions ' });
    }

    // Continue to controller
    next();
  };
};

export default authorizeRoles;
