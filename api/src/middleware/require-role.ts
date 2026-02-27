import type { Request, Response, NextFunction } from 'express'
import type { UserRole } from '@prisma/client'

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      })
      return
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for this action',
      })
      return
    }

    next()
  }
}
