import { z } from 'zod'

export const restaurantSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, 'Code is required').max(20),
  name: z.string().trim().min(1, 'Name is required'),
  legal_name: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  emirate: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  trn: z.string().optional().or(z.literal('')),
  is_head_office: z.boolean(),
  is_active: z.boolean(),
})

export type RestaurantInput = z.infer<typeof restaurantSchema>
