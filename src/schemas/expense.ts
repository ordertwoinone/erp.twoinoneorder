import { z } from 'zod'

export const expenseFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  expense_category_id: z.string().uuid('Select a category'),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  expense_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional().or(z.literal('')),
})

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>
