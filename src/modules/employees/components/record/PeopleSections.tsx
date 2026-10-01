import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller, useFieldArray } from 'react-hook-form'
import { addMonths, format, isValid, parseISO } from 'date-fns'
import { AlertCircle, CalendarDays, CircleDollarSign, FileWarning, HandCoins, Hourglass, Loader2, MessageSquareWarning, Paperclip, Plus, Shirt, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { ISSUE_STATUSES, ISSUE_TYPES, ITEM_CATEGORIES, ITEM_CONDITIONS, LABOUR_FINE_STATUSES, PROBATION_STATUSES } from '../../employeeOptions'
import { openEmployeeFile, useRecordLoan, validateDocumentFile, type PayrollHistory } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, OptionSelect, SectionCard } from './RecordUi'
import { useRecordLock } from './recordLockContext'
import { daysUntil, newId, num, shortDate } from './recordUtils'

const today = () => new Date().toISOString().slice(0, 10)

/** Paperclip + file name; picks a file into `pending_file` style form fields. */
function AttachCell({
  name,
  path,
  onPick,
  label = 'Attach',
}: {
  name: string | null | undefined
  path: string | null | undefined
  onPick: (file: File) => void
  label?: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
      <label className="shrink-0 cursor-pointer text-primary" title={name ? 'Replace file' : 'Attach file'}>
        <Paperclip className="size-4" />
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
      {name ? (
        <a
          href="#"
          className="truncate text-primary hover:underline"
          onClick={(e) => {
            e.preventDefault()
            if (path) openEmployeeFile(path)
            else toast.info('Uploads when you save')
          }}
        >
          {name}
        </a>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
    </span>
  )
}

const pill = (tone: 'success' | 'warning' | 'danger' | 'primary' | 'muted') =>
  ({
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/40 bg-warning/15 text-warning-foreground',
    danger: 'border-destructive/30 bg-destructive/10 text-destructive',
    primary: 'border-primary/30 bg-primary/10 text-primary',
    muted: 'border-border bg-muted/50 text-muted-foreground',
  })[tone]

// === Probation =====================================================================

const PROBATION_TONE: Record<string, Parameters<typeof pill>[0]> = {
  in_probation: 'primary',
  pending_review: 'warning',
  confirmed: 'success',
  extended: 'warning',
  terminated: 'danger',
}

export function ProbationSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { register, control, watch, setValue, getValues, formState } = form
  const end = watch('probation_end_date')
  const left = daysUntil(end)

  // Start + duration fills the end date; the end date stays editable.
  const recalcEnd = () => {
    const start = parseISO(getValues('joining_date') ?? '')
    const months = Number(getValues('probation_months'))
    if (isValid(start) && months > 0) setValue('probation_end_date', format(addMonths(start, months), 'yyyy-MM-dd'), { shouldDirty: true })
  }

  return (
    <SectionCard icon={Hourglass} title="Probation period" lockKey="probation">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date (joining)">
          <IconInput icon={CalendarDays} type="date" {...register('joining_date', { onChange: recalcEnd })} />
        </Field>
        <Field label="Duration (months)" error={formState.errors.probation_months?.message}>
          <Input className="h-10" type="number" min="0" max="24" placeholder="e.g. 3 or 6" {...register('probation_months', { onChange: recalcEnd })} />
        </Field>
        <Field label="End date" hint={left !== null && left >= 0 ? `${left} day${left === 1 ? '' : 's'} remaining` : left !== null ? 'Probation period has ended' : undefined}>
          <IconInput icon={CalendarDays} type="date" {...register('probation_end_date')} />
        </Field>
        <Field label="Status">
          <Controller
            control={control}
            name="probation_status"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={field.onChange}
                options={PROBATION_STATUSES}
                placeholder="Select status"
                className={field.value ? pill(PROBATION_TONE[field.value] ?? 'muted') : undefined}
              />
            )}
          />
        </Field>
        <Field label="Performance rating (0 – 5)" error={formState.errors.performance_rating?.message} className="sm:col-span-2">
          <Controller
            control={control}
            name="performance_rating"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => field.onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>
                      <Star className={cn('size-6', num(field.value) >= n - 0.5 ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                    </button>
                  ))}
                </div>
                <Input
                  className="h-9 w-20"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">Attendance + performance</span>
              </div>
            )}
          />
        </Field>
      </div>
    </SectionCard>
  )
}

// === Loans (from Payroll) ==========================================================

export function loanTotals(history: PayrollHistory | undefined) {
  const issued = (history?.advances ?? []).reduce((s, a) => s + Number(a.amount), 0)
  // Only deductions on approved / posted salary entries count as repaid.
  const repaid = (history?.entries ?? [])
    .filter((e) => e.status === 'approved' || e.status === 'posted')
    .reduce((s, e) => s + Number(e.advances_deducted), 0)
  return { issued, repaid, balance: Math.max(issued - repaid, 0) }
}

export function LoansSection({
  form,
  history,
  loading,
  employeeId,
  isNew,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  history: PayrollHistory | undefined
  loading: boolean
  employeeId: string
  isNew: boolean
}) {
  const { register, getValues, formState } = form
  const { hasPermission } = useAuth()
  const lock = useRecordLock()
  const recordLoan = useRecordLoan(employeeId)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const totals = loanTotals(history)
  const installment = num(form.watch('loan_monthly_installment'))
  const monthsLeft = installment > 0 && totals.balance > 0 ? Math.ceil(totals.balance / installment) : 0

  return (
    <SectionCard
      icon={HandCoins}
      title="Employee loans"
      lockKey="loans"
      actions={
        !isNew && hasPermission('payroll.manage') ? (
          <Button type="button" variant="outline" size="sm" className="border-primary text-primary" onClick={() => setOpen(true)}>
            <Plus /> Record loan
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Loan issued (AED)', value: totals.issued },
          { label: 'Repaid (AED)', value: totals.repaid, className: 'text-success' },
          { label: 'Balance (AED)', value: totals.balance, className: totals.balance > 0 ? 'text-destructive' : '' },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', t.className)}>{loading ? '…' : formatCurrency(t.value)}</p>
          </div>
        ))}
        <Field label="Monthly installment (AED)" error={formState.errors.loan_monthly_installment?.message} hint={monthsLeft ? `≈ ${monthsLeft} month${monthsLeft === 1 ? '' : 's'} to clear` : undefined}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('loan_monthly_installment')} />
        </Field>
      </div>
      {(history?.advances.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {history!.advances.map((a) => (
            <p key={a.id}>
              {shortDate(a.advance_date)} · {formatCurrency(Number(a.amount))} {a.notes ? `· ${a.notes}` : ''}
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Loans are payroll advances; repayments are the "advances deducted" on approved salary entries.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record loan</DialogTitle>
            <DialogDescription>Saved straight to Payroll as an employee advance.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const restaurantId = getValues('current_restaurant_id')
              if (!(Number(amount) > 0)) return void toast.error('Enter the loan amount')
              if (!lock.isUnlocked('loans')) return void toast.error('Unlock the loans section first')
              await recordLoan.mutateAsync({ restaurantId, amount: Number(amount), date, notes })
              setOpen(false)
              setAmount('')
              setNotes('')
            }}
          >
            <Field label="Amount (AED)">
              <Input type="number" step="0.01" min="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Input placeholder="Reason / approval reference" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={recordLoan.isPending}>
              {recordLoan.isPending && <Loader2 className="animate-spin" />} Save loan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// === Complaints & issues ===========================================================

const ISSUE_TONE: Record<string, Parameters<typeof pill>[0]> = { open: 'warning', in_progress: 'primary', resolved: 'success', closed: 'muted' }

export function IssuesSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, setValue, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'issues' })
  const issues = watch('issues')
  const openCount = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length

  return (
    <SectionCard
      icon={MessageSquareWarning}
      title={
        <>
          Employee complaints & issues
          {openCount > 0 && <span className={cn('rounded-full border px-2 py-0.5 text-xs', pill('warning'))}>{openCount} open</span>}
        </>
      }
      lockKey="issues"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary text-primary"
          onClick={() => append({ record_id: newId(), issue_date: today(), issue_type: 'complaint', description: '', assigned_to: 'HR', status: 'open', attachment_id: null })}
        >
          <Plus /> Add issue
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-14 text-center text-muted-foreground">
                  No complaints or issues recorded.
                </TableCell>
              </TableRow>
            )}
            {fields.map((row, i) => {
              const issue = issues[i]
              const pending = issue?.pending_file as File | undefined
              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-36">
                    <Input type="date" className="h-8 text-xs" aria-invalid={!!formState.errors.issues?.[i]?.issue_date} {...register(`issues.${i}.issue_date`)} />
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Controller
                      control={control}
                      name={`issues.${i}.issue_type`}
                      render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={ISSUE_TYPES} placeholder="Type" className="h-8 text-xs" />}
                    />
                  </TableCell>
                  <TableCell className="min-w-56">
                    <Input className="h-8 text-xs" placeholder="e.g. Accommodation request" {...register(`issues.${i}.description`)} />
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Input className="h-8 text-xs" placeholder="HR" {...register(`issues.${i}.assigned_to`)} />
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Controller
                      control={control}
                      name={`issues.${i}.status`}
                      render={({ field }) => (
                        <OptionSelect value={field.value} onChange={field.onChange} options={ISSUE_STATUSES} placeholder="Status" className={cn('h-8 text-xs', pill(ISSUE_TONE[field.value] ?? 'muted'))} />
                      )}
                    />
                  </TableCell>
                  <TableCell className="max-w-44">
                    <AttachCell
                      name={pending?.name ?? issue?.attachment_name}
                      path={pending ? null : issue?.attachment_path}
                      onPick={(file) => setValue(`issues.${i}.pending_file`, file, { shouldDirty: true })}
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove issue">
                      <X className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}

// === Uniform & accommodation ======================================================

const CONDITION_TONE: Record<string, Parameters<typeof pill>[0]> = { issued: 'warning', assigned: 'primary', returned: 'success', damaged: 'danger', lost: 'danger' }

export function ItemsSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')

  return (
    <SectionCard
      icon={Shirt}
      title="Uniform & accommodation items"
      lockKey="items"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary text-primary"
          onClick={() =>
            append({ record_id: newId(), item_name: '', category: 'uniform', quantity: 1, size_allocation: '', issued_date: today(), condition: 'issued', acknowledged: false })
          }
        >
          <Plus /> Add item
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Size / allocation</TableHead>
              <TableHead>Issued date</TableHead>
              <TableHead>Condition / return</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-14 text-center text-muted-foreground">
                  No uniform or accommodation items issued.
                </TableCell>
              </TableRow>
            )}
            {fields.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell className="min-w-36">
                  <Input className="h-8 text-xs" placeholder="e.g. T-shirt, Bed" aria-invalid={!!formState.errors.items?.[i]?.item_name} {...register(`items.${i}.item_name`)} />
                </TableCell>
                <TableCell className="min-w-32">
                  <Controller
                    control={control}
                    name={`items.${i}.category`}
                    render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={ITEM_CATEGORIES} placeholder="Category" className="h-8 text-xs" />}
                  />
                </TableCell>
                <TableCell className="w-20">
                  <Input type="number" min="0" className="h-8 text-xs" {...register(`items.${i}.quantity`)} />
                </TableCell>
                <TableCell className="min-w-32">
                  <Input className="h-8 text-xs" placeholder="L / Room 04, Bed 02" {...register(`items.${i}.size_allocation`)} />
                </TableCell>
                <TableCell className="min-w-36">
                  <Input type="date" className="h-8 text-xs" {...register(`items.${i}.issued_date`)} />
                </TableCell>
                <TableCell className="min-w-32">
                  <Controller
                    control={control}
                    name={`items.${i}.condition`}
                    render={({ field }) => (
                      <OptionSelect value={field.value} onChange={field.onChange} options={ITEM_CONDITIONS} placeholder="Condition" className={cn('h-8 text-xs', pill(CONDITION_TONE[field.value] ?? 'muted'))} />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-xs">
                    <Controller
                      control={control}
                      name={`items.${i}.acknowledged`}
                      render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
                    />
                    <span className={items[i]?.acknowledged ? 'text-success' : 'text-muted-foreground'}>{items[i]?.acknowledged ? 'Received' : 'Pending'}</span>
                  </label>
                </TableCell>
                <TableCell>
                  <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove item">
                    <X className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}

// === Labour fine ===================================================================

const FINE_TONE: Record<string, Parameters<typeof pill>[0]> = { none: 'muted', pending_verification: 'warning', verified: 'primary', paid: 'success', waived: 'success' }

export function LabourFineSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { register, control, watch, setValue, formState } = form
  const pending = watch('labour_fine_pending_file') as File | undefined

  return (
    <SectionCard icon={FileWarning} title="Labour fine details" lockKey="labour_fine">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Amount (AED)" error={formState.errors.labour_fine_amount?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="Pending verification" {...register('labour_fine_amount')} />
        </Field>
        <Field label="Status">
          <Controller
            control={control}
            name="labour_fine_status"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={field.onChange}
                options={LABOUR_FINE_STATUSES}
                placeholder="Select status"
                className={field.value ? pill(FINE_TONE[field.value] ?? 'muted') : undefined}
              />
            )}
          />
        </Field>
        <Field label="Checked date">
          <IconInput icon={CalendarDays} type="date" {...register('labour_fine_checked_date')} />
        </Field>
        <Field label="Reference / attachment">
          <div className="flex h-10 items-center gap-2 rounded-md border px-3">
            <Input className="h-8 border-0 px-0 shadow-none focus-visible:ring-0" placeholder="MOHRE reference" {...register('labour_fine_reference')} />
            <AttachCell
              name={pending?.name ?? watch('labour_fine_attachment_name')}
              path={pending ? null : watch('labour_fine_attachment_path')}
              onPick={(file) => setValue('labour_fine_pending_file', file, { shouldDirty: true })}
              label=""
            />
          </div>
        </Field>
        <Field label="Remarks" className="lg:col-span-2">
          <Input className="h-10" placeholder="e.g. Requires verification from MOHRE portal" {...register('labour_fine_remarks')} />
        </Field>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="size-3.5" /> The system doesn't calculate fines — enter the amount after checking MOHRE / ICP.
      </p>
    </SectionCard>
  )
}
