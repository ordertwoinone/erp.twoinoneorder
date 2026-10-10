import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { UseFormReturn } from 'react-hook-form'
import { format } from 'date-fns'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import {
  DECISIONS,
  DOCUMENT_TYPES,
  FINE_STATUSES,
  INITIAL_VISA_TYPES,
  INSURANCE_STATUSES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  LABOUR_FINE_STATUSES,
  PAID_BY,
  PASSPORT_STATUSES,
  PAYMENT_METHODS,
  PRESENCE_STATUSES,
  PROBATION_STATUSES,
  SETTLEMENT_DOCUMENT_TYPES,
  SETTLEMENT_STATUSES,
  TICKET_CLAIM_STATUSES,
  TICKET_PAID_BY,
  TYPING_PROCESSES,
  VISA_SPONSORSHIP_TYPES,
  VISA_STATUSES,
  VISA_STEPS,
  VISA_STEP_STATUSES,
  VISIT_VISA_SOURCES,
  VISIT_VISA_SUPPORT,
  optionLabel,
  type Option,
} from '../../employeeOptions'
import { useSignedFileUrl } from '../../hooks/useEmployeeRecord'
import { useCompanyCategoriesQuery } from '../../hooks/useCompanyCategories'
import { countdown, num, shortDate, stepPaid } from './recordUtils'

const money = (v: unknown) => (v === '' || v === null || v === undefined ? '—' : `AED ${num(v).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const date = (v: string | null | undefined) => (v ? shortDate(v) : '—')
const label = (options: Option[], v: string | null | undefined) => (v ? optionLabel(options, v) : '—')
const text = (v: unknown) => (v === '' || v === null || v === undefined ? '—' : String(v))

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid-page">
      <h2 className="mb-1.5 border-b-2 border-neutral-800 pb-0.5 text-[11pt] font-bold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Label / value grid; rows whose value is "—" are still shown so blanks are visible on paper. */
function Fields({ rows, cols = 3 }: { rows: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cols === 4 ? 'grid grid-cols-4 gap-x-4 gap-y-1' : cols === 2 ? 'grid grid-cols-2 gap-x-4 gap-y-1' : 'grid grid-cols-3 gap-x-4 gap-y-1'}>
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0 border-b border-dotted border-neutral-300 py-0.5">
          <dt className="text-[7.5pt] text-neutral-500 uppercase">{k}</dt>
          <dd className="text-[9.5pt] font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Grid({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <table className="w-full border-collapse text-[8.5pt]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`border border-neutral-400 bg-neutral-100 px-1.5 py-1 text-left font-semibold ${right.includes(i) ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="break-inside-avoid">
            {r.map((c, ci) => (
              <td key={ci} className={`border border-neutral-300 px-1.5 py-0.5 align-top ${right.includes(ci) ? 'text-right whitespace-nowrap tabular-nums' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Printable employee record (A4). Hidden on screen; when printing, the print
 * CSS in index.css hides the app and shows only this sheet. Uses the values
 * currently on the form, so unsaved edits print too.
 */
export function EmployeePrintSheet({
  form,
  restaurants,
  photoPath,
  documents,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  restaurants: { id: string; name: string }[]
  photoPath: string | null | undefined
  documents: EmployeeDocumentItem[]
}) {
  const v = form.watch()
  const { data: photo } = useSignedFileUrl(photoPath)
  const { data: categories = [] } = useCompanyCategoriesQuery()
  const categoryName = (id: string | null | undefined) => (id ? (categories.find((c) => c.id === id)?.name ?? '—') : '—')
  const branch = restaurants.find((r) => r.id === v.current_restaurant_id)?.name ?? '—'

  const ledger = (key: string) => (v.typing_payments ?? []).filter((p) => p.step_key === key).reduce((s, p) => s + num(p.payment_amount), 0)
  const steps = VISA_STEPS.map((def, i) => ({ def, step: v.visa_steps?.[i] })).filter(({ step }) => step)
  const usedSteps = steps.filter(
    ({ step }) => step && (step.status !== 'not_started' || num(step.government_fee) || num(step.fine_amount) || step.application_date || step.expiry_date || step.company_category_id),
  )
  const stepTotals = steps.reduce(
    (t, { def, step }) => {
      const amount = num(step!.government_fee) + num(step!.other_charges)
      const paid = stepPaid(step!, ledger(def.key))
      return { cost: t.cost + amount, paid: t.paid + paid, fines: t.fines + num(step!.fine_amount) }
    },
    { cost: 0, paid: 0, fines: 0 },
  )

  return createPortal(
    <div className="print-sheet bg-white text-[9.5pt] text-neutral-900">
      {/* Header */}
      <header className="mb-4 flex items-start justify-between gap-4 border-b-4 border-neutral-900 pb-3">
        <div>
          <p className="text-[8pt] tracking-widest text-neutral-500 uppercase">{branch}</p>
          <h1 className="text-[16pt] leading-tight font-bold">Employee Details / Renewal &amp; Settlement</h1>
          <p className="text-[8pt] text-neutral-500">Printed {format(new Date(), 'd MMM yyyy, h:mm a')}</p>
        </div>
        <div className="text-right text-[8pt] text-neutral-500">
          <p className="text-[12pt] font-bold text-neutral-900">{v.employee_code || 'New employee'}</p>
          <p>Status: {label(VISA_STATUSES, v.visa_status)}</p>
        </div>
      </header>

      {/* Profile */}
      <Section title="Profile">
        <div className="flex gap-4">
          <div className="flex size-[30mm] shrink-0 items-center justify-center overflow-hidden border border-neutral-400 bg-neutral-50">
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <span className="text-[7pt] text-neutral-400">Photo</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[14pt] font-bold">{v.full_name || '—'}</p>
            <Fields
              cols={3}
              rows={[
                ['Employee ID', text(v.employee_code)],
                ['Current role', text(v.job_title)],
                ['Branch', branch],
                ['Nationality', text(v.nationality)],
                ['Joining date', date(v.joining_date)],
                ['Performance', v.performance_rating === '' || v.performance_rating === undefined ? '—' : `${v.performance_rating} / 5`],
                ['Probation', `${label(PROBATION_STATUSES, v.probation_status)}${v.probation_end_date ? ` · ends ${date(v.probation_end_date)}` : ''}`],
                ['Presence', label(PRESENCE_STATUSES, v.presence_status)],
                ['Visa status', label(VISA_STATUSES, v.visa_status)],
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Entry & visa">
        <Fields
          cols={4}
          rows={[
            ['Initial visa type', label(INITIAL_VISA_TYPES, v.initial_visa_type)],
            ['Entry date', date(v.entry_date)],
            ['Allowed stay', v.allowed_stay_days === '' || v.allowed_stay_days === undefined ? '—' : `${v.allowed_stay_days} days`],
            ['Sponsorship', label(VISA_SPONSORSHIP_TYPES, v.visa_sponsorship_type)],
            ['Sponsor name', text(v.sponsor_name)],
            ['Work permit type', text(v.work_permit_category)],
            ['Work permit no.', text(v.work_permit_number)],
            ['Work permit expiry', v.work_permit_expiry_available ? date(v.work_permit_expiry) : 'Not available'],
            ['Work permit salary', money(v.work_permit_salary)],
            ['Labour person no.', text(v.labour_person_number)],
            ['Permit issue date', date(v.permit_issue_date)],
            ['Labour permit expiry', `${date(v.labour_permit_expiry)} (${countdown(v.labour_permit_expiry).label})`],
            ['Emirates ID', text(v.emirates_id)],
            ['Emirates ID expiry', `${date(v.emirates_id_expiry)} (${countdown(v.emirates_id_expiry).label})`],
            ['Medical entry', date(v.medical_entry_date)],
            ['Medical expiry', `${date(v.medical_expiry_date)} (${countdown(v.medical_expiry_date).label})`],
            ['Last exit', date(v.last_exit_date)],
            ['Last in country', date(v.last_in_country_date)],
          ]}
        />
      </Section>

      <div className="grid grid-cols-2 gap-4">
        <Section title="Passport">
          <Fields
            cols={2}
            rows={[
              ['Passport no.', text(v.passport_number)],
              ['Status', label(PASSPORT_STATUSES, v.passport_status)],
              ['Issue date', date(v.passport_issue_date)],
              ['Expiry date', `${date(v.passport_expiry_date)} (${countdown(v.passport_expiry_date).label})`],
              ['Location', text(v.passport_location)],
            ]}
          />
        </Section>
        <Section title="Employment & insurance">
          <Fields
            cols={2}
            rows={[
              ['Base salary', money(v.base_salary)],
              ['Renewal salary', money(v.renewal_salary)],
              ['Loan installment / month', money(v.loan_monthly_installment)],
              ['Insurance', v.insurance_applicable ? label(INSURANCE_STATUSES, v.insurance_status) : 'Not applicable'],
              ['Insurance period', v.insurance_applicable ? `${date(v.insurance_start_date)} – ${date(v.insurance_expiry_date)}` : '—'],
              ['Health insurance expiry', date(v.health_insurance_expiry)],
              ['Insurance fine', v.insurance_fine_applicable ? money(v.insurance_fine_amount) : '—'],
            ]}
          />
        </Section>
      </div>

      <Section title="Typing centre payments">
        <Fields
          cols={4}
          rows={[
            ['Typing centre', text(v.typing_centre_name)],
            ['Contact', text(v.typing_centre_contact)],
            ['Application ref.', text(v.typing_application_ref)],
            ['Process', label(TYPING_PROCESSES, v.typing_process)],
          ]}
        />
        <div className="mt-2">
          {usedSteps.length === 0 ? (
            <p className="text-[8.5pt] text-neutral-500">No visa steps recorded.</p>
          ) : (
            <Grid
              head={['#', 'Step', 'Category', 'Start', 'Expiry', 'Amount', 'Paid', 'Balance', 'Fine / reason', 'Status']}
              right={[5, 6, 7]}
              rows={usedSteps.map(({ def, step }) => {
                const s = step!
                const amount = num(s.government_fee) + num(s.other_charges)
                const paid = stepPaid(s, ledger(def.key))
                return [
                  VISA_STEPS.indexOf(def) + 1,
                  `${def.label}${s.step_option ? ` (${s.step_option})` : ''}`,
                  s.company_category_id ? `${categoryName(s.company_category_id)}${s.category_paid === true ? ' · paid' : s.category_paid === false ? ' · not paid' : ''}` : '—',
                  date(s.application_date),
                  s.expiry_not_applicable ? 'N/A' : date(s.expiry_date),
                  money(amount),
                  money(paid),
                  money(Math.max(amount - paid, 0)),
                  num(s.fine_amount) ? `${money(s.fine_amount)}${s.fine_reason ? ` — ${s.fine_reason}` : ''}${s.fine_status ? ` (${label(FINE_STATUSES, s.fine_status)})` : ''}` : '—',
                  label(VISA_STEP_STATUSES, s.status),
                ]
              })}
            />
          )}
          <p className="mt-1 text-right text-[9pt]">
            Total cost <b>{money(stepTotals.cost)}</b> · Paid <b>{money(stepTotals.paid)}</b> · Outstanding{' '}
            <b>{money(Math.max(stepTotals.cost - stepTotals.paid, 0))}</b> · Fines <b>{money(stepTotals.fines)}</b>
          </p>
        </div>
        {(v.typing_payments ?? []).length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-[8.5pt] font-semibold">Payment record</p>
            <Grid
              head={['Service', 'Invoice', 'Paid', 'Date', 'Method', 'Reference', 'Paid by']}
              right={[1, 2]}
              rows={v.typing_payments.map((p) => [
                VISA_STEPS.find((s) => s.key === p.step_key)?.label ?? p.step_key,
                money(p.invoice_amount),
                money(p.payment_amount),
                date(p.payment_date),
                label(PAYMENT_METHODS, p.payment_method),
                text(p.reference),
                label(PAID_BY, p.paid_by),
              ])}
            />
          </div>
        )}
      </Section>

      {(v.vacations ?? []).length > 0 && (
        <Section title="Vacations & flight tickets">
          <Grid
            head={['From', 'To', 'Ticket paid by', 'Amount', 'Claim status']}
            right={[3]}
            rows={v.vacations.map((x) => [date(x.start_date), date(x.end_date), label(TICKET_PAID_BY, x.paid_by), money(x.amount), label(TICKET_CLAIM_STATUSES, x.ticket_claim_status)])}
          />
        </Section>
      )}

      {(v.issues ?? []).length > 0 && (
        <Section title="Complaints & issues">
          <Grid
            head={['Date', 'Type', 'Description', 'Assigned to', 'Status']}
            rows={v.issues.map((x) => [date(x.issue_date), label(ISSUE_TYPES, x.issue_type), text(x.description), text(x.assigned_to), label(ISSUE_STATUSES, x.status)])}
          />
        </Section>
      )}

      {(v.items ?? []).length > 0 && (
        <Section title="Uniform & accommodation items">
          <Grid
            head={['Item', 'Category', 'Qty', 'Size', 'Issued', 'Condition', 'Acknowledged']}
            right={[2]}
            rows={v.items.map((x) => [x.item_name, label(ITEM_CATEGORIES, x.category), text(x.quantity), text(x.size_allocation), date(x.issued_date), label(ITEM_CONDITIONS, x.condition), x.acknowledged ? 'Yes' : 'No'])}
          />
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Section title="Labour fine">
          <Fields
            cols={2}
            rows={[
              ['Status', label(LABOUR_FINE_STATUSES, v.labour_fine_status)],
              ['Amount', money(v.labour_fine_amount)],
              ['Checked on', date(v.labour_fine_checked_date)],
              ['Reference', text(v.labour_fine_reference)],
              ['Remarks', text(v.labour_fine_remarks)],
            ]}
          />
        </Section>
        <Section title="Visit visa funding">
          <Fields
            cols={2}
            rows={[
              ['Source', label(VISIT_VISA_SOURCES, v.visit_visa_source)],
              ['Support', label(VISIT_VISA_SUPPORT, v.visit_visa_support)],
              ['Cost', money(v.visit_visa_cost)],
              ['Loan amount', money(v.visit_visa_loan_amount)],
              ['Monthly deduction', money(v.visit_visa_monthly_deduction)],
              ['Recovered', money(v.visit_visa_recovered_amount)],
            ]}
          />
        </Section>
      </div>

      <Section title="Renewal & settlement">
        <Fields
          cols={4}
          rows={[
            ['Decision date', date(v.decision_date)],
            ['Final status', label(DECISIONS, v.final_status)],
            ['Settlement date', date(v.settlement_date)],
            ['Settlement amount', money(v.settlement_amount)],
            ['Settlement status', label(SETTLEMENT_STATUSES, v.settlement_status)],
            ['Document type', label(SETTLEMENT_DOCUMENT_TYPES, v.settlement_document_type)],
            ['Reference', text(v.settlement_reference)],
            ['Flight ticket claimed', v.flight_ticket_claimed ? 'Yes' : 'No'],
          ]}
        />
        {v.renewal_notes && <p className="mt-1 text-[9pt]"><span className="text-neutral-500">Notes:</span> {v.renewal_notes}</p>}
      </Section>

      {documents.length > 0 && (
        <Section title="Documents on file">
          <p className="text-[8.5pt]">{documents.map((d) => `${optionLabel(DOCUMENT_TYPES, d.document_type)} (${d.file_name})`).join(' · ')}</p>
        </Section>
      )}

      <footer className="mt-10 grid grid-cols-3 gap-8 text-center text-[8.5pt] break-inside-avoid">
        {['Prepared by', 'HR / Manager', 'Employee signature'].map((s) => (
          <div key={s}>
            <div className="mb-1 h-10 border-b border-neutral-700" />
            {s}
          </div>
        ))}
      </footer>
    </div>,
    document.body,
  )
}
