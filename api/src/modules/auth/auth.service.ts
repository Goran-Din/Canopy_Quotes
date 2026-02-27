import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import type { LoginInput } from './auth.schema.js'

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_DAYS = 30

export interface JwtPayload {
  sub: string
  email: string
  role: string
  tenant_id: string
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS)
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}

function signAccessToken(payload: JwtPayload): {
  accessToken: string
  expiresIn: number
} {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })
  return { accessToken, expiresIn: 900 }
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email, isActive: true },
    include: { tenant: { select: { id: true, isActive: true } } },
  })

  if (!user) {
    return { error: 'INVALID_CREDENTIALS' as const }
  }

  if (!user.tenant.isActive) {
    return { error: 'TENANT_INACTIVE' as const }
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash)
  if (!passwordValid) {
    return { error: 'INVALID_CREDENTIALS' as const }
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  // Generate tokens
  const jwtPayload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenant_id: user.tenantId,
  }

  const { accessToken, expiresIn } = signAccessToken(jwtPayload)

  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  )

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt,
    },
  })

  return {
    accessToken,
    expiresIn,
    refreshToken,
    refreshMaxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
    user: {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      role: user.role,
      tenant_id: user.tenantId,
    },
  }
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          isActive: true,
          tenant: { select: { isActive: true } },
        },
      },
    },
  })

  if (!stored) {
    return { error: 'INVALID_REFRESH_TOKEN' as const }
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } })
    return { error: 'REFRESH_TOKEN_EXPIRED' as const }
  }

  if (!stored.user.isActive || !stored.user.tenant.isActive) {
    await prisma.refreshToken.delete({ where: { id: stored.id } })
    return { error: 'ACCOUNT_INACTIVE' as const }
  }

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { id: stored.id } })

  const jwtPayload: JwtPayload = {
    sub: stored.user.id,
    email: stored.user.email,
    role: stored.user.role,
    tenant_id: stored.user.tenantId,
  }

  const { accessToken, expiresIn } = signAccessToken(jwtPayload)

  const newRefreshToken = generateRefreshToken()
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  )

  await prisma.refreshToken.create({
    data: {
      userId: stored.user.id,
      token: newRefreshToken,
      expiresAt,
    },
  })

  return {
    accessToken,
    expiresIn,
    refreshToken: newRefreshToken,
    refreshMaxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  }
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } })
}
