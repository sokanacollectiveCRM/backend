// src/common/middleware/authorizeRoles.ts
import { NextFunction, Response } from 'express'
import type { AuthRequest } from 'types'

const authorizeRoles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  allowedRoles: string[]
): Promise<void> => {
  try {
    if (!req.user || !req.user.email) {
      res.status(401).json({ error: 'Unauthorized: No user found' })
      return   // ← stop here!
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
      return   // ← and stop here!
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export default authorizeRoles
