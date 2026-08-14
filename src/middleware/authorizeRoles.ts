import { NextFunction, Response } from 'express';
import type { AuthRequest } from '../types';
import { ApiErrorCode } from '../security/errorCodes';

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
      res.status(401).json({
        error: 'Unauthorized: No user found',
        code: ApiErrorCode.UNAUTHENTICATED,
      });
      return;
    }

    const role = String(req.user.role || '').toLowerCase();
    const allowed = allowedRoles.map((r) => String(r).toLowerCase());
    if (!allowed.includes(role)) {
      res.status(403).json({
        error: 'Forbidden: Insufficient permissions',
        code: ApiErrorCode.FORBIDDEN,
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      error: 'Internal server error',
      code: ApiErrorCode.INTERNAL_ERROR,
    });
  }
};

export default authorizeRoles;
