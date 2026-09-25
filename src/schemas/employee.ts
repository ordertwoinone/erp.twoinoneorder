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
  emirates_id: z.string().optional().or(z.literal('')),
  emirates_id_expiry: z.string().optional().or(z.literal('')),
  medical_entry_date: z.string().optional().or(z.literal('')),
  last_in_country_date: z.string().optional().or(z.literal('')),
  final_status: z.enum(['renew', 'cancel']).optional().or(z.literal('')),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
