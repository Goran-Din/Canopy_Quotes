import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { UserRole } from '@prisma/client'

export interface AuthUser {
  sub: string
  email: string
  role: UserRole
  tenant_id: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing authorization token',
    })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser
    req.user = payload
    next()
  } catch {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    })
  }
}
