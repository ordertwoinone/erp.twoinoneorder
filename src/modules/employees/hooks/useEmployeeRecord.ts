import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { readApiResponse } from '@/lib/utils/readApiResponse'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'

const BUCKET = 'employee-documents'
const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_BYTES = 20 * 1024 * 1024

export function useEmployeeRecordQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', 'record', id],
    enabled: !!id,
    queryFn: async () => {
      const [employeeRes, documentsRes, vacationsRes, replacementsRes] = await Promise.all([
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
      ])
      if (employeeRes.error) throw employeeRes.error
      if (documentsRes.error) throw documentsRes.error
      if (vacationsRes.error) throw vacationsRes.error
      if (replacementsRes.error) throw replacementsRes.error
      return {
        employee: employeeRes.data,
        documents: documentsRes.data,
        vacations: vacationsRes.data,
        replacements: replacementsRes.data,
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

      const { vacations: _v, replacements, ...fields } = values
      const payload = {
        ...fields,
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
