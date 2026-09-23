import { z } from 'zod'

export const paymentVoucherFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    restaurant_id: z.string().uuid('Select a restaurant'),
    payee_type: z.enum(['supplier', 'expense']),
    supplier_id: z.string().uuid().optional().or(z.literal('')),
    expense_category_id: z.string().uuid().optional().or(z.literal('')),
    amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
    payment_method: z.enum(['bank', 'cash']),
    bank_account_id: z.string().uuid().optional().or(z.literal('')),
    cash_account_id: z.string().uuid().optional().or(z.literal('')),
    payment_reference: z.string().optional().or(z.literal('')),
    voucher_date: z.string().min(1, 'Date is required'),
    notes: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.payee_type !== 'supplier' || !!data.supplier_id, {
    message: 'Select a supplier',
    path: ['supplier_id'],
  })
  .refine((data) => data.payee_type !== 'expense' || !!data.expense_category_id, {
    message: 'Select an expense category',
    path: ['expense_category_id'],
  })
  .refine((data) => data.payment_method !== 'bank' || !!data.bank_account_id, {
    message: 'Select a bank account',
    path: ['bank_account_id'],
  })
  .refine((data) => data.payment_method !== 'cash' || !!data.cash_account_id, {
    message: 'Select a cash account',
    path: ['cash_account_id'],
  })

export type PaymentVoucherFormInput = z.infer<typeof paymentVoucherFormSchema>
