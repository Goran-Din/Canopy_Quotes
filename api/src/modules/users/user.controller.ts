import type { Request, Response } from 'express'
import crypto from 'crypto'
import { prisma } from '../../config/database.js'
import { hashPassword } from '../auth/auth.service.js'
import { CreateUserSchema, UpdateUserSchema, ResetPasswordSchema } from './user.schema.js'

type IdParams = { id: string }

// ── GET /users ──────────────────────────────────────────────────────────────────
export async function listUsers(req: Request, res: Response) {
  const tenantId = req.user!.tenant_id

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
  })

  res.json({
    users: users.map((u) => ({
      id: u.id,
      first_name: u.firstName,
      last_name: u.lastName,
      email: u.email,
      role: u.role,
      is_active: u.isActive,
      created_at: u.createdAt,
    })),
  })
}

// ── POST /users ─────────────────────────────────────────────────────────────────
export async function createUser(req: Request, res: Response) {
  const parsed = CreateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const tenantId = req.user!.tenant_id
  const { first_name, last_name, email, role, password } = parsed.data

  // Check for existing user with same email in this tenant
  const existing = await prisma.user.findFirst({
    where: { tenantId, email },
  })
  if (existing) {
    res.status(409).json({
      error: 'CONFLICT',
      message: 'A user with this email already exists in your organization.',
    })
    return
  }

  // Use provided password or generate a random temporary one
  const plainPassword = password ?? crypto.randomBytes(16).toString('hex')
  const passwordHash = await hashPassword(plainPassword)

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      firstName: first_name,
      lastName: last_name,
      role,
      passwordHash,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  res.status(201).json({
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    created_at: user.createdAt,
  })
}

// ── PUT /users/:id ──────────────────────────────────────────────────────────────
export async function updateUser(req: Request<IdParams>, res: Response) {
  const parsed = UpdateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const tenantId = req.user!.tenant_id
  const userId = req.params.id

  // Verify the user belongs to this tenant
  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
    return
  }

  const { first_name, last_name, role } = parsed.data

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(first_name !== undefined && { firstName: first_name }),
      ...(last_name !== undefined && { lastName: last_name }),
      ...(role !== undefined && { role }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  res.json({
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    created_at: user.createdAt,
  })
}

// ── PUT /users/:id/deactivate ───────────────────────────────────────────────────
export async function deactivateUser(req: Request<IdParams>, res: Response) {
  const tenantId = req.user!.tenant_id
  const userId = req.params.id

  // Cannot deactivate yourself
  if (userId === req.user!.sub) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'You cannot deactivate your own account.',
    })
    return
  }

  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  })

  res.json({ message: 'User deactivated.' })
}

// ── PUT /users/:id/reactivate ───────────────────────────────────────────────────
export async function reactivateUser(req: Request<IdParams>, res: Response) {
  const tenantId = req.user!.tenant_id
  const userId = req.params.id

  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  })

  res.json({ message: 'User reactivated.' })
}

// ── PUT /users/:id/reset-password ─────────────────────────────────────────────
export async function resetPassword(req: Request<IdParams>, res: Response) {
  const parsed = ResetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const tenantId = req.user!.tenant_id
  const userId = req.params.id

  // Cannot reset your own password via this endpoint
  if (userId === req.user!.sub) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Use the change-password endpoint to update your own password.',
    })
    return
  }

  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
    return
  }

  const newHash = await hashPassword(parsed.data.new_password)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  })

  res.json({ message: 'Password reset successfully.' })
}
