import { z } from 'zod'

export const CURRENCY_OPTIONS = ['AED', 'USD', 'EUR', 'INR', 'EGP'] as const

export const SUPPLIER_TYPE_OPTIONS = ['distributor', 'manufacturer', 'wholesaler', 'farm', 'importer', 'other'] as const

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, 'Code is required').max(20),
  name: z.string().trim().min(1, 'Name is required'),
  trn: z.string().trim().optional().or(z.literal('')),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  supplier_type: z.enum(SUPPLIER_TYPE_OPTIONS).optional().or(z.literal('')),
  category_ids: z.array(z.string().uuid()),
  salesman_name: z.string().trim().optional().or(z.literal('')),
  credit_limit_amount: z.coerce.number().min(0).optional().or(z.literal('')),
  credit_limit_currency: z.enum(CURRENCY_OPTIONS),
  bank_name: z.string().trim().optional().or(z.literal('')),
  bank_account_name: z.string().trim().optional().or(z.literal('')),
  bank_account_number: z.string().trim().optional().or(z.literal('')),
  bank_iban: z.string().trim().optional().or(z.literal('')),
  bank_swift: z.string().trim().optional().or(z.literal('')),
  is_active: z.boolean(),
})

export type SupplierInput = z.infer<typeof supplierSchema>
