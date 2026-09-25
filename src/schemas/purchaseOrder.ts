import { z } from 'zod'

export const purchaseOrderItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  pack_size: z.coerce.number().min(0).optional().or(z.literal('')),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price cannot be negative'),
})
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>

export const purchaseOrderFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  supplier_id: z.string().uuid('Select a supplier'),
  purchase_request_id: z.string().uuid().optional().or(z.literal('')),
  order_date: z.string().min(1, 'Order date is required'),
  expected_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one line item'),
})
export type PurchaseOrderFormInput = z.infer<typeof purchaseOrderFormSchema>
