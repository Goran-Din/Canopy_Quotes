import { z } from 'zod'

const AddressSchema = z.object({
  street: z.string().max(500).optional(),
  street2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  country: z.string().length(2).optional(),
})

export const CreatePropertySchema = z.object({
  name: z.string().min(2).max(255),
  type: z.enum(['residential', 'commercial']),
  address: AddressSchema.optional(),
  lawn_area_sqft: z.number().min(0).optional(),
  parking_area_sqft: z.number().min(0).optional(),
  sidewalk_linear_ft: z.number().min(0).optional(),
  total_area_sqft: z.number().min(0).optional(),
  google_maps_url: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdatePropertySchema = CreatePropertySchema.partial()

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>
