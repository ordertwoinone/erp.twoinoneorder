import { z } from 'zod'

export const goodsReceiptItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  quantity_received: z.coerce.number().min(0, 'Cannot be negative'),
  quantity_shortage: z.coerce.number().min(0),
  notes: z.string().optional().or(z.literal('')),
  // Display-only — carried alongside the line, never sent to save_goods_receipt.
  product_name: z.string().optional(),
  ordered_quantity: z.number().optional(),
})
export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemSchema>

export const goodsReceiptFormSchema = z.object({
  restaurant_id: z.string().uuid('Select a restaurant'),
  purchase_order_id: z.string().uuid().optional().or(z.literal('')),
  received_date: z.string().min(1, 'Received date is required'),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(goodsReceiptItemSchema).min(1, 'Add at least one line item'),
})
export type GoodsReceiptFormInput = z.infer<typeof goodsReceiptFormSchema>
