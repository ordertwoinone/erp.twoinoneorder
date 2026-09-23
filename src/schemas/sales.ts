import { z } from 'zod'

export const salesBreakdownSchema = z.object({
  sales_channel_id: z.string().uuid().optional().or(z.literal('')),
  payment_method_id: z.string().uuid('Select a payment method'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
})
export type SalesBreakdownInput = z.infer<typeof salesBreakdownSchema>

export const salesEntryFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  business_date: z.string().min(1, 'Date is required'),
  shift: z.enum(['morning', 'evening', 'full_day']),
  gross_sales: z.coerce.number().min(0),
  discounts: z.coerce.number().min(0),
  refunds: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
  notes: z.string().optional().or(z.literal('')),
  breakdowns: z.array(salesBreakdownSchema).min(1, 'Add at least one payment breakdown'),
})
export type SalesEntryFormInput = z.infer<typeof salesEntryFormSchema>
