// src/common/middleware/authMiddleware.ts
import { NextFunction, Response } from 'express'
import { authService } from 'index'
import supabase from 'supabase'
import type { AuthRequest } from 'types'

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
      res.status(401).json({ error: 'No session token provided' })
      return
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' })
      return
    }

    // Your app’s user object
    const user_entity = await authService.getUserFromToken(token)

    // Only override if Supabase provided a role
    const meta = user.user_metadata as Record<string, any> | undefined
    if (meta && typeof meta.role === 'string') {
      user_entity.role = meta.role
    }

    req.user = user_entity
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export default authMiddleware
