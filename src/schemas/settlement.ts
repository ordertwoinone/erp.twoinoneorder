import { z } from 'zod'

export const cardAllocationSchema = z.object({
  restaurant_id: z.string().uuid('Select a restaurant'),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  covers_from: z.string().min(1, 'Required'),
  covers_to: z.string().min(1, 'Required'),
})

export const cardSettlementFormSchema = z.object({
  card_machine_id: z.string().uuid('Select a machine'),
  bank_account_id: z.string().uuid('Select a bank account'),
  credit_date: z.string().min(1, 'Date is required'),
  bank_reference: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  notes: z.string().optional().or(z.literal('')),
  allocations: z.array(cardAllocationSchema),
})
export type CardSettlementFormInput = z.infer<typeof cardSettlementFormSchema>

export const deliverySettlementFormSchema = z.object({
  delivery_platform_id: z.string().uuid('Select a platform'),
  restaurant_id: z.string().uuid('Select a restaurant'),
  bank_account_id: z.string().uuid().optional().or(z.literal('')),
  credit_date: z.string().min(1, 'Date is required'),
  bank_reference: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  covers_from: z.string().min(1, 'Required'),
  covers_to: z.string().min(1, 'Required'),
  notes: z.string().optional().or(z.literal('')),
})
export type DeliverySettlementFormInput = z.infer<typeof deliverySettlementFormSchema>
