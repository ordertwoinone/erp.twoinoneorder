import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { AlertTriangle, CalendarClock, CircleDollarSign, FileSpreadsheet, Gavel, HandCoins, Search, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { DECISIONS, VISA_STATUSES, optionLabel } from '@/modules/employees/employeeOptions'

const EXPIRY_FIELDS = [
  { key: 'labour_permit_expiry', label: 'Labour permit' },
  { key: 'work_permit_expiry', label: 'Work permit' },
  { key: 'emirates_id_expiry', label: 'Emirates ID' },
  { key: 'passport_expiry_date', label: 'Passport' },
  { key: 'medical_expiry_date', label: 'Medical' },
] as const

type ExpiryKey = (typeof EXPIRY_FIELDS)[number]['key']

function useEmployeesReportQuery() {
  return useQuery({
    queryKey: ['employees', 'report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(
          'id, employee_code, full_name, job_title, nationality, current_restaurant_id, employment_status, visa_status, work_permit_expiry_available, work_permit_expiry, labour_permit_expiry, emirates_id_expiry, passport_expiry_date, medical_expiry_date, base_salary, renewal_salary, final_status, settlement_status, settlement_amount, labour_fine_amount, restaurants(name)',
        )
        .order('full_name')
        .range(0, 4999)
      if (error) throw error
      return data
    },
  })
}

type EmployeeReportRow = NonNullable<ReturnType<typeof useEmployeesReportQuery>['data']>[number]

function daysUntil(value: string | null, today: Date): number | null {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? differenceInCalendarDays(date, today) : null
}

function expiryDays(row: EmployeeReportRow, key: ExpiryKey, today: Date) {
  if (key === 'work_permit_expiry' && !row.work_permit_expiry_available) return null
  return daysUntil(row[key], today)
}

function ExpiryCell({ value, days }: { value: string | null; days: number | null }) {
  if (!value || days === null) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-xs tabular-nums whitespace-nowrap',
        days < 0 && 'bg-destructive/10 font-semibold text-destructive',
        days >= 0 && days <= 30 && 'bg-warning/15 font-semibold text-warning-foreground',
      )}
      title={days < 0 ? `Expired ${Math.abs(days)} days ago` : `In ${days} days`}
    >
      {format(parseISO(value), 'd MMM yyyy')}
    </span>
  )
}

function Kpi({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: 'danger' | 'warn' }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn('size-4', tone === 'danger' ? 'text-destructive' : tone === 'warn' ? 'text-warning-foreground' : 'text-primary')} />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone === 'danger' && 'text-destructive')}>{value}</p>
    </div>
  )
}

export default function EmployeesReportPage() {
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data, isLoading } = useEmployeesReportQuery()

  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState(selectedRestaurantId ?? 'all')
  const [visaStatus, setVisaStatus] = useState('all')
  const [decision, setDecision] = useState('all')
  const [expiryWindow, setExpiryWindow] = useState('all')

  const today = useMemo(() => new Date(), [])

  const branchRows = useMemo(
    () => (data ?? []).filter((r) => branch === 'all' || r.current_restaurant_id === branch),
    [data, branch],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return branchRows.filter((r) => {
      if (term && !r.full_name.toLowerCase().includes(term) && !r.employee_code.toLowerCase().includes(term)) return false
      if (visaStatus !== 'all' && r.visa_status !== visaStatus) return false
      if (decision === 'undecided' ? r.final_status : decision !== 'all' && r.final_status !== decision) return false
      if (expiryWindow !== 'all') {
        const days = EXPIRY_FIELDS.map((f) => expiryDays(r, f.key, today)).filter((d): d is number => d !== null)
        if (expiryWindow === 'expired' ? !days.some((d) => d < 0) : !days.some((d) => d >= 0 && d <= Number(expiryWindow))) return false
      }
      return true
    })
  }, [branchRows, search, visaStatus, decision, expiryWindow, today])

  const kpis = useMemo(() => {
    const docDays = (r: EmployeeReportRow) => EXPIRY_FIELDS.map((f) => expiryDays(r, f.key, today)).filter((d): d is number => d !== null)
    return {
      total: branchRows.length,
      expired: branchRows.filter((r) => docDays(r).some((d) => d < 0)).length,
      expiringSoon: branchRows.filter((r) => docDays(r).some((d) => d >= 0 && d <= 30)).length,
      pendingDecisions: branchRows.filter((r) => !r.final_status).length,
      fines: branchRows.reduce((s, r) => s + (r.labour_fine_amount ?? 0), 0),
      pendingSettlements: branchRows
        .filter((r) => r.settlement_status === 'pending' || r.settlement_status === 'partially_paid')
        .reduce((s, r) => s + (r.settlement_amount ?? 0), 0),
    }
  }, [branchRows, today])

  const columns = useMemo<ColumnDef<EmployeeReportRow>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Employee',
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{row.original.full_name}</p>
            <p className="text-xs text-muted-foreground">{row.original.employee_code}</p>
          </div>
        ),
      },
      { id: 'branch', header: 'Branch', cell: ({ row }) => row.original.restaurants?.name ?? '—' },
      { accessorKey: 'job_title', header: 'Position', cell: ({ getValue }) => (getValue() as string) || '—' },
      { accessorKey: 'nationality', header: 'Nationality', cell: ({ getValue }) => (getValue() as string) || '—' },
      {
        accessorKey: 'visa_status',
        header: 'Visa status',
        cell: ({ getValue }) => (getValue() ? <StatusBadge status={getValue() as string} /> : '—'),
      },
      ...EXPIRY_FIELDS.map<ColumnDef<EmployeeReportRow>>((f) => ({
        id: f.key,
        header: f.label,
        cell: ({ row }) => (
          <ExpiryCell
            value={f.key === 'work_permit_expiry' && !row.original.work_permit_expiry_available ? null : row.original[f.key]}
            days={expiryDays(row.original, f.key, today)}
          />
        ),
      })),
      {
        id: 'salary',
        header: 'Salary → renewal',
        cell: ({ row }) => {
          const { base_salary: current, renewal_salary: renewal } = row.original
          if (current == null && renewal == null) return '—'
          return (
            <span className="text-sm whitespace-nowrap tabular-nums">
              {current != null ? formatCurrency(current) : '—'}
              {renewal != null && renewal !== current && <span className="text-muted-foreground"> → {formatCurrency(renewal)}</span>}
            </span>
          )
        },
      },
      {
        accessorKey: 'final_status',
        header: 'Decision',
        cell: ({ getValue }) =>
          getValue() ? (
            <StatusBadge status={getValue() === 'renew' ? 'approved' : 'cancelled'} />
          ) : (
            <span className="text-xs text-muted-foreground">Not decided</span>
          ),
      },
      {
        id: 'settlement',
        header: 'Settlement',
        cell: ({ row }) =>
          row.original.settlement_amount ? (
            <span className="text-sm whitespace-nowrap">
              <span className="tabular-nums">{formatCurrency(row.original.settlement_amount)}</span>{' '}
              <span className="text-xs text-muted-foreground capitalize">({row.original.settlement_status.replace('_', ' ')})</span>
            </span>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'labour_fine_amount',
        header: 'Labour fine',
        cell: ({ getValue }) => {
          const fine = getValue() as number | null
          return fine ? <span className="font-semibold text-destructive tabular-nums">{formatCurrency(fine)}</span> : '—'
        },
      },
    ],
    [today],
  )

  async function exportToExcel() {
    try {
      const XLSX = await import('xlsx')
      const sheetRows = rows.map((r) => ({
        'Employee ID': r.employee_code,
        Name: r.full_name,
        Branch: r.restaurants?.name ?? '',
        Position: r.job_title ?? '',
        Nationality: r.nationality ?? '',
        'Visa status': optionLabel(VISA_STATUSES, r.visa_status),
        'Labour permit expiry': r.labour_permit_expiry ?? '',
        'Work permit expiry': r.work_permit_expiry_available ? (r.work_permit_expiry ?? '') : 'Not available',
        'Emirates ID expiry': r.emirates_id_expiry ?? '',
        'Passport expiry': r.passport_expiry_date ?? '',
        'Medical expiry': r.medical_expiry_date ?? '',
        'Current salary (AED)': r.base_salary ?? '',
        'Renewal salary (AED)': r.renewal_salary ?? '',
        Decision: r.final_status ? optionLabel(DECISIONS, r.final_status) : 'Not decided',
        'Settlement amount (AED)': r.settlement_amount ?? '',
        'Settlement status': r.settlement_status.replace('_', ' '),
        'Labour fine (AED)': r.labour_fine_amount ?? '',
      }))
      const sheet = XLSX.utils.json_to_sheet(sheetRows)
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Employees')
      XLSX.writeFile(book, `employees-report-${format(today, 'yyyy-MM-dd')}.xlsx`)
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees Report"
        description="Document expiries, visa status, renewal decisions and settlements across your staff."
        actions={
          <Button variant="outline" onClick={exportToExcel} disabled={rows.length === 0}>
            <FileSpreadsheet /> Export to Excel
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label="Employees" value={String(kpis.total)} />
        <Kpi icon={AlertTriangle} label="Documents expired" value={String(kpis.expired)} tone={kpis.expired ? 'danger' : undefined} />
        <Kpi icon={CalendarClock} label="Expiring in 30 days" value={String(kpis.expiringSoon)} tone={kpis.expiringSoon ? 'warn' : undefined} />
        <Kpi icon={Gavel} label="Pending decisions" value={String(kpis.pendingDecisions)} />
        <Kpi icon={CircleDollarSign} label="Labour fines" value={formatCurrency(kpis.fines)} tone={kpis.fines ? 'danger' : undefined} />
        <Kpi icon={HandCoins} label="Pending settlements" value={formatCurrency(kpis.pendingSettlements)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or employee ID…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={visaStatus} onValueChange={setVisaStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visa statuses</SelectItem>
            {VISA_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="renew">Renew</SelectItem>
            <SelectItem value="cancel">Cancel</SelectItem>
            <SelectItem value="undecided">Not decided</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiryWindow} onValueChange={setExpiryWindow}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All document expiries</SelectItem>
            <SelectItem value="expired">Any document expired</SelectItem>
            <SelectItem value="30">Expiring within 30 days</SelectItem>
            <SelectItem value="60">Expiring within 60 days</SelectItem>
            <SelectItem value="90">Expiring within 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {rows.length} of {branchRows.length} employees. <span className="text-destructive">Red</span> = expired,{' '}
        <span className="text-warning-foreground">amber</span> = due within 30 days.
      </p>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No employees match these filters."
        onRowClick={(row) => navigate(`/employees/${row.id}`)}
      />
    </div>
  )
}
