import { Fragment, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller, useFieldArray } from 'react-hook-form'
import { AlertTriangle, CalendarClock, CalendarDays, ChevronDown, ClipboardList, Gavel, Info, MinusCircle, Paperclip, Plus, ReceiptText, Wallet, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { FINE_STATUSES, PAID_BY, PAYMENT_METHODS, TYPING_PROCESSES, VISA_STEPS, VISA_STEP_STATUSES, optionLabel } from '../../employeeOptions'
import { openEmployeeFile, validateDocumentFile } from '../../hooks/useEmployeeRecord'
import { useCompanyCategoriesQuery } from '../../hooks/useCompanyCategories'
import { Field, OptionSelect, SectionCard } from './RecordUi'
import { TONE_CLASSES, countdown, newId, num, shortDate } from './recordUtils'

const STATUS_STYLES: Record<string, string> = {
  not_started: 'border-warning/40 bg-warning/15 text-warning-foreground',
  in_progress: 'border-primary/30 bg-primary/10 text-primary',
  pending_payment: 'border-warning/40 bg-warning/15 text-warning-foreground',
  approved: 'border-success/30 bg-success/10 text-success',
  completed: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  expired: 'border-destructive/30 bg-destructive/10 text-destructive',
  not_applicable: 'border-border bg-muted/50 text-muted-foreground',
}

const LEGEND = [
  { tone: 'ok' as const, title: '45 days left', hint: 'More than 30 days', icon: CalendarClock },
  { tone: 'soon' as const, title: '7 days left', hint: '30 days or less', icon: CalendarClock },
  { tone: 'expired' as const, title: 'Expired 3 days ago', hint: 'Past expiry date', icon: AlertTriangle },
  { tone: 'today' as const, title: 'Expires today', hint: 'Due today', icon: CalendarDays },
  { tone: 'na' as const, title: 'N/A', hint: 'No expiry (not applicable)', icon: MinusCircle },
]

const NO_CATEGORY = '__none__'

/** Yes / No pill pair; null means "not answered yet". */
function PaidQuestion({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
      <span className="text-muted-foreground">Paid?</span>
      {[
        { v: true, label: 'Yes', on: 'border-success bg-success text-white' },
        { v: false, label: 'No', on: 'border-destructive bg-destructive text-white' },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn('rounded border px-2 py-0.5 font-medium transition-colors', value === o.v ? o.on : 'bg-muted/40 text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FilePick({ name, path, onPick }: { name: string | null | undefined; path: string | null | undefined; onPick: (file: File) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {name ? (
        <a
          href="#"
          className="max-w-28 truncate text-primary hover:underline"
          onClick={(e) => {
            e.preventDefault()
            if (path) openEmployeeFile(path)
          }}
        >
          {name}
        </a>
      ) : null}
      <label className="cursor-pointer text-primary has-disabled:hidden" title={name ? 'Replace file' : 'Attach file'}>
        <Paperclip className="size-3.5" />
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
            onPick(file)
          }}
        />
      </label>
      {!name && <span className="text-muted-foreground">—</span>}
    </span>
  )
}

export function TypingCentreSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, setValue, formState } = form
  const steps = watch('visa_steps')
  const payments = watch('typing_payments')
  const { fields: paymentRows, append, remove } = useFieldArray({ control, name: 'typing_payments' })
  const [open, setOpen] = useState<string | null>(null)
  const { data: categories = [] } = useCompanyCategoriesQuery()
  const categoryValues = new Map(
    categories.flatMap((c) => c.company_category_values.map((v) => [v.id, { ...v, categoryName: c.name }] as const)),
  )

  /** Amount of the step's company category when it's marked as paid. */
  const categoryPaid = (index: number) => {
    const st = steps[index]
    const value = st?.company_category_value_id ? categoryValues.get(st.company_category_value_id) : undefined
    return st?.category_paid && value ? Number(value.amount) : 0
  }
  const ledgerPaid = (key: string) => payments.filter((p) => p.step_key === key).reduce((s, p) => s + num(p.payment_amount), 0)
  const paidFor = (key: string, index: number) => ledgerPaid(key) + categoryPaid(index)
  const lastPaymentDate = (key: string) =>
    payments
      .filter((p) => p.step_key === key && p.payment_date)
      .map((p) => p.payment_date!)
      .sort()
      .at(-1)

  const totalCost = steps.reduce((s, st) => s + num(st.government_fee) + num(st.other_charges), 0)
  const totalPaid = payments.reduce((s, p) => s + num(p.payment_amount), 0) + steps.reduce((s, _st, i) => s + categoryPaid(i), 0)
  const totalFines = steps.reduce((s, st) => s + num(st.fine_amount), 0)

  return (
    <SectionCard icon={ClipboardList} title="Typing centre payments" lockKey="typing">
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="font-semibold">UAE Employment Visa Process – Step by Step</p>
          <p className="text-xs text-muted-foreground">A payment tracker you maintain — not authoritative legal guidance.</p>
        </div>
        <Field label="Typing centre name">
          <Input className="h-9" placeholder="Not selected" {...register('typing_centre_name')} />
        </Field>
        <Field label="Contact">
          <Input className="h-9" placeholder="—" {...register('typing_centre_contact')} />
        </Field>
        <Field label="Application reference">
          <Input className="h-9" placeholder="—" {...register('typing_application_ref')} />
        </Field>
        <Field label="Process">
          <Controller
            control={control}
            name="typing_process"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={TYPING_PROCESSES} placeholder="Select process" className="h-9" />}
          />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">Step</TableHead>
              <TableHead>Service / option</TableHead>
              <TableHead>Process start date</TableHead>
              <TableHead>Expiry date</TableHead>
              <TableHead>Days left</TableHead>
              <TableHead>Company category</TableHead>
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead className="text-right">Paid (AED)</TableHead>
              <TableHead className="text-right">Balance (AED)</TableHead>
              <TableHead>Fine (AED) &amp; reason</TableHead>
              <TableHead>Payment date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {VISA_STEPS.map((def, index) => {
              const step = steps[index]
              if (!step) return null
              const amount = num(step.government_fee) + num(step.other_charges)
              const paid = paidFor(def.key, index)
              const catValue = step.company_category_value_id ? categoryValues.get(step.company_category_value_id) : undefined
              const balance = Math.max(amount - paid, 0)
              const cd = countdown(step.expiry_date, step.expiry_not_applicable)
              const isOpen = open === def.key
              const pending = step.pending_file as File | undefined
              return (
                <Fragment key={def.key}>
                  <TableRow className={cn(isOpen && 'bg-primary/5')}>
                    <TableCell>
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                    </TableCell>
                    <TableCell className="min-w-52">
                      <p className="font-medium">{def.label}</p>
                      {def.options && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {def.options.map((o) => (
                            <button
                              key={o}
                              type="button"
                              onClick={() => setValue(`visa_steps.${index}.step_option`, step.step_option === o ? '' : o, { shouldDirty: true })}
                              className={cn(
                                'rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                                step.step_option === o ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="min-w-36">
                      <Input type="date" className="h-8 text-xs" {...register(`visa_steps.${index}.application_date`)} />
                    </TableCell>
                    <TableCell className="min-w-44">
                      <div className="flex items-center gap-2">
                        <Input type="date" className="h-8 text-xs" disabled={step.expiry_not_applicable} {...register(`visa_steps.${index}.expiry_date`)} />
                        <label className="flex items-center gap-1 text-[11px] whitespace-nowrap text-muted-foreground">
                          <Controller
                            control={control}
                            name={`visa_steps.${index}.expiry_not_applicable`}
                            render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
                          />
                          N/A
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONE_CLASSES[cd.tone])}>{cd.label}</span>
                    </TableCell>
                    <TableCell className="min-w-48">
                      <Select
                        value={step.company_category_value_id ?? NO_CATEGORY}
                        onValueChange={(v) => {
                          const picked = v === NO_CATEGORY ? undefined : categoryValues.get(v)
                          setValue(`visa_steps.${index}.company_category_value_id`, picked ? v : null, { shouldDirty: true })
                          // A new pick asks the paid question again; its amount becomes the step amount.
                          setValue(`visa_steps.${index}.category_paid`, null, { shouldDirty: true })
                          if (picked) setValue(`visa_steps.${index}.government_fee`, Number(picked.amount), { shouldDirty: true })
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-xs" aria-label={`${def.label} company category`}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                          {categories
                            .filter((c) => c.is_active || c.company_category_values.some((v) => v.id === step.company_category_value_id))
                            .map((c) => (
                              <SelectGroup key={c.id}>
                                <SelectLabel>{c.name}</SelectLabel>
                                {c.company_category_values.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.label} · {formatCurrency(v.amount)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          {categories.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">
                              No categories yet —{' '}
                              <Link to="/employees/company-categories" className="text-primary hover:underline">
                                add them
                              </Link>
                            </p>
                          )}
                        </SelectContent>
                      </Select>
                      {catValue && (
                        <PaidQuestion value={step.category_paid} onChange={(v) => setValue(`visa_steps.${index}.category_paid`, v, { shouldDirty: true })} />
                      )}
                    </TableCell>
                    <TableCell className="min-w-28">
                      <Input type="number" step="0.01" min="0" placeholder="—" className="h-8 text-right text-xs" {...register(`visa_steps.${index}.government_fee`)} />
                      {catValue && <p className="mt-1 text-right text-[11px] text-muted-foreground">{catValue.label}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {paid ? formatCurrency(paid) : '—'}
                      {step.category_paid && catValue && <p className="text-[11px] text-success">Category paid</p>}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', balance > 0 && 'font-medium text-destructive')}>{balance ? formatCurrency(balance) : '—'}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Fine"
                          aria-label={`${def.label} fine amount`}
                          className={cn('h-8 text-right text-xs', num(step.fine_amount) > 0 && 'border-destructive/50 text-destructive')}
                          {...register(`visa_steps.${index}.fine_amount`)}
                        />
                        {num(step.fine_amount) > 0 && (
                          <Input
                            placeholder="Fine reason"
                            aria-label={`${def.label} fine reason`}
                            className="h-7 text-xs"
                            {...register(`visa_steps.${index}.fine_reason`)}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate(lastPaymentDate(def.key))}</TableCell>
                    <TableCell className="min-w-36">
                      <Controller
                        control={control}
                        name={`visa_steps.${index}.status`}
                        render={({ field }) => (
                          <OptionSelect value={field.value} onChange={field.onChange} options={VISA_STEP_STATUSES} placeholder="Status" className={cn('h-8 text-xs', STATUS_STYLES[field.value])} />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FilePick
                        name={pending?.name ?? step.attachment_name}
                        path={pending ? null : step.attachment_path}
                        onPick={(file) => setValue(`visa_steps.${index}.pending_file`, file, { shouldDirty: true })}
                      />
                    </TableCell>
                    <TableCell>
                      <a
                        href="#"
                        role="button"
                        aria-label="More details"
                        onClick={(e) => {
                          e.preventDefault()
                          setOpen(isOpen ? null : def.key)
                        }}
                      >
                        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </a>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={14} className="p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          <Field label="Approval date">
                            <Input type="date" className="h-9" {...register(`visa_steps.${index}.approval_date`)} />
                          </Field>
                          <Field label="Other charges (AED)" hint="Added to the amount (typing, service fees…)">
                            <Input type="number" step="0.01" min="0" className="h-9" {...register(`visa_steps.${index}.other_charges`)} />
                          </Field>
                          <Field label="Fine status">
                            <Controller
                              control={control}
                              name={`visa_steps.${index}.fine_status`}
                              render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={FINE_STATUSES} placeholder="Fine status" className="h-9" />}
                            />
                          </Field>
                          <Field label="Notes">
                            <Input className="h-9" placeholder="Remarks" {...register(`visa_steps.${index}.notes`)} />
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
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 text-primary" /> Track start and expiry for each step. Tick N/A when no expiry applies. Paid comes from the payment record below,
        plus the company category amount when it is marked paid.
      </p>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="mb-3 text-sm font-semibold text-primary">Countdown examples (for reference only)</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_1.4fr]">
          {LEGEND.map((l) => (
            <div key={l.title} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', TONE_CLASSES[l.tone])}>
              <l.icon className="size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{l.title}</p>
                <p className="text-[11px] opacity-80">{l.hint}</p>
              </div>
            </div>
          ))}
          <p className="col-span-2 self-center text-xs text-muted-foreground md:col-span-3 xl:col-span-1">
            Days left updates daily from the expiry date. Blank expiry: —. No expiry: N/A.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total cost (AED)', value: totalCost, icon: ReceiptText, className: '' },
          { label: 'Total paid (AED)', value: totalPaid, icon: Wallet, className: 'text-success' },
          { label: 'Outstanding (AED)', value: Math.max(totalCost - totalPaid, 0), icon: AlertTriangle, className: totalCost - totalPaid > 0 ? 'text-destructive' : '' },
          { label: 'Fines (AED)', value: totalFines, icon: Gavel, className: totalFines > 0 ? 'text-destructive' : '' },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
            <t.icon className="size-7 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={cn('text-lg font-semibold tabular-nums', t.className)}>{formatCurrency(t.value)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Payment record</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary text-primary"
          onClick={() =>
            append({
              record_id: newId(),
              step_key: '',
              invoice_amount: '',
              payment_amount: '',
              payment_date: new Date().toISOString().slice(0, 10),
              payment_method: 'cash',
              reference: '',
              paid_by: 'company',
              attachment_id: null,
            })
          }
        >
          <Plus /> Add payment
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Service</TableHead>
              <TableHead>Invoice amount (AED)</TableHead>
              <TableHead>Payment amount (AED)</TableHead>
              <TableHead>Payment date</TableHead>
              <TableHead>Process start</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Days left</TableHead>
              <TableHead>Payment method</TableHead>
              <TableHead>Receipt / reference</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-14 text-center text-muted-foreground">
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            )}
            {paymentRows.map((row, i) => {
              const p = payments[i]
              const stepIndex = VISA_STEPS.findIndex((s) => s.key === p?.step_key)
              const step = stepIndex >= 0 ? steps[stepIndex] : undefined
              const cd = countdown(step?.expiry_date, step?.expiry_not_applicable)
              const pending = p?.pending_file as File | undefined
              const err = formState.errors.typing_payments?.[i]
              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-48">
                    <Controller
                      control={control}
                      name={`typing_payments.${i}.step_key`}
                      render={({ field }) => (
                        <OptionSelect value={field.value} onChange={field.onChange} options={VISA_STEPS.map((s) => ({ value: s.key, label: s.label }))} placeholder="Choose service" className="h-8 text-xs" />
                      )}
                    />
                    {err?.step_key && <p className="mt-1 text-xs text-destructive">{err.step_key.message}</p>}
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Input type="number" step="0.01" min="0" className="h-8 text-xs" {...register(`typing_payments.${i}.invoice_amount`)} />
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Input type="number" step="0.01" min="0" className="h-8 text-xs" aria-invalid={!!err?.payment_amount} {...register(`typing_payments.${i}.payment_amount`)} />
                    {err?.payment_amount && <p className="mt-1 text-xs text-destructive">{err.payment_amount.message}</p>}
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Input type="date" className="h-8 text-xs" {...register(`typing_payments.${i}.payment_date`)} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{shortDate(step?.application_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{step?.expiry_not_applicable ? 'N/A' : shortDate(step?.expiry_date)}</TableCell>
                  <TableCell>
                    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONE_CLASSES[cd.tone])}>{cd.label}</span>
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Controller
                      control={control}
                      name={`typing_payments.${i}.payment_method`}
                      render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={PAYMENT_METHODS} placeholder="Method" className="h-8 text-xs" />}
                    />
                  </TableCell>
                  <TableCell className="min-w-44">
                    <div className="flex items-center gap-2">
                      <Input className="h-8 text-xs" placeholder="Receipt no." {...register(`typing_payments.${i}.reference`)} />
                      <FilePick
                        name={pending?.name ?? p?.attachment_name}
                        path={pending ? null : p?.attachment_path}
                        onPick={(file) => setValue(`typing_payments.${i}.pending_file`, file, { shouldDirty: true })}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Controller
                      control={control}
                      name={`typing_payments.${i}.paid_by`}
                      render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={PAID_BY} placeholder="Paid by" className="h-8 text-xs" />}
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove payment">
                      <X className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {payments.some((p) => p.step_key && optionLabel(VISA_STEPS.map((s) => ({ value: s.key, label: s.label })), p.step_key) === p.step_key) && (
        <p className="mt-2 text-xs text-warning-foreground">Some payments are for a service that is no longer in the step list.</p>
      )}
    </SectionCard>
  )
}
