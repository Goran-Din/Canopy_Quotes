import { z } from 'zod'

const ROLES = ['owner', 'n37_super_admin', 'division_manager', 'salesperson', 'coordinator'] as const

export const CreateUserSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(8).max(128).optional(),
})

export const UpdateUserSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
})

export const ResetPasswordSchema = z.object({
  new_password: z.string().min(8).max(128),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
