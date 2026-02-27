import type { Request, Response } from 'express'
import { LoginSchema } from './auth.schema.js'
import * as authService from './auth.service.js'

const COOKIE_NAME = 'refreshToken'

function setRefreshCookie(res: Response, token: string, maxAge: number) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/v1/auth',
    maxAge: maxAge * 1000,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/v1/auth',
  })
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await authService.login(parsed.data)

  if ('error' in result) {
    if (result.error === 'TENANT_INACTIVE') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Tenant account is inactive',
      })
      return
    }
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    })
    return
  }

  setRefreshCookie(res, result.refreshToken, result.refreshMaxAge)

  res.json({
    access_token: result.accessToken,
    expires_in: result.expiresIn,
    user: result.user,
  })
}

export async function refreshHandler(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'No refresh token provided',
    })
    return
  }

  const result = await authService.refresh(token)

  if ('error' in result) {
    clearRefreshCookie(res)
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Refresh token is invalid or expired',
    })
    return
  }

  setRefreshCookie(res, result.refreshToken, result.refreshMaxAge)

  res.json({
    access_token: result.accessToken,
    expires_in: result.expiresIn,
  })
}

export async function logoutHandler(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined

  if (token) {
    await authService.logout(token)
  }

  clearRefreshCookie(res)

  res.json({ message: 'Logged out' })
}
