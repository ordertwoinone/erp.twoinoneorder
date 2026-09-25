import { z } from 'zod'

const optionalText = z.string().trim().optional().or(z.literal(''))
const optionalDate = z.string().optional().or(z.literal(''))
const optionalAmount = z.coerce.number().min(0, 'Cannot be negative').optional().or(z.literal(''))

export const vacationRowSchema = z.object({
  // Not `id`: useFieldArray reserves that key for its own row keys.
  record_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: optionalDate,
  paid_by: optionalText,
  amount: optionalAmount,
  ticket_claim_status: optionalText,
  attachment_id: z.string().optional().nullable(),
  attachment_name: z.string().optional().nullable(),
  attachment_path: z.string().optional().nullable(),
  pending_file: z.any().optional(),
})
export type VacationRow = z.infer<typeof vacationRowSchema>

export const replacementRowSchema = z.object({
  record_id: z.string().optional(),
  replacement_employee_id: z.string().optional().nullable(),
  candidate_name: optionalText,
  position: optionalText,
  source: optionalText,
  availability: z.string(),
  available_from: optionalDate,
  notes: optionalText,
})
export type ReplacementRow = z.infer<typeof replacementRowSchema>

export const employeeRecordSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1, 'Employee name is required'),
  employee_code: optionalText,
  current_restaurant_id: z.string().uuid('Select a branch'),

  visa_sponsorship_type: optionalText,
  sponsor_name: optionalText,
  work_permit_category: optionalText,
  visa_status: optionalText,
  work_permit_expiry_available: z.boolean(),
  work_permit_expiry: optionalDate,
  work_permit_salary: optionalAmount,
  work_permit_number: optionalText,

  labour_permit_expiry: optionalDate,
  permit_issue_date: optionalDate,
  medical_expiry_date: optionalDate,
  emirates_id_expiry: optionalDate,
  last_exit_date: optionalDate,
  presence_status: optionalText,
  emirates_id: optionalText,
  labour_person_number: optionalText,
  medical_entry_date: optionalDate,
  last_in_country_date: optionalDate,

  passport_number: optionalText,
  passport_issue_date: optionalDate,
  passport_expiry_date: optionalDate,
  nationality: optionalText,

  job_title: optionalText,
  base_salary: optionalAmount,
  renewal_salary: optionalAmount,

  flight_ticket_claimed: z.boolean(),
  vacations: z.array(vacationRowSchema),
  replacements: z.array(replacementRowSchema),

  decision_date: optionalDate,
  final_status: optionalText,
  settlement_date: optionalDate,
  settlement_amount: optionalAmount,
  labour_fine_amount: optionalAmount,
  settlement_status: z.string(),
  settlement_document_type: optionalText,
  settlement_reference: optionalText,
  renewal_notes: optionalText,
})

export type EmployeeRecordInput = z.infer<typeof employeeRecordSchema>

/** A document attached to the record — either already saved, or picked and waiting for Save. */
export interface EmployeeDocumentItem {
  key: string
  id?: string
  attachment_id?: string
  document_type: string
  file_name: string
  file_size_bytes: number
  storage_path?: string
  pending_file?: File
}
