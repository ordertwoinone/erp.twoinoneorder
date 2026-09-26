import { Fragment, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { format, isValid, parseISO } from 'date-fns'
import { CalendarDays, ChevronDown, CircleDollarSign, HandCoins, Paperclip, Route } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput, VisaStepRow } from '@/schemas/employee'
import { FINE_STATUSES, VISA_STEPS, VISA_STEP_STATUSES, VISIT_VISA_SOURCES, VISIT_VISA_SUPPORT, optionLabel } from '../../employeeOptions'
import { openEmployeeFile, validateDocumentFile } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, OptionSelect, SectionCard } from './RecordUi'
import { ExpiryBadge } from './EntryAndInsuranceSections'

const num = (v: unknown) => (v === '' || v === undefined || v === null ? 0 : Number(v) || 0)

const STATUS_STYLES: Record<string, string> = {
  not_started: 'border-border bg-muted/50 text-muted-foreground',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  pending_payment: 'border-warning/40 bg-warning/15 text-warning-foreground',
  approved: 'border-success/30 bg-success/10 text-success',
  completed: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  expired: 'border-destructive/30 bg-destructive/10 text-destructive',
  not_applicable: 'border-border bg-muted/50 text-muted-foreground',
}

function stepMoney(step: VisaStepRow) {
  const total = num(step.government_fee) + num(step.other_charges)
  const paid = num(step.amount_paid)
  return { total, paid, balance: Math.max(total - paid, 0) }
}

function PaymentBadge({ total, paid }: { total: number; paid: number }) {
  if (total === 0 && paid === 0) return <span className="text-muted-foreground">—</span>
  const label = paid >= total ? 'Paid' : paid > 0 ? 'Partially paid' : 'Not paid'
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        label === 'Paid' && 'border-success/30 bg-success/10 text-success',
        label === 'Partially paid' && 'border-warning/40 bg-warning/15 text-warning-foreground',
        label === 'Not paid' && 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {label}
    </span>
  )
}

const shortDate = (v: string | undefined) => {
  const d = v ? parseISO(v) : null
  return d && isValid(d) ? format(d, 'd MMM yyyy') : '—'
}

export function VisaJourneySection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, setValue } = form
  const steps = watch('visa_steps')
  const [open, setOpen] = useState<string | null>(null)

  const totals = steps.reduce(
    (acc, s) => {
      const m = stepMoney(s)
      return { total: acc.total + m.total, paid: acc.paid + m.paid, balance: acc.balance + m.balance, fines: acc.fines + num(s.fine_amount) }
    },
    { total: 0, paid: 0, balance: 0, fines: 0 },
  )
  const done = steps.filter((s) => s.status === 'completed' || s.status === 'approved' || s.status === 'not_applicable').length

  return (
    <SectionCard
      icon={Route}
      title="Visa journey"
      actions={
        <span className="text-sm text-muted-foreground">
          {done} of {steps.length} steps done
        </span>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total cost', value: totals.total },
          { label: 'Paid', value: totals.paid, className: 'text-success' },
          { label: 'Balance due', value: totals.balance, className: totals.balance > 0 ? 'text-destructive' : undefined },
          { label: 'Fines', value: totals.fines, className: totals.fines > 0 ? 'text-destructive' : undefined },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', t.className)}>{formatCurrency(t.value)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Gov. fee</TableHead>
              <TableHead className="text-right">Other</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {VISA_STEPS.map((def, index) => {
              const step = steps[index]
              if (!step) return null
              const m = stepMoney(step)
              const isOpen = open === def.key
              const pendingFile = step.pending_file as File | undefined
              const fileName = pendingFile?.name ?? step.attachment_name
              return (
                <Fragment key={def.key}>
                  <TableRow className={cn('cursor-pointer', isOpen && 'bg-primary/5')} onClick={() => setOpen(isOpen ? null : def.key)}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="min-w-48">
                      <p className="font-medium">{def.label}</p>
                      <p className="text-xs text-muted-foreground">{def.hint}</p>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', STATUS_STYLES[step.status])}>
                        {optionLabel(VISA_STEP_STATUSES, step.status)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate(step.application_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate(step.approval_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {shortDate(step.expiry_date)}
                      {step.expiry_date && step.status !== 'not_applicable' && (
                        <div>
                          <ExpiryBadge date={step.expiry_date} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(step.government_fee) ? formatCurrency(num(step.government_fee)) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(step.other_charges) ? formatCurrency(num(step.other_charges)) : '—'}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{m.total ? formatCurrency(m.total) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.paid ? formatCurrency(m.paid) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', m.balance > 0 && 'font-medium text-destructive')}>
                      {m.balance ? formatCurrency(m.balance) : '—'}
                    </TableCell>
                    <TableCell>
                      <PaymentBadge total={m.total} paid={m.paid} />
                    </TableCell>
                    <TableCell>{fileName ? <Paperclip className="size-4 text-primary" aria-label={fileName} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={14} className="p-4">
                        <p className="mb-3 text-sm font-semibold">
                          Step {index + 1} · {def.label}
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                          <Field label="Status">
                            <Controller
                              control={control}
                              name={`visa_steps.${index}.status`}
                              render={({ field }) => (
                                <OptionSelect value={field.value} onChange={field.onChange} options={VISA_STEP_STATUSES} placeholder="Status" />
                              )}
                            />
                          </Field>
                          <Field label="Application date">
                            <IconInput icon={CalendarDays} type="date" {...register(`visa_steps.${index}.application_date`)} />
                          </Field>
                          <Field label="Approval date">
                            <IconInput icon={CalendarDays} type="date" {...register(`visa_steps.${index}.approval_date`)} />
                          </Field>
                          <Field label="Expiry date">
                            <IconInput icon={CalendarDays} type="date" {...register(`visa_steps.${index}.expiry_date`)} />
                          </Field>
                          <Field label="Government fee (AED)">
                            <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register(`visa_steps.${index}.government_fee`)} />
                          </Field>
                          <Field label="Other charges (AED)">
                            <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="Typing, service…" {...register(`visa_steps.${index}.other_charges`)} />
                          </Field>
                          <Field label="Total cost">
                            <Input className="h-10 font-semibold" value={formatCurrency(m.total)} disabled readOnly />
                          </Field>
                          <Field label="Amount paid (AED)">
                            <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register(`visa_steps.${index}.amount_paid`)} />
                          </Field>
                          <Field label="Balance due">
                            <Input className={cn('h-10 font-semibold', m.balance > 0 && 'text-destructive')} value={formatCurrency(m.balance)} disabled readOnly />
                          </Field>
                          <Field label="Payment date">
                            <IconInput icon={CalendarDays} type="date" {...register(`visa_steps.${index}.payment_date`)} />
                          </Field>
                          <Field label="Fine (AED)">
                            <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register(`visa_steps.${index}.fine_amount`)} />
                          </Field>
                          <Field label="Fine status">
                            <Controller
                              control={control}
                              name={`visa_steps.${index}.fine_status`}
                              render={({ field }) => (
                                <OptionSelect value={field.value} onChange={field.onChange} options={FINE_STATUSES} placeholder="Fine status" />
                              )}
                            />
                          </Field>
                          <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
                            <Input className="h-10" placeholder="Reference number, remarks…" {...register(`visa_steps.${index}.notes`)} />
                          </Field>
                          <Field label="Receipt / document" className="sm:col-span-2">
                            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm">
                              <Paperclip className="size-4 shrink-0 text-primary" />
                              <span
                                className={cn('min-w-0 flex-1 truncate', fileName ? 'text-primary hover:underline' : 'text-muted-foreground')}
                                onClick={(e) => {
                                  if (step.attachment_path && !pendingFile) {
                                    e.preventDefault()
                                    openEmployeeFile(step.attachment_path)
                                  }
                                }}
                              >
                                {fileName ?? 'Upload receipt'}
                              </span>
                              <span className="shrink-0 font-medium text-primary">{fileName ? 'Replace' : 'Choose'}</span>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  e.target.value = ''
                                  if (!file) return
                                  const problem = validateDocumentFile(file)
                                  if (problem) return void toast.error(problem)
                                  setValue(`visa_steps.${index}.pending_file`, file, { shouldDirty: true })
                                }}
                              />
                            </label>
                          </Field>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Click a step to enter its dates, fees, payment, fine and receipt.</p>
    </SectionCard>
  )
}

export function VisitVisaFundingSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, formState } = form
  const support = watch('visit_visa_support')
  const loan = num(watch('visit_visa_loan_amount'))
  const recovered = num(watch('visit_visa_recovered_amount'))
  const monthly = num(watch('visit_visa_monthly_deduction'))
  const balance = Math.max(loan - recovered, 0)
  const monthsLeft = monthly > 0 && balance > 0 ? Math.ceil(balance / monthly) : 0
  const isLoan = support === 'recoverable_loan'

  return (
    <SectionCard icon={HandCoins} title="Visit visa funding">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Visa source">
          <Controller
            control={control}
            name="visit_visa_source"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={VISIT_VISA_SOURCES} placeholder="Select source" />}
          />
        </Field>
        <Field label="Company support">
          <Controller
            control={control}
            name="visit_visa_support"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={VISIT_VISA_SUPPORT} placeholder="Select support" />}
          />
        </Field>
        <Field label="Visit visa cost (AED)" error={formState.errors.visit_visa_cost?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_cost')} />
        </Field>
        {isLoan && (
          <>
            <Field label="Loan amount (AED)" error={formState.errors.visit_visa_loan_amount?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_loan_amount')} />
            </Field>
            <Field label="Disbursed date">
              <IconInput icon={CalendarDays} type="date" {...register('visit_visa_disbursed_date')} />
            </Field>
            <Field label="Repayment starts">
              <IconInput icon={CalendarDays} type="date" {...register('visit_visa_repayment_start')} />
            </Field>
            <Field label="Monthly deduction (AED)" error={formState.errors.visit_visa_monthly_deduction?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_monthly_deduction')} />
            </Field>
            <Field label="Recovered so far (AED)" error={formState.errors.visit_visa_recovered_amount?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_recovered_amount')} />
            </Field>
            <Field label="Balance to recover" hint={monthsLeft ? `≈ ${monthsLeft} more month${monthsLeft === 1 ? '' : 's'} of deductions` : undefined}>
              <Input className={cn('h-10 font-semibold', balance > 0 ? 'text-destructive' : 'text-success')} value={formatCurrency(balance)} disabled readOnly />
            </Field>
          </>
        )}
      </div>
    </SectionCard>
  )
}
