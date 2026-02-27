import { z } from 'zod'

const AddressSchema = z.object({
  street: z.string().max(500).optional(),
  street2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  country: z.string().length(2).optional(),
})

export const CreateCustomerSchema = z.object({
  name: z.string().min(2).max(255),
  type: z.enum(['residential', 'commercial']),
  status: z.enum(['active', 'prospect']).default('prospect'),
  contact_name: z.string().max(255).optional(),
  billing_email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  billing_address: AddressSchema.optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateCustomerSchema = CreateCustomerSchema.partial()

export const ListCustomersQuerySchema = z.object({
  search: z.string().min(2).optional(),
  type: z.enum(['residential', 'commercial']).optional(),
  status: z.enum(['active', 'prospect', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['name', 'created_at', 'updated_at']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>
