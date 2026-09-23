import { z } from 'zod'

export const purchaseRequestItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
  notes: z.string().optional().or(z.literal('')),
})

export const purchaseRequestFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseRequestItemSchema).min(1, 'Add at least one item'),
})

export type PurchaseRequestFormInput = z.infer<typeof purchaseRequestFormSchema>
