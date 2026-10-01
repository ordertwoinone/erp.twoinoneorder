import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { readApiResponse } from '@/lib/utils/readApiResponse'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import { computeIncentive } from '../components/record/recordUtils'

const BUCKET = 'employee-documents'
const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_BYTES = 20 * 1024 * 1024

export function useEmployeeRecordQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', 'record', id],
    enabled: !!id,
    queryFn: async () => {
      const [employeeRes, documentsRes, vacationsRes, replacementsRes, visaStepsRes, paymentsRes, issuesRes, itemsRes, monthlyRes] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id!).single(),
        supabase
          .from('employee_documents')
          .select('id, document_type, attachment_id, attachments(file_name, storage_path, file_size_bytes)')
          .eq('employee_id', id!)
          .order('created_at'),
        supabase
          .from('employee_vacations')
          .select('*, attachments(file_name, storage_path)')
          .eq('employee_id', id!)
          .order('start_date', { ascending: false }),
        supabase
          .from('employee_replacements')
          .select('*, employees!employee_replacements_replacement_employee_id_fkey(full_name, job_title, restaurants(name))')
          .eq('employee_id', id!)
          .order('created_at'),
        supabase.from('employee_visa_steps').select('*, attachments(file_name, storage_path)').eq('employee_id', id!),
        supabase
          .from('employee_typing_payments')
          .select('*, attachments(file_name, storage_path)')
          .eq('employee_id', id!)
          .order('payment_date', { nullsFirst: true })
          .order('created_at'),
        supabase.from('employee_issues').select('*, attachments(file_name, storage_path)').eq('employee_id', id!).order('issue_date', { ascending: false }),
        supabase.from('employee_items').select('*').eq('employee_id', id!).order('created_at'),
        supabase.from('employee_monthly_records').select('*').eq('employee_id', id!).order('period_month', { ascending: false }),
      ])
      for (const res of [employeeRes, documentsRes, vacationsRes, replacementsRes, visaStepsRes, paymentsRes, issuesRes, itemsRes, monthlyRes]) {
        if (res.error) throw res.error
      }
      const employee = employeeRes.data!

      // Photo and labour-fine proof hang off employees by attachment id.
      const fileIds = [employee.photo_attachment_id, employee.labour_fine_attachment_id].filter((v): v is string => !!v)
      const files = fileIds.length
        ? ((await supabase.from('attachments').select('id, file_name, storage_path').in('id', fileIds)).data ?? [])
        : []
      const file = (fileId: string | null) => files.find((f) => f.id === fileId) ?? null

      return {
        employee,
        documents: documentsRes.data!,
        vacations: vacationsRes.data!,
        replacements: replacementsRes.data!,
        visaSteps: visaStepsRes.data!,
        typingPayments: paymentsRes.data!,
        issues: issuesRes.data!,
        items: itemsRes.data!,
        monthlyRecords: monthlyRes.data!,
        photo: file(employee.photo_attachment_id),
        labourFineFile: file(employee.labour_fine_attachment_id),
      }
    },
  })
}

export type EmployeeRecordData = NonNullable<ReturnType<typeof useEmployeeRecordQuery>['data']>

export function validateDocumentFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) return `${file.name}: only PDF, JPG, PNG or WebP files are allowed.`
  if (file.size > MAX_FILE_BYTES) return `${file.name}: file is larger than 20 MB.`
  return null
}

/** Uploads to the branch-scoped storage path and records the attachment. */
export async function uploadEmployeeFile(file: File, restaurantId: string, employeeId: string) {
  const storagePath = `${restaurantId}/employee/${employeeId}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type })
  if (uploadError) throw new Error(`Uploading ${file.name} failed: ${uploadError.message}`)

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      restaurant_id: restaurantId,
      entity_type: 'employee',
      entity_id: employeeId,
      category: 'employee-documents',
      storage_bucket: BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Saving ${file.name} failed: ${error.message}`)
  return { attachmentId: data.id, storagePath }
}

export async function openEmployeeFile(storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 120)
  if (error || !data) {
    toast.error('Unable to open file', { description: error?.message })
    return
  }
  window.open(data.signedUrl, '_blank', 'noopener')
}

export function useSaveEmployeeRecord() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({ values, documents }: { values: EmployeeRecordInput; documents: EmployeeDocumentItem[] }) => {
      const restaurantId = values.current_restaurant_id

      const savedDocuments = []
      for (const doc of documents) {
        if (doc.pending_file) {
          const { attachmentId } = await uploadEmployeeFile(doc.pending_file, restaurantId, values.id)
          savedDocuments.push({ document_type: doc.document_type, attachment_id: attachmentId })
        } else {
          savedDocuments.push({ id: doc.id ?? null, document_type: doc.document_type, attachment_id: doc.attachment_id })
        }
      }

      const vacations = []
      for (const v of values.vacations) {
        let attachmentId = v.attachment_id ?? null
        if (v.pending_file instanceof File) {
          attachmentId = (await uploadEmployeeFile(v.pending_file, restaurantId, values.id)).attachmentId
        }
        vacations.push({
          id: v.record_id ?? null,
          start_date: v.start_date,
          end_date: v.end_date || null,
          paid_by: v.paid_by || null,
          amount: v.amount === '' ? null : v.amount,
          ticket_claim_status: v.ticket_claim_status || null,
          attachment_id: attachmentId,
        })
      }

      // Only steps with something entered are stored; the rest stay "not started".
      const visaSteps = []
      for (const step of values.visa_steps) {
        let attachmentId = step.attachment_id ?? null
        if (step.pending_file instanceof File) {
          attachmentId = (await uploadEmployeeFile(step.pending_file, restaurantId, values.id)).attachmentId
        }
        const { attachment_name: _n, attachment_path: _p, pending_file: _f, ...rest } = step
        const hasData =
          rest.status !== 'not_started' ||
          attachmentId ||
          Object.entries(rest).some(([k, v]) => k !== 'step_key' && k !== 'status' && v !== '' && v !== undefined && v !== null && v !== false)
        if (hasData) visaSteps.push({ ...rest, attachment_id: attachmentId })
      }

      const upload = async (file: unknown, current: string | null | undefined) =>
        file instanceof File ? (await uploadEmployeeFile(file, restaurantId, values.id)).attachmentId : (current ?? null)

      const typingPayments = []
      for (const p of values.typing_payments) {
        const { record_id, attachment_name: _n, attachment_path: _p, pending_file, ...rest } = p
        typingPayments.push({ ...rest, id: record_id, attachment_id: await upload(pending_file, p.attachment_id) })
      }
      const issues = []
      for (const issue of values.issues) {
        const { record_id, attachment_name: _n, attachment_path: _p, pending_file, ...rest } = issue
        issues.push({ ...rest, id: record_id, attachment_id: await upload(pending_file, issue.attachment_id) })
      }
      const photoAttachmentId = await upload(values.photo_pending_file, values.photo_attachment_id)
      const labourFineAttachmentId = await upload(values.labour_fine_pending_file, values.labour_fine_attachment_id)

      const {
        vacations: _v,
        replacements,
        visa_steps: _s,
        typing_payments: _tp,
        issues: _i,
        items,
        monthly_records,
        photo_pending_file: _pf,
        labour_fine_pending_file: _lf,
        labour_fine_attachment_name: _ln,
        labour_fine_attachment_path: _lp,
        ...fields
      } = values
      const payload = {
        ...fields,
        photo_attachment_id: photoAttachmentId,
        labour_fine_attachment_id: labourFineAttachmentId,
        visa_steps: visaSteps,
        typing_payments: typingPayments,
        issues,
        items: items.map(({ record_id, ...rest }) => ({ ...rest, id: record_id })),
        monthly_records: monthly_records.map(({ record_id, period_month, ...rest }) => ({
          ...rest,
          id: record_id,
          period_month: `${period_month}-01`,
          incentive_amount: fields.incentive_enabled ? computeIncentive(rest, fields.incentive_basis) : '',
        })),
        work_permit_salary: fields.work_permit_salary === '' ? null : fields.work_permit_salary,
        base_salary: fields.base_salary === '' ? null : fields.base_salary,
        renewal_salary: fields.renewal_salary === '' ? null : fields.renewal_salary,
        settlement_amount: fields.settlement_amount === '' ? null : fields.settlement_amount,
        labour_fine_amount: fields.labour_fine_amount === '' ? null : fields.labour_fine_amount,
        documents: savedDocuments,
        vacations,
        replacements: replacements.map((r) => ({
          id: r.record_id ?? null,
          replacement_employee_id: r.replacement_employee_id || null,
          candidate_name: r.replacement_employee_id ? null : r.candidate_name || null,
          position: r.position || null,
          source: r.source || null,
          availability: r.availability,
          available_from: r.available_from || null,
          notes: r.notes || null,
        })),
      }

      const { data, error } = await supabase.rpc('save_employee_record', { payload: payload as never })
      if (error) throw error
      return data as string
    },
    onSuccess: (employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee record saved')
      navigate(`/employees/${employeeId}`, { replace: true })
    },
    onError: (error: Error) => {
      toast.error('Unable to save employee record', { description: error.message })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_employee', { p_employee_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee deleted')
    },
    onError: (error: Error) => {
      toast.error('Unable to delete employee', { description: error.message })
    },
  })
}

/**
 * Salary entries and loans (employee_advances) from Payroll. Both need
 * payroll.view under RLS; without it they come back empty, and the page hides
 * those sections anyway.
 */
export function useEmployeePayrollHistory(employeeId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['employees', 'payroll-history', employeeId],
    enabled: !!employeeId && enabled,
    queryFn: async () => {
      const [entriesRes, advancesRes] = await Promise.all([
        supabase
          .from('salary_entries')
          .select('id, period_month, basic_salary, allowances_total, overtime_amount, deductions_total, advances_deducted, net_salary, payment_status, status, salary_payments(amount)')
          .eq('employee_id', employeeId!)
          .neq('status', 'cancelled')
          .order('period_month'),
        supabase.from('employee_advances').select('*').eq('employee_id', employeeId!).neq('status', 'cancelled').order('advance_date'),
      ])
      if (entriesRes.error) throw entriesRes.error
      if (advancesRes.error) throw advancesRes.error
      return { entries: entriesRes.data, advances: advancesRes.data }
    },
  })
}

export type PayrollHistory = NonNullable<ReturnType<typeof useEmployeePayrollHistory>['data']>

export function useRecordLoan(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { restaurantId: string; amount: number; date: string; notes: string }) => {
      const { error } = await supabase.from('employee_advances').insert({
        employee_id: employeeId,
        restaurant_id: input.restaurantId,
        amount: input.amount,
        balance_remaining: input.amount,
        advance_date: input.date,
        notes: input.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'payroll-history', employeeId] })
      toast.success('Loan recorded')
    },
    onError: (error: Error) => toast.error('Unable to record loan', { description: error.message }),
  })
}

export function useEmployeeAssignments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employees', 'assignments', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_assignments')
        .select('id, starts_at, ends_at, restaurants(name, code)')
        .eq('employee_id', employeeId!)
        .order('starts_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Short-lived signed URL for showing an image (e.g. the employee photo). */
export function useSignedFileUrl(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: ['employee-file-url', storagePath],
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export interface ScannedEmployeeFields {
  document_type: string
  full_name: string | null
  nationality: string | null
  passport_number: string | null
  passport_issue_date: string | null
  passport_expiry_date: string | null
  emirates_id_number: string | null
  emirates_id_expiry: string | null
  work_permit_number: string | null
  labour_person_number: string | null
  permit_issue_date: string | null
  labour_permit_expiry: string | null
  medical_expiry_date: string | null
  sponsor_name: string | null
  job_title: string | null
  work_permit_salary: number | null
  confidence: number
}

/** Uploads a document, has the AI read it, and returns the fields found plus the saved attachment. */
export function useScanEmployeeDocument() {
  return useMutation({
    mutationFn: async ({ file, restaurantId, employeeId }: { file: File; restaurantId: string; employeeId: string }) => {
      const { attachmentId, storagePath } = await uploadEmployeeFile(file, restaurantId, employeeId)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const response = await fetch('/api/scan-employee-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ storagePath, mimeType: file.type }),
      })
      const result = await readApiResponse<{ fields: ScannedEmployeeFields }>(response, `Scanning ${file.name} failed`)
      return { fields: result.fields, attachmentId, storagePath }
    },
  })
}

export async function searchEmployees(term: string, excludeId?: string) {
  const trimmed = term.trim()
  if (!trimmed) return []
  let query = supabase
    .from('employees')
    .select('id, employee_code, full_name, job_title, restaurants(name)')
    .or(`full_name.ilike.%${trimmed}%,employee_code.ilike.%${trimmed}%`)
    .order('full_name')
    .limit(8)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error
  return data
}
