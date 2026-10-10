import { z } from 'zod'

const optionalText = z.string().trim().optional().or(z.literal(''))
const optionalDate = z.string().optional().or(z.literal(''))
// '' first: z.coerce.number would turn a blank field into 0.
const optionalAmount = z.union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative')]).optional()

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

// Typing-centre step. application_date is shown as "Process start date".
export const visaStepRowSchema = z.object({
  step_key: z.string(),
  step_option: optionalText,
  status: z.string(),
  application_date: optionalDate,
  approval_date: optionalDate,
  expiry_date: optionalDate,
  expiry_not_applicable: z.boolean(),
  government_fee: optionalAmount,
  other_charges: optionalAmount,
  fine_amount: optionalAmount,
  fine_status: optionalText,
  fine_reason: optionalText,
  /** Value picked from a company category (its amount becomes the step amount). */
  company_category_value_id: z.string().nullable().optional(),
  /** Whether the category amount is already paid (null = not answered). */
  category_paid: z.boolean().nullable().optional(),
  notes: optionalText,
  attachment_id: z.string().optional().nullable(),
  attachment_name: z.string().optional().nullable(),
  attachment_path: z.string().optional().nullable(),
  pending_file: z.any().optional(),
})
export type VisaStepRow = z.infer<typeof visaStepRowSchema>

// The rows below keep their DB id in `record_id` (client-generated for new
// rows) because useFieldArray reserves `id`.
const attachmentFields = {
  attachment_id: z.string().optional().nullable(),
  attachment_name: z.string().optional().nullable(),
  attachment_path: z.string().optional().nullable(),
  pending_file: z.any().optional(),
}

export const typingPaymentRowSchema = z.object({
  record_id: z.string(),
  step_key: z.string().min(1, 'Choose the service'),
  invoice_amount: optionalAmount,
  payment_amount: z.union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative')]).refine((v): boolean => v !== '', 'Enter the amount paid'),
  payment_date: optionalDate,
  payment_method: optionalText,
  reference: optionalText,
  paid_by: optionalText,
  ...attachmentFields,
})
export type TypingPaymentRow = z.infer<typeof typingPaymentRowSchema>

export const issueRowSchema = z.object({
  record_id: z.string(),
  issue_date: z.string().min(1, 'Date is required'),
  issue_type: z.string(),
  description: optionalText,
  assigned_to: optionalText,
  status: z.string(),
  ...attachmentFields,
})
export type IssueRow = z.infer<typeof issueRowSchema>

export const itemRowSchema = z.object({
  record_id: z.string(),
  item_name: z.string().trim().min(1, 'Item is required'),
  category: z.string(),
  quantity: z.union([z.literal(''), z.coerce.number().int().min(0)]).optional(),
  size_allocation: optionalText,
  issued_date: optionalDate,
  condition: z.string(),
  acknowledged: z.boolean(),
})
export type ItemRow = z.infer<typeof itemRowSchema>

export const monthlyRecordRowSchema = z.object({
  record_id: z.string(),
  period_month: z.string().regex(/^\d{4}-\d{2}$/, 'Pick a month'),
  restaurant_id: optionalText,
  attendance_days: z.union([z.literal(''), z.coerce.number().int().min(0).max(31)]).optional(),
  working_days: z.union([z.literal(''), z.coerce.number().int().min(0).max(31)]).optional(),
  eligible_sales: optionalAmount,
  orders_count: z.union([z.literal(''), z.coerce.number().int().min(0)]).optional(),
  incentive_rate: z.union([z.literal(''), z.coerce.number().min(0).max(100)]).optional(),
  status: z.string(),
})
export type MonthlyRecordRow = z.infer<typeof monthlyRecordRowSchema>

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

  initial_visa_type: optionalText,
  entry_date: optionalDate,
  allowed_stay_days: z.union([z.literal(''), z.coerce.number().int('Whole days only').min(0, 'Cannot be negative')]).optional(),
  passport_status: optionalText,
  passport_location: optionalText,
  health_insurance_expiry: optionalDate,
  insurance_applicable: z.boolean(),
  insurance_start_date: optionalDate,
  insurance_expiry_date: optionalDate,
  insurance_fine_applicable: z.boolean(),
  insurance_fine_amount: optionalAmount,
  insurance_status: optionalText,
  visit_visa_source: optionalText,
  visit_visa_support: optionalText,
  visit_visa_cost: optionalAmount,
  visit_visa_loan_amount: optionalAmount,
  visit_visa_disbursed_date: optionalDate,
  visit_visa_repayment_start: optionalDate,
  visit_visa_monthly_deduction: optionalAmount,
  visit_visa_recovered_amount: optionalAmount,
  visa_steps: z.array(visaStepRowSchema),

  joining_date: optionalDate,
  photo_attachment_id: z.string().optional().nullable(),
  photo_pending_file: z.any().optional(),
  performance_rating: z.union([z.literal(''), z.coerce.number().min(0, '0 – 5').max(5, '0 – 5')]).optional(),
  probation_months: z.union([z.literal(''), z.coerce.number().int().min(0).max(24)]).optional(),
  probation_end_date: optionalDate,
  probation_status: optionalText,
  typing_centre_name: optionalText,
  typing_centre_contact: optionalText,
  typing_application_ref: optionalText,
  typing_process: optionalText,
  labour_fine_status: optionalText,
  labour_fine_checked_date: optionalDate,
  labour_fine_reference: optionalText,
  labour_fine_remarks: optionalText,
  labour_fine_attachment_id: z.string().optional().nullable(),
  labour_fine_attachment_name: z.string().optional().nullable(),
  labour_fine_attachment_path: z.string().optional().nullable(),
  labour_fine_pending_file: z.any().optional(),
  loan_monthly_installment: optionalAmount,
  incentive_enabled: z.boolean(),
  incentive_basis: optionalText,
  incentive_rate: z.union([z.literal(''), z.coerce.number().min(0).max(100)]).optional(),
  typing_payments: z.array(typingPaymentRowSchema),
  issues: z.array(issueRowSchema),
  items: z.array(itemRowSchema),
  monthly_records: z
    .array(monthlyRecordRowSchema)
    .refine((rows) => new Set(rows.map((r) => r.period_month)).size === rows.length, 'Each month can only appear once'),
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
