import { NextFunction, Response } from 'express';
import type { AuthRequest } from 'types';

const authorizeRoles = (
  allowedRoles: string[]
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {

    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized ' });
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions ' });
    }

    next();
  };
};

export default authorizeRoles;
