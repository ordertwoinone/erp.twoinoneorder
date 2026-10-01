import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'
import { Controller, useFieldArray } from 'react-hook-form'
import { differenceInCalendarMonths, parseISO } from 'date-fns'
import { ArrowRightLeft, CalendarDays, Check, Eye, Landmark, Minus, Plus, ShieldCheck, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { INCENTIVE_BASES, MONTHLY_STATUSES } from '../../employeeOptions'
import type { PayrollHistory } from '../../hooks/useEmployeeRecord'
import { SECTION_ACCESS } from '../../recordAccess'
import { Field, OptionSelect, SectionCard } from './RecordUi'
import { useRecordLock } from './recordLockContext'
import { computeIncentive, newId, num, shortDate } from './recordUtils'

const STATUS_TONE: Record<string, string> = {
  pending: 'border-warning/40 bg-warning/15 text-warning-foreground',
  approved: 'border-success/30 bg-success/10 text-success',
  paid: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  partially_paid: 'border-warning/40 bg-warning/15 text-warning-foreground',
}

// === Branch transfer history (employee_assignments, read-only) ====================

export function TransferHistorySection({
  assignments,
  loading,
}: {
  assignments: { id: string; starts_at: string; ends_at: string | null; restaurants: { name: string; code: string } | null }[] | undefined
  loading: boolean
}) {
  return (
    <SectionCard icon={ArrowRightLeft} title="Branch transfer history" lockKey="transfers">
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Branch</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(assignments ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No branch history yet — it is recorded automatically when the branch changes.'}
                </TableCell>
              </TableRow>
            )}
            {(assignments ?? []).map((a) => {
              const months = differenceInCalendarMonths(a.ends_at ? parseISO(a.ends_at) : new Date(), parseISO(a.starts_at))
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.restaurants?.name ?? 'Deleted branch'}
                    {!a.ends_at && <span className="ml-2 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] text-success">Current</span>}
                  </TableCell>
                  <TableCell>{shortDate(a.starts_at)}</TableCell>
                  <TableCell>{a.ends_at ? shortDate(a.ends_at) : 'Present'}</TableCell>
                  <TableCell className="text-muted-foreground">{months < 1 ? '< 1 month' : `${months} month${months === 1 ? '' : 's'}`}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}

// === Monthly sales & incentives ====================================================

export function IncentivesSection({ form, restaurants }: { form: UseFormReturn<EmployeeRecordInput>; restaurants: RestaurantOption[] }) {
  const { control, register, watch, getValues, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'monthly_records' })
  const rows = watch('monthly_records')
  const enabled = watch('incentive_enabled')
  const basis = watch('incentive_basis')
  const years = useMemo(() => {
    const set = new Set(rows.map((r) => r.period_month?.slice(0, 4)).filter(Boolean))
    set.add(String(new Date().getFullYear()))
    return [...set].sort().reverse()
  }, [rows])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const listError = formState.errors.monthly_records?.root?.message ?? formState.errors.monthly_records?.message

  const yearRows = fields.map((f, i) => ({ f, i })).filter(({ i }) => (rows[i]?.period_month ?? '').startsWith(year) || !rows[i]?.period_month)
  const totals = yearRows.reduce(
    (acc, { i }) => ({
      sales: acc.sales + num(rows[i]?.eligible_sales),
      incentive: acc.incentive + (enabled ? computeIncentive(rows[i] ?? {}, basis) : 0),
    }),
    { sales: 0, incentive: 0 },
  )

  function addMonth() {
    const used = new Set(getValues('monthly_records').map((r) => r.period_month))
    const d = new Date()
    let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    while (used.has(key)) {
      d.setMonth(d.getMonth() - 1)
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    append({
      record_id: newId(),
      period_month: key,
      restaurant_id: getValues('current_restaurant_id'),
      attendance_days: '',
      working_days: 30,
      eligible_sales: '',
      orders_count: '',
      incentive_rate: getValues('incentive_rate') ?? '',
      status: 'pending',
    })
    setYear(key.slice(0, 4))
  }

  return (
    <SectionCard
      icon={TrendingUp}
      title="Monthly employee / waiter sales & incentives"
      lockKey="incentives"
      actions={
        <Button type="button" variant="outline" size="sm" className="border-primary text-primary" onClick={addMonth}>
          <Plus /> Add month
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Percentage incentive">
          <Controller
            control={control}
            name="incentive_enabled"
            render={({ field }) => (
              <label className="flex h-10 items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                {field.value ? 'On' : 'Off'}
              </label>
            )}
          />
        </Field>
        <Field label="Calculation basis">
          <Controller
            control={control}
            name="incentive_basis"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={INCENTIVE_BASES} placeholder="Eligible sales" />}
          />
        </Field>
        <Field label={basis === 'orders' ? 'Default rate (AED / order)' : 'Default rate (%)'} error={formState.errors.incentive_rate?.message}>
          <Input className="h-10" type="number" step="0.01" min="0" placeholder={basis === 'orders' ? 'e.g. 1' : 'e.g. 2'} {...register('incentive_rate')} />
        </Field>
        <Field label="Year">
          <OptionSelect value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} placeholder="Year" />
        </Field>
        <div className="rounded-lg border bg-muted/20 px-3 py-1.5 text-xs">
          <p>
            Sales {year}: <span className="font-semibold tabular-nums">{formatCurrency(totals.sales)}</span>
          </p>
          <p>
            Incentive {year}: <span className="font-semibold text-success tabular-nums">{formatCurrency(totals.incentive)}</span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Month</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Attendance (days)</TableHead>
              <TableHead>Eligible sales (AED)</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>{basis === 'orders' ? 'AED / order' : 'Incentive %'}</TableHead>
              <TableHead className="text-right">Incentive (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-14 text-center text-muted-foreground">
                  No monthly records for {year}.
                </TableCell>
              </TableRow>
            )}
            {yearRows.map(({ f, i }) => {
              const row = rows[i]
              const incentive = enabled ? computeIncentive(row ?? {}, basis) : 0
              const err = formState.errors.monthly_records?.[i]
              return (
                <TableRow key={f.id}>
                  <TableCell className="min-w-36">
                    <Input type="month" className="h-8 text-xs" aria-invalid={!!err?.period_month} {...register(`monthly_records.${i}.period_month`)} />
                  </TableCell>
                  <TableCell className="min-w-40">
                    <Controller
                      control={control}
                      name={`monthly_records.${i}.restaurant_id`}
                      render={({ field }) => (
                        <OptionSelect value={field.value} onChange={field.onChange} options={restaurants.map((r) => ({ value: r.id, label: r.name }))} placeholder="Branch" className="h-8 text-xs" />
                      )}
                    />
                  </TableCell>
                  <TableCell className="min-w-32">
                    <div className="flex items-center gap-1">
                      <Input type="number" min="0" max="31" className="h-8 w-14 text-xs" {...register(`monthly_records.${i}.attendance_days`)} />
                      <span className="text-muted-foreground">/</span>
                      <Input type="number" min="0" max="31" className="h-8 w-14 text-xs" {...register(`monthly_records.${i}.working_days`)} />
                    </div>
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Input type="number" step="0.01" min="0" className="h-8 text-xs" {...register(`monthly_records.${i}.eligible_sales`)} />
                  </TableCell>
                  <TableCell className="min-w-24">
                    <Input type="number" min="0" className="h-8 text-xs" {...register(`monthly_records.${i}.orders_count`)} />
                  </TableCell>
                  <TableCell className="min-w-24">
                    <Input type="number" step="0.01" min="0" className="h-8 text-xs" {...register(`monthly_records.${i}.incentive_rate`)} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{enabled ? formatCurrency(incentive) : <span className="text-muted-foreground">Off</span>}</TableCell>
                  <TableCell className="min-w-32">
                    <Controller
                      control={control}
                      name={`monthly_records.${i}.status`}
                      render={({ field }) => (
                        <OptionSelect value={field.value} onChange={field.onChange} options={MONTHLY_STATUSES} placeholder="Status" className={cn('h-8 text-xs', STATUS_TONE[field.value])} />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove month">
                      <X className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {listError && <p className="mt-2 text-xs text-destructive">{listError}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Attendance, sales and orders here also feed the summary cards at the top of the page (latest month).</p>
    </SectionCard>
  )
}

// === Monthly salary & loan ledger (Payroll, read-only) ============================

export function SalaryLedgerSection({ history, loading }: { history: PayrollHistory | undefined; loading: boolean }) {
  const issued = (history?.advances ?? []).map((a) => ({ date: a.advance_date, amount: Number(a.amount) }))
  const entries = history?.entries ?? []
  const counted = (e: (typeof entries)[number]) => (e.status === 'approved' || e.status === 'posted' ? Number(e.advances_deducted) : 0)
  const rows = entries.map((e, index) => {
    // Running total of repayments up to and including this month.
    const deducted = entries.slice(0, index + 1).reduce((sum, x) => sum + counted(x), 0)
    const monthEnd = `${e.period_month.slice(0, 7)}-31`
    const issuedSoFar = issued.filter((a) => a.date <= monthEnd).reduce((s, a) => s + a.amount, 0)
    const paid = (e.salary_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    return {
      ...e,
      gross: Number(e.basic_salary) + Number(e.allowances_total) + Number(e.overtime_amount),
      paid,
      loanBalance: Math.max(issuedSoFar - deducted, 0),
    }
  })

  return (
    <SectionCard icon={Landmark} title="Monthly salary & loan ledger" lockKey="ledger">
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Salary (AED)</TableHead>
              <TableHead className="text-right">Loan deduction</TableHead>
              <TableHead className="text-right">Other deduction</TableHead>
              <TableHead className="text-right">Net payable</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Loan balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-14 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No salary entries in Payroll yet.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/payroll/${r.id}`} className="font-medium text-primary hover:underline">
                    {shortDate(r.period_month, 'MMM yyyy')}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.gross)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.advances_deducted) ? formatCurrency(Number(r.advances_deducted)) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.deductions_total) ? formatCurrency(Number(r.deductions_total)) : '—'}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(Number(r.net_salary))}</TableCell>
                <TableCell className="text-right tabular-nums">{r.paid ? formatCurrency(r.paid) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.loanBalance)}</TableCell>
                <TableCell>
                  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_TONE[r.payment_status] ?? 'border-border')}>
                    {r.status === 'draft' || r.status === 'pending_approval' ? r.status.replace('_', ' ') : r.payment_status.replace('_', ' ')}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">From Payroll — edit salaries there. Click a month to open the salary entry.</p>
    </SectionCard>
  )
}

// === Section access permissions ====================================================

export function SectionAccessTable() {
  const lock = useRecordLock()
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
        <ShieldCheck className="size-6 text-primary" /> Section access permissions
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Section</TableHead>
              <TableHead>Access level (view)</TableHead>
              <TableHead>Can edit</TableHead>
              <TableHead>You</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTION_ACCESS.map((s) => {
              const view = lock.canView(s.key)
              const edit = lock.canEdit(s.key)
              return (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground">{s.viewers}</TableCell>
                  <TableCell className="text-muted-foreground">{s.editors}</TableCell>
                  <TableCell>
                    {edit ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="size-3.5" /> Edit
                      </span>
                    ) : view ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Eye className="size-3.5" /> View only
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Minus className="size-3.5" /> Hidden
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" /> Roles: Owner = Owner / Admin; HR = anyone with "Manage employee records"; Accountant = "View salaries"; Branch manager = "View employee records". Change them in Users.
      </p>
    </section>
  )
}
