import { z } from 'zod'

export const salaryEntryFormSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid('Select an employee'),
  restaurant_id: z.string().uuid('Select a restaurant'),
  period_month: z.string().min(1, 'Period is required'),
  basic_salary: z.coerce.number().min(0),
  allowances_total: z.coerce.number().min(0),
  overtime_amount: z.coerce.number().min(0),
  deductions_total: z.coerce.number().min(0),
  advances_deducted: z.coerce.number().min(0),
})

export type SalaryEntryFormInput = z.infer<typeof salaryEntryFormSchema>
