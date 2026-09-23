import { z } from 'zod'

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  pack_size: z.coerce.number().min(0).optional().or(z.literal('')),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price cannot be negative'),
  discount_amount: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
})
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>

export const purchaseFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  supplier_id: z.string().uuid('Select a supplier'),
  invoice_number: z.string().trim().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one line item'),
})
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>
