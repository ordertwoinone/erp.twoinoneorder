import { z } from 'zod'

export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  employee_code: z.string().trim().min(1, 'Employee code is required'),
  full_name: z.string().trim().min(1, 'Name is required'),
  job_title: z.string().optional().or(z.literal('')),
  joining_date: z.string().optional().or(z.literal('')),
  current_restaurant_id: z.string().uuid().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  employment_status: z.enum(['active', 'on_leave', 'terminated', 'resigned']),
  is_shared_employee: z.boolean(),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
