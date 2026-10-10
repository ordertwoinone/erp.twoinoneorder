import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, Loader2, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { employeeRecordSchema, type EmployeeDocumentItem, type EmployeeRecordInput } from '@/schemas/employee'
import { DOCUMENT_TYPES, VISA_STEPS, normalizeNationality, optionLabel } from '../employeeOptions'
import {
  useDeleteEmployee,
  useEmployeeAssignments,
  useEmployeePayrollHistory,
  useEmployeeRecordQuery,
  useSaveEmployeeRecord,
  useScanEmployeeDocument,
  validateDocumentFile,
  type EmployeeRecordData,
  type ScannedEmployeeFields,
} from '../hooks/useEmployeeRecord'
import { EmployeeHeaderSection, EmployeeKpiStrip, RecordModeBar } from '../components/record/EmployeeHeaderSection'
import { RecordLockProvider } from '../components/record/RecordLock'
import { useRecordLock } from '../components/record/recordLockContext'
import { TypingCentreSection } from '../components/record/TypingCentreSection'
import { IssuesSection, ItemsSection, LabourFineSection, LoansSection, ProbationSection } from '../components/record/PeopleSections'
import { IncentivesSection, SalaryLedgerSection, SectionAccessTable, TransferHistorySection } from '../components/record/HistorySections'
import { VisaSponsorshipSection } from '../components/record/VisaSponsorshipSection'
import { EmployeeDocumentsSection } from '../components/record/EmployeeDocumentsSection'
import { EmploymentSalarySection, PassportSection } from '../components/record/PassportAndEmploymentSections'
import { VacationSection } from '../components/record/VacationSection'
import { ReplacementsSection } from '../components/record/ReplacementsSection'
import { RenewalSettlementSection } from '../components/record/RenewalSettlementSection'
import { EntrySection, InsuranceSection } from '../components/record/EntryAndInsuranceSections'
import { VisitVisaFundingSection } from '../components/record/VisitVisaFundingSection'

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
    initial_visa_type: s(e?.initial_visa_type),
    entry_date: s(e?.entry_date),
    allowed_stay_days: n(e?.allowed_stay_days),
    passport_status: s(e?.passport_status),
    passport_location: s(e?.passport_location),
    health_insurance_expiry: s(e?.health_insurance_expiry),
    insurance_applicable: e?.insurance_applicable ?? false,
    insurance_start_date: s(e?.insurance_start_date),
    insurance_expiry_date: s(e?.insurance_expiry_date),
    insurance_fine_applicable: e?.insurance_fine_applicable ?? false,
    insurance_fine_amount: n(e?.insurance_fine_amount),
    insurance_status: s(e?.insurance_status),
    visit_visa_source: s(e?.visit_visa_source),
    visit_visa_support: s(e?.visit_visa_support),
    visit_visa_cost: n(e?.visit_visa_cost),
    visit_visa_loan_amount: n(e?.visit_visa_loan_amount),
    visit_visa_disbursed_date: s(e?.visit_visa_disbursed_date),
    visit_visa_repayment_start: s(e?.visit_visa_repayment_start),
    visit_visa_monthly_deduction: n(e?.visit_visa_monthly_deduction),
    visit_visa_recovered_amount: n(e?.visit_visa_recovered_amount),
    visa_steps: VISA_STEPS.map(({ key }) => {
      const saved = record?.visaSteps.find((v) => v.step_key === key)
      return {
        step_key: key,
        step_option: s(saved?.step_option),
        status: saved?.status ?? 'not_started',
        application_date: s(saved?.application_date),
        approval_date: s(saved?.approval_date),
        expiry_date: s(saved?.expiry_date),
        expiry_not_applicable: saved?.expiry_not_applicable ?? false,
        government_fee: n(saved?.government_fee),
        other_charges: n(saved?.other_charges),
        fine_amount: n(saved?.fine_amount),
        fine_status: s(saved?.fine_status),
        fine_reason: s(saved?.fine_reason),
        company_category_value_id: saved?.company_category_value_id ?? null,
        category_paid: saved?.category_paid ?? null,
        notes: s(saved?.notes),
        attachment_id: saved?.attachment_id ?? null,
        attachment_name: saved?.attachments?.file_name ?? null,
        attachment_path: saved?.attachments?.storage_path ?? null,
      }
    }),
    joining_date: s(e?.joining_date),
    photo_attachment_id: e?.photo_attachment_id ?? null,
    performance_rating: n(e?.performance_rating),
    probation_months: n(e?.probation_months),
    probation_end_date: s(e?.probation_end_date),
    probation_status: s(e?.probation_status),
    typing_centre_name: s(e?.typing_centre_name),
    typing_centre_contact: s(e?.typing_centre_contact),
    typing_application_ref: s(e?.typing_application_ref),
    typing_process: s(e?.typing_process) || 'new_employment_visa',
    labour_fine_status: s(e?.labour_fine_status),
    labour_fine_checked_date: s(e?.labour_fine_checked_date),
    labour_fine_reference: s(e?.labour_fine_reference),
    labour_fine_remarks: s(e?.labour_fine_remarks),
    labour_fine_attachment_id: e?.labour_fine_attachment_id ?? null,
    labour_fine_attachment_name: record?.labourFineFile?.file_name ?? null,
    labour_fine_attachment_path: record?.labourFineFile?.storage_path ?? null,
    loan_monthly_installment: n(e?.loan_monthly_installment),
    incentive_enabled: e?.incentive_enabled ?? false,
    incentive_basis: s(e?.incentive_basis) || 'eligible_sales',
    incentive_rate: n(e?.incentive_rate),
    typing_payments: (record?.typingPayments ?? []).map((p) => ({
      record_id: p.id,
      step_key: p.step_key,
      invoice_amount: n(p.invoice_amount),
      payment_amount: n(p.payment_amount),
      payment_date: s(p.payment_date),
      payment_method: s(p.payment_method),
      reference: s(p.reference),
      paid_by: s(p.paid_by),
      attachment_id: p.attachment_id,
      attachment_name: p.attachments?.file_name ?? null,
      attachment_path: p.attachments?.storage_path ?? null,
    })),
    issues: (record?.issues ?? []).map((i) => ({
      record_id: i.id,
      issue_date: i.issue_date,
      issue_type: i.issue_type,
      description: s(i.description),
      assigned_to: s(i.assigned_to),
      status: i.status,
      attachment_id: i.attachment_id,
      attachment_name: i.attachments?.file_name ?? null,
      attachment_path: i.attachments?.storage_path ?? null,
    })),
    items: (record?.items ?? []).map((i) => ({
      record_id: i.id,
      item_name: i.item_name,
      category: i.category,
      quantity: i.quantity,
      size_allocation: s(i.size_allocation),
      issued_date: s(i.issued_date),
      condition: i.condition,
      acknowledged: i.acknowledged,
    })),
    monthly_records: (record?.monthlyRecords ?? []).map((m) => ({
      record_id: m.id,
      period_month: m.period_month.slice(0, 7),
      restaurant_id: s(m.restaurant_id),
      attendance_days: n(m.attendance_days),
      working_days: n(m.working_days),
      eligible_sales: n(m.eligible_sales),
      orders_count: n(m.orders_count),
      incentive_rate: n(m.incentive_rate),
      status: m.status,
    })),
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
  const deleteEmployee = useDeleteEmployee()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { data: payroll, isLoading: payrollLoading } = useEmployeePayrollHistory(routeId, hasPermission('payroll.view'))
  const { data: assignments, isLoading: assignmentsLoading } = useEmployeeAssignments(routeId)

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
  const insuranceDocs = useMemo(() => documents.filter((d) => d.document_type === 'insurance'), [documents])

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
    set('nationality', normalizeNationality(fields.nationality), 'nationality')
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
    <RecordLockProvider isNew={isNew}>
    <form
      className="mx-auto max-w-7xl space-y-5 pb-24"
      noValidate
      onSubmit={form.handleSubmit(
        (values) => saveRecord.mutateAsync({ values, documents }),
        () => {
          toast.error('Some fields need attention', { description: 'Check the highlighted fields — the section may need unlocking.' })
        },
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Employees
          {isNew && <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">New employee</span>}
        </Link>
        {!isNew && (
          <ConfirmActionDialog
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 /> Delete employee
              </Button>
            }
            title={`Delete ${record?.employee.full_name ?? 'this employee'}?`}
            description="This permanently removes the employee with their documents, vacations and replacement shortlist. Employees with payroll or other financial history can't be deleted — set them to Terminated or Resigned instead."
            confirmLabel="Delete employee"
            destructive
            onConfirm={async () => {
              await deleteEmployee.mutateAsync(employeeId)
              navigate('/employees', { replace: true })
            }}
          />
        )}
      </div>

      <RecordModeBar isNew={isNew} />
      <EmployeeHeaderSection form={form} restaurants={restaurants} photoPath={record?.photo?.storage_path} />
      <EmployeeKpiStrip form={form} />
      <EntrySection form={form} />
      <div className="grid gap-5 xl:grid-cols-2">
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
      </div>
      <TypingCentreSection form={form} />
      <div className="grid gap-5 xl:grid-cols-2">
        <PassportSection form={form} passportDocs={passportDocs} onAttachPassport={(files) => attachFiles(files, 'passport')} />
        <div className="space-y-5">
          <EmploymentSalarySection form={form} />
          <InsuranceSection
            form={form}
            insuranceDocs={insuranceDocs}
            onAttach={(files) => attachFiles(files, 'insurance')}
            onRemoveDoc={(key) => setDocuments((prev) => prev.filter((d) => d.key !== key))}
          />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ProbationSection form={form} />
        <LoansSection form={form} history={payroll} loading={payrollLoading} employeeId={employeeId} isNew={isNew} />
      </div>
      <VacationSection form={form} />
      <IssuesSection form={form} />
      <ItemsSection form={form} />
      <div className="grid gap-5 xl:grid-cols-2">
        <LabourFineSection form={form} />
        <VisitVisaFundingSection form={form} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <TransferHistorySection assignments={assignments} loading={assignmentsLoading} />
        <ReplacementsSection form={form} />
      </div>
      <IncentivesSection form={form} restaurants={restaurants} />
      <SalaryLedgerSection history={payroll} loading={payrollLoading} />
      <RenewalSettlementSection
        form={form}
        settlementDocs={settlementDocs}
        onAttachProof={(files) => attachFiles(files, 'settlement')}
        onRemoveDoc={(key) => setDocuments((prev) => prev.filter((d) => d.key !== key))}
        saving={saveRecord.isPending}
      />
      <SectionAccessTable />
      <StickySaveBar saving={saveRecord.isPending} dirty={form.formState.isDirty || documents.some((d) => d.pending_file)} />
    </form>
    </RecordLockProvider>
  )
}

/** Shown whenever something is editable, so Save is always one click away. */
function StickySaveBar({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  const lock = useRecordLock()
  if (!lock.anyUnlocked) return null
  return (
    <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-end gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <span className="mr-auto text-sm text-muted-foreground">{dirty ? 'You have unsaved changes' : 'No changes yet'}</span>
      {!lock.alwaysUnlocked && (
        <Button type="button" variant="outline" onClick={lock.lockAll}>
          <Eye /> Back to view mode
        </Button>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
      </Button>
    </div>
  )
}
