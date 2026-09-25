import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { employeeRecordSchema, type EmployeeDocumentItem, type EmployeeRecordInput } from '@/schemas/employee'
import { NATIONALITIES, DOCUMENT_TYPES, optionLabel } from '../employeeOptions'
import {
  useEmployeeRecordQuery,
  useSaveEmployeeRecord,
  useScanEmployeeDocument,
  validateDocumentFile,
  type EmployeeRecordData,
  type ScannedEmployeeFields,
} from '../hooks/useEmployeeRecord'
import { EmployeeHeaderSection } from '../components/record/EmployeeHeaderSection'
import { VisaSponsorshipSection } from '../components/record/VisaSponsorshipSection'
import { EmployeeDocumentsSection } from '../components/record/EmployeeDocumentsSection'
import { EmploymentSalarySection, PassportSection } from '../components/record/PassportAndEmploymentSections'
import { VacationSection } from '../components/record/VacationSection'
import { ReplacementsSection } from '../components/record/ReplacementsSection'
import { RenewalSettlementSection } from '../components/record/RenewalSettlementSection'

const s = (v: string | null | undefined) => v ?? ''
const n = (v: number | null | undefined): number | '' => (v === null || v === undefined ? '' : v)

function toFormValues(id: string, restaurantId: string, record?: EmployeeRecordData): EmployeeRecordInput {
  const e = record?.employee
  return {
    id,
    full_name: s(e?.full_name),
    employee_code: s(e?.employee_code),
    current_restaurant_id: e?.current_restaurant_id ?? restaurantId,
    visa_sponsorship_type: s(e?.visa_sponsorship_type),
    sponsor_name: s(e?.sponsor_name),
    work_permit_category: s(e?.work_permit_category),
    visa_status: s(e?.visa_status),
    work_permit_expiry_available: e?.work_permit_expiry_available ?? true,
    work_permit_expiry: s(e?.work_permit_expiry),
    work_permit_salary: n(e?.work_permit_salary),
    work_permit_number: s(e?.work_permit_number),
    labour_permit_expiry: s(e?.labour_permit_expiry),
    permit_issue_date: s(e?.permit_issue_date),
    medical_expiry_date: s(e?.medical_expiry_date),
    emirates_id_expiry: s(e?.emirates_id_expiry),
    last_exit_date: s(e?.last_exit_date),
    presence_status: s(e?.presence_status),
    emirates_id: s(e?.emirates_id),
    labour_person_number: s(e?.labour_person_number),
    medical_entry_date: s(e?.medical_entry_date),
    last_in_country_date: s(e?.last_in_country_date),
    passport_number: s(e?.passport_number),
    passport_issue_date: s(e?.passport_issue_date),
    passport_expiry_date: s(e?.passport_expiry_date),
    nationality: s(e?.nationality),
    job_title: s(e?.job_title),
    base_salary: n(e?.base_salary),
    renewal_salary: n(e?.renewal_salary),
    flight_ticket_claimed: e?.flight_ticket_claimed ?? false,
    vacations: (record?.vacations ?? []).map((v) => ({
      record_id: v.id,
      start_date: v.start_date,
      end_date: s(v.end_date),
      paid_by: s(v.paid_by),
      amount: n(v.amount),
      ticket_claim_status: s(v.ticket_claim_status),
      attachment_id: v.attachment_id,
      attachment_name: v.attachments?.file_name ?? null,
      attachment_path: v.attachments?.storage_path ?? null,
    })),
    replacements: (record?.replacements ?? []).map((r) => ({
      record_id: r.id,
      replacement_employee_id: r.replacement_employee_id,
      candidate_name: r.employees?.full_name ?? s(r.candidate_name),
      position: s(r.position) || s(r.employees?.job_title),
      source: s(r.source) || s(r.employees?.restaurants?.name),
      availability: r.availability,
      available_from: s(r.available_from),
      notes: s(r.notes),
    })),
    decision_date: s(e?.decision_date),
    final_status: s(e?.final_status),
    settlement_date: s(e?.settlement_date),
    settlement_amount: n(e?.settlement_amount),
    labour_fine_amount: n(e?.labour_fine_amount),
    settlement_status: e?.settlement_status ?? 'pending',
    settlement_document_type: s(e?.settlement_document_type),
    settlement_reference: s(e?.settlement_reference),
    renewal_notes: s(e?.renewal_notes),
  }
}

function toDocumentItems(record?: EmployeeRecordData): EmployeeDocumentItem[] {
  return (record?.documents ?? []).map((d) => ({
    key: d.id,
    id: d.id,
    attachment_id: d.attachment_id ?? undefined,
    document_type: d.document_type,
    file_name: d.attachments?.file_name ?? 'Document',
    file_size_bytes: d.attachments?.file_size_bytes ?? 0,
    storage_path: d.attachments?.storage_path,
  }))
}

const isIsoDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

export default function EmployeeRecordPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const [newId] = useState(() => crypto.randomUUID())
  const employeeId = routeId ?? newId
  const isNew = !routeId

  const { selectedRestaurantId } = useRestaurantScope()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data: record, isLoading, error } = useEmployeeRecordQuery(routeId)
  const saveRecord = useSaveEmployeeRecord()
  const scanDocument = useScanEmployeeDocument()

  const form = useForm<EmployeeRecordInput>({
    resolver: zodResolver(employeeRecordSchema),
    defaultValues: toFormValues(employeeId, selectedRestaurantId ?? ''),
  })
  const [documents, setDocuments] = useState<EmployeeDocumentItem[]>([])
  const [docFilter, setDocFilter] = useState('all')

  useEffect(() => {
    if (!record) return
    form.reset(toFormValues(employeeId, selectedRestaurantId ?? '', record))
    setDocuments(toDocumentItems(record))
    // selectedRestaurantId only seeds a new record; don't re-reset on scope change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, employeeId, form])

  const passportDocs = useMemo(() => documents.filter((d) => d.document_type === 'passport'), [documents])
  const settlementDocs = useMemo(() => documents.filter((d) => d.document_type === 'settlement'), [documents])

  function attachFiles(files: File[], documentType: string) {
    const accepted: EmployeeDocumentItem[] = []
    for (const file of files) {
      const problem = validateDocumentFile(file)
      if (problem) toast.error(problem)
      else
        accepted.push({ key: crypto.randomUUID(), document_type: documentType, file_name: file.name, file_size_bytes: file.size, pending_file: file })
    }
    if (accepted.length) {
      setDocuments((prev) => [...prev, ...accepted])
      toast.success(`${accepted.length} ${optionLabel(DOCUMENT_TYPES, documentType).toLowerCase()} file${accepted.length === 1 ? '' : 's'} added — saved with the record`)
    }
  }

  function applyScannedFields(fields: ScannedEmployeeFields): string[] {
    const filled: string[] = []
    const set = (name: keyof EmployeeRecordInput, value: unknown, label: string, onlyIfEmpty = false) => {
      if (value === null || value === undefined || value === '') return
      if (onlyIfEmpty && form.getValues(name)) return
      form.setValue(name, value as never, { shouldDirty: true })
      filled.push(label)
    }
    const date = (name: keyof EmployeeRecordInput, value: string | null, label: string) => isIsoDate(value) && set(name, value, label)

    set('full_name', fields.full_name, 'name', true)
    set('job_title', fields.job_title, 'position', true)
    set('sponsor_name', fields.sponsor_name, 'sponsor', true)
    set('passport_number', fields.passport_number, 'passport number')
    date('passport_issue_date', fields.passport_issue_date, 'passport issue date')
    date('passport_expiry_date', fields.passport_expiry_date, 'passport expiry')
    set('emirates_id', fields.emirates_id_number, 'Emirates ID')
    date('emirates_id_expiry', fields.emirates_id_expiry, 'Emirates ID expiry')
    set('work_permit_number', fields.work_permit_number, 'work permit number')
    set('labour_person_number', fields.labour_person_number, 'labour list no.')
    date('permit_issue_date', fields.permit_issue_date, 'permit issue date')
    date('labour_permit_expiry', fields.labour_permit_expiry, 'labour expiry')
    if (isIsoDate(fields.labour_permit_expiry) && !form.getValues('work_permit_expiry')) {
      form.setValue('work_permit_expiry', fields.labour_permit_expiry, { shouldDirty: true })
    }
    date('medical_expiry_date', fields.medical_expiry_date, 'medical expiry')
    set('work_permit_salary', fields.work_permit_salary, 'work permit salary')
    if (fields.nationality) {
      const match = NATIONALITIES.find((nat) => nat.toLowerCase() === fields.nationality!.toLowerCase())
      if (match) set('nationality', match, 'nationality')
    }
    return filled
  }

  async function scanFiles(files: File[]) {
    const restaurantId = form.getValues('current_restaurant_id')
    if (!restaurantId) {
      toast.error('Select the branch first', { description: 'Documents are stored under the employee’s branch.' })
      return
    }
    for (const file of files) {
      const problem = validateDocumentFile(file)
      if (problem) {
        toast.error(problem)
        continue
      }
      try {
        const { fields, attachmentId, storagePath } = await scanDocument.mutateAsync({ file, restaurantId, employeeId })
        const documentType = DOCUMENT_TYPES.some((t) => t.value === fields.document_type) ? fields.document_type : 'other'
        setDocuments((prev) => [
          ...prev,
          { key: crypto.randomUUID(), attachment_id: attachmentId, storage_path: storagePath, document_type: documentType, file_name: file.name, file_size_bytes: file.size },
        ])
        const filled = applyScannedFields(fields)
        toast.success(`${file.name}: read as ${optionLabel(DOCUMENT_TYPES, documentType)}`, {
          description: filled.length ? `Filled ${filled.join(', ')}. Check the values before saving.` : 'No new fields found on this document.',
        })
      } catch (err) {
        toast.error(`Couldn't scan ${file.name}`, { description: (err as Error).message })
      }
    }
  }

  if (routeId && isLoading) return <FullScreenSpinner />
  if (routeId && error) return <p className="p-6 text-sm text-destructive">Unable to load this employee: {(error as Error).message}</p>

  return (
    <form
      className="mx-auto max-w-7xl space-y-5 pb-10"
      noValidate
      onSubmit={form.handleSubmit(
        (values) => saveRecord.mutateAsync({ values, documents }),
        () => {
          toast.error('Some fields need attention', { description: 'Check the highlighted fields.' })
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
      )}
    >
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Employees
        {isNew && <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">New employee</span>}
      </Link>

      <EmployeeHeaderSection form={form} restaurants={restaurants} docFilter={docFilter} onDocFilterChange={setDocFilter} />
      <VisaSponsorshipSection form={form} restaurants={restaurants} />
      <EmployeeDocumentsSection
        form={form}
        documents={documents}
        docFilter={docFilter}
        onDocFilterChange={setDocFilter}
        onAttach={attachFiles}
        onRemove={(key) => setDocuments((prev) => prev.filter((d) => d.key !== key))}
        onScan={scanFiles}
        scanning={scanDocument.isPending}
      />
      <PassportSection form={form} passportDocs={passportDocs} onAttachPassport={(files) => attachFiles(files, 'passport')} />
      <EmploymentSalarySection form={form} />
      <VacationSection form={form} />
      <ReplacementsSection form={form} />
      <RenewalSettlementSection
        form={form}
        settlementDocs={settlementDocs}
        onAttachProof={(files) => attachFiles(files, 'settlement')}
        onRemoveDoc={(key) => setDocuments((prev) => prev.filter((d) => d.key !== key))}
        saving={saveRecord.isPending}
      />
    </form>
  )
}
