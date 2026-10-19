import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleDollarSign,
  Clock,
  FileSpreadsheet,
  FileWarning,
  FileCheck2,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { VISA_STATUSES, optionLabel } from '@/modules/employees/employeeOptions'

const BUCKET = 'employee-documents'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ReportRow {
  id: string
  employee_code: string
  full_name: string
  job_title: string | null
  nationality: string | null
  current_restaurant_id: string | null
  branch: string
  visa_status: string | null
  passport_number: string | null
  emirates_id: string | null
  labour_person_number: string | null
  work_permit_number: string | null
  joining_date: string | null
  labour_card_expiry: string | null
  work_permit_expiry: string | null
  work_permit_na: boolean
  visa_expiry: string | null
  emirates_id_expiry: string | null
  insurance_expiry: string | null
  passport_expiry: string | null
  medical_expiry: string | null
  labour_fine: number
  photo_url: string | null
  has_photo: boolean
  doc_types: Set<string>
}

function useEmployeesReportQuery() {
  return useQuery({
    queryKey: ['employees', 'report', 'v2'],
    queryFn: async (): Promise<ReportRow[]> => {
      const [employeesRes, docsRes, stepsRes] = await Promise.all([
        supabase
          .from('employees')
          .select(
            'id, employee_code, full_name, job_title, nationality, current_restaurant_id, visa_status, passport_number, emirates_id, labour_person_number, work_permit_number, joining_date, labour_permit_expiry, work_permit_expiry_available, work_permit_expiry, visa_expiry, emirates_id_expiry, insurance_expiry_date, health_insurance_expiry, passport_expiry_date, medical_expiry_date, labour_fine_amount, photo_attachment_id, restaurants(name)',
          )
          .order('full_name')
          .range(0, 4999),
        supabase.from('employee_documents').select('employee_id, document_type').range(0, 19999),
        // The residence visa's expiry lives on the typing-centre "Residency + Emirates ID" step.
        supabase.from('employee_visa_steps').select('employee_id, expiry_date').eq('step_key', 'residency_emirates_id').range(0, 4999),
      ])
      if (employeesRes.error) throw employeesRes.error
      if (docsRes.error) throw docsRes.error
      if (stepsRes.error) throw stepsRes.error
      const employees = employeesRes.data

      const docs = new Map<string, Set<string>>()
      for (const d of docsRes.data) {
        if (!docs.has(d.employee_id)) docs.set(d.employee_id, new Set())
        docs.get(d.employee_id)!.add(d.document_type)
      }
      const residency = new Map(stepsRes.data.map((s) => [s.employee_id, s.expiry_date]))

      // Photos: one batch of signed URLs for every employee that has one.
      const photoIds = employees.map((e) => e.photo_attachment_id).filter((v): v is string => !!v)
      const photoUrls = new Map<string, string>()
      if (photoIds.length) {
        const { data: attachments } = await supabase.from('attachments').select('id, storage_path').in('id', photoIds)
        const paths = (attachments ?? []).map((a) => a.storage_path)
        if (paths.length) {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
          const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
          for (const a of attachments ?? []) {
            const url = byPath.get(a.storage_path)
            if (url) photoUrls.set(a.id, url)
          }
        }
      }

      return employees.map((e) => ({
        id: e.id,
        employee_code: e.employee_code,
        full_name: e.full_name,
        job_title: e.job_title,
        nationality: e.nationality,
        current_restaurant_id: e.current_restaurant_id,
        branch: e.restaurants?.name ?? '—',
        visa_status: e.visa_status,
        passport_number: e.passport_number,
        emirates_id: e.emirates_id,
        labour_person_number: e.labour_person_number,
        work_permit_number: e.work_permit_number,
        joining_date: e.joining_date,
        labour_card_expiry: e.labour_permit_expiry,
        work_permit_expiry: e.work_permit_expiry_available ? e.work_permit_expiry : null,
        work_permit_na: !e.work_permit_expiry_available,
        visa_expiry: e.visa_expiry ?? residency.get(e.id) ?? null,
        emirates_id_expiry: e.emirates_id_expiry,
        insurance_expiry: e.insurance_expiry_date ?? e.health_insurance_expiry,
        passport_expiry: e.passport_expiry_date,
        medical_expiry: e.medical_expiry_date,
        labour_fine: Number(e.labour_fine_amount ?? 0),
        photo_url: e.photo_attachment_id ? (photoUrls.get(e.photo_attachment_id) ?? null) : null,
        has_photo: !!e.photo_attachment_id,
        doc_types: docs.get(e.id) ?? new Set(),
      }))
    },
  })
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const EXPIRIES = [
  { key: 'labour_card_expiry', label: 'Labour Card Expiry' },
  { key: 'work_permit_expiry', label: 'Work Permit Expiry' },
  { key: 'visa_expiry', label: 'Visa Expiry' },
  { key: 'emirates_id_expiry', label: 'Emirates ID Expiry' },
  { key: 'insurance_expiry', label: 'Insurance Expiry' },
  { key: 'passport_expiry', label: 'Passport Expiry' },
] as const
type ExpiryKey = (typeof EXPIRIES)[number]['key']

function daysUntil(value: string | null, today: Date) {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? differenceInCalendarDays(d, today) : null
}

/** The 20-point record checklist behind the "Documents (20)" score. */
const CHECKLIST: { label: string; done: (r: ReportRow) => boolean }[] = [
  { label: 'Photo', done: (r) => r.has_photo },
  { label: 'Nationality', done: (r) => !!r.nationality },
  { label: 'Position', done: (r) => !!r.job_title },
  { label: 'Joining date', done: (r) => !!r.joining_date },
  { label: 'Passport number', done: (r) => !!r.passport_number },
  { label: 'Passport expiry', done: (r) => !!r.passport_expiry },
  { label: 'Passport copy', done: (r) => r.doc_types.has('passport') },
  { label: 'Emirates ID number', done: (r) => !!r.emirates_id },
  { label: 'Emirates ID expiry', done: (r) => !!r.emirates_id_expiry },
  { label: 'Emirates ID copy', done: (r) => r.doc_types.has('emirates_id') },
  { label: 'Labour card / person number', done: (r) => !!r.labour_person_number },
  { label: 'Labour card expiry', done: (r) => !!r.labour_card_expiry },
  { label: 'Labour permit copy', done: (r) => r.doc_types.has('labour_permit') },
  { label: 'Work permit number', done: (r) => !!r.work_permit_number },
  { label: 'Work permit expiry', done: (r) => !!r.work_permit_expiry || r.work_permit_na },
  { label: 'Visa expiry', done: (r) => !!r.visa_expiry },
  { label: 'Visa copy', done: (r) => r.doc_types.has('visa') },
  { label: 'Medical expiry', done: (r) => !!r.medical_expiry },
  { label: 'Insurance expiry', done: (r) => !!r.insurance_expiry },
  { label: 'Insurance copy', done: (r) => r.doc_types.has('insurance') },
]
const docScore = (r: ReportRow) => CHECKLIST.filter((c) => c.done(r)).length
const missingItems = (r: ReportRow) => CHECKLIST.filter((c) => !c.done(r)).map((c) => c.label)

const NATIONALITY_CODES: Record<string, string> = {
  Indian: 'in', Pakistani: 'pk', Bangladeshi: 'bd', Filipino: 'ph', Egyptian: 'eg', Nepali: 'np', 'Sri Lankan': 'lk',
  Emirati: 'ae', Afghan: 'af', Algerian: 'dz', American: 'us', Armenian: 'am', Australian: 'au', Azerbaijani: 'az',
  Bahraini: 'bh', Belarusian: 'by', Brazilian: 'br', British: 'gb', Burmese: 'mm', Cameroonian: 'cm', Canadian: 'ca',
  Chinese: 'cn', Colombian: 'co', Congolese: 'cd', Djiboutian: 'dj', Dutch: 'nl', Eritrean: 'er', Ethiopian: 'et',
  French: 'fr', Gambian: 'gm', Georgian: 'ge', German: 'de', Ghanaian: 'gh', Greek: 'gr', Guinean: 'gn',
  Indonesian: 'id', Iranian: 'ir', Iraqi: 'iq', Irish: 'ie', Italian: 'it', Ivorian: 'ci', Jordanian: 'jo', Kazakh: 'kz',
  Kenyan: 'ke', Korean: 'kr', Kuwaiti: 'kw', Kyrgyz: 'kg', Lebanese: 'lb', Liberian: 'lr', Libyan: 'ly', Malagasy: 'mg',
  Malaysian: 'my', Maldivian: 'mv', Malian: 'ml', Mauritanian: 'mr', Moroccan: 'ma', Nigerian: 'ng', Omani: 'om',
  Palestinian: 'ps', Polish: 'pl', Portuguese: 'pt', Qatari: 'qa', Romanian: 'ro', Russian: 'ru', Rwandan: 'rw',
  Saudi: 'sa', Senegalese: 'sn', 'Sierra Leonean': 'sl', Somali: 'so', 'South African': 'za', Spanish: 'es',
  Sudanese: 'sd', Syrian: 'sy', Tajik: 'tj', Tanzanian: 'tz', Thai: 'th', Tunisian: 'tn', Turkish: 'tr', Turkmen: 'tm',
  Ugandan: 'ug', Ukrainian: 'ua', Uzbek: 'uz', Vietnamese: 'vn', Yemeni: 'ye', Zambian: 'zm', Zimbabwean: 'zw',
}

const VISA_STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  expired: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  under_process: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  on_hold: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  cancelled: 'border-border bg-muted text-muted-foreground',
  absconding: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
}

type SortKey = 'name' | 'branch' | 'nationality' | 'visa_status' | ExpiryKey | 'labour_fine' | 'docs'
type QuickFilter = 'all' | 'active' | 'expiring' | 'expired' | 'missing_docs' | 'fines'

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

function ExpiryCell({ value, days, na }: { value: string | null; days: number | null; na?: boolean }) {
  if (na) return <span className="text-xs text-muted-foreground">N/A</span>
  if (!value || days === null) return <span className="text-muted-foreground">—</span>
  const text = format(parseISO(value), 'd MMM yyyy')
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-1 text-xs font-medium whitespace-nowrap text-red-600 dark:text-red-400" title={`Expired ${Math.abs(days)} days ago`}>
        <AlertCircle className="size-3.5 fill-red-600 text-white dark:fill-red-400 dark:text-red-950" /> {text}
      </span>
    )
  if (days <= 30)
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-400" title={days === 0 ? 'Expires today' : `Expires in ${days} days`}>
        <TriangleAlert className="size-3.5" /> {text}
      </span>
    )
  return <span className="text-xs whitespace-nowrap tabular-nums">{text}</span>
}

function DocRing({ row }: { row: ReportRow }) {
  const score = docScore(row)
  const total = CHECKLIST.length
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const complete = score === total
  const color = complete ? 'stroke-emerald-500' : score / total >= 0.5 ? 'stroke-orange-400' : 'stroke-red-500'
  const missing = missingItems(row)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex size-10 items-center justify-center" aria-label={`${score} of ${total} documents`}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r={radius} fill="none" className="stroke-muted" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              className={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / total)}
            />
          </svg>
          <span className="text-[10px] font-semibold tabular-nums">
            {score}/{total}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-64 text-xs">
        {complete ? 'All 20 documents and details are on file.' : <>Missing: {missing.join(', ')}</>}
      </TooltipContent>
    </Tooltip>
  )
}

function Avatar({ row }: { row: ReportRow }) {
  const [failed, setFailed] = useState(false)
  if (row.photo_url && !failed)
    return <img src={row.photo_url} alt="" loading="lazy" onError={() => setFailed(true)} className="size-10 rounded-full border object-cover" />
  return (
    <span className="flex size-10 items-center justify-center rounded-full border bg-muted text-muted-foreground">
      <UserRound className="size-5" />
    </span>
  )
}

function Flag({ nationality }: { nationality: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!nationality) return <span className="text-muted-foreground">—</span>
  const code = NATIONALITY_CODES[nationality]
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {code && !failed && (
        <img src={`https://flagcdn.com/w40/${code}.png`} alt="" loading="lazy" onError={() => setFailed(true)} className="h-3.5 w-5 rounded-[2px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" />
      )}
      {nationality}
    </span>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'indigo' | 'rose'
  active: boolean
  onClick: () => void
}) {
  const tones = {
    blue: 'bg-sky-500/5 border-sky-500/15',
    green: 'bg-emerald-500/5 border-emerald-500/15',
    amber: 'bg-amber-500/5 border-amber-500/15',
    red: 'bg-red-500/5 border-red-500/15',
    indigo: 'bg-indigo-500/5 border-indigo-500/15',
    rose: 'bg-rose-500/5 border-rose-500/15',
  }
  const iconBg = {
    blue: 'bg-sky-500/15 text-sky-600',
    green: 'bg-emerald-500/15 text-emerald-600',
    amber: 'bg-amber-500/15 text-amber-600',
    red: 'bg-red-500/15 text-red-600',
    indigo: 'bg-indigo-500/15 text-indigo-600',
    rose: 'bg-rose-500/15 text-rose-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-4 rounded-xl border p-4 text-left shadow-xs transition hover:shadow-md',
        tones[tone],
        active && 'ring-2 ring-primary/50',
      )}
    >
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', iconBg[tone])}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block truncate text-2xl font-bold tabular-nums">{value}</span>
      </span>
    </button>
  )
}

function SortHead({
  label,
  sub,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sub?: string
  sortKey?: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (key: SortKey) => void
  className?: string
}) {
  const activeSort = sortKey && sort.key === sortKey
  const Icon = !activeSort ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cn('px-2 py-3 text-left align-middle text-xs font-semibold text-foreground', className)}>
      {sortKey ? (
        <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 text-left hover:text-primary">
          <span className="leading-tight">
            {label}
            {sub && <span className="block font-normal text-muted-foreground">{sub}</span>}
          </span>
          <Icon className={cn('size-3 shrink-0', activeSort ? 'text-primary' : 'text-muted-foreground/60')} />
        </button>
      ) : (
        <span className="leading-tight">{label}</span>
      )}
    </th>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesReportPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data = [], isLoading } = useEmployeesReportQuery()

  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState(selectedRestaurantId ?? 'all')
  const [nationality, setNationality] = useState('all')
  const [position, setPosition] = useState('all')
  const [visaStatus, setVisaStatus] = useState('all')
  const [quick, setQuick] = useState<QuickFilter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })

  const today = useMemo(() => new Date(), [])
  const expiryDays = (r: ReportRow) => EXPIRIES.map((e) => daysUntil(r[e.key], today)).filter((d): d is number => d !== null)

  const branchRows = data.filter((r) => branch === 'all' || r.current_restaurant_id === branch)
  const nationalities = [...new Set(data.map((r) => r.nationality).filter((v): v is string => !!v))].sort()
  const positions = [...new Set(data.map((r) => r.job_title?.trim()).filter((v): v is string => !!v))].sort()

  const isExpiring = (r: ReportRow) => expiryDays(r).some((d) => d >= 0 && d <= 30)
  const isExpired = (r: ReportRow) => expiryDays(r).some((d) => d < 0)
  const kpis = {
    total: branchRows.length,
    active: branchRows.filter((r) => r.visa_status === 'active').length,
    expiring: branchRows.filter(isExpiring).length,
    expired: branchRows.filter(isExpired).length,
    missingDocs: branchRows.filter((r) => docScore(r) < CHECKLIST.length).length,
    fines: branchRows.reduce((s, r) => s + r.labour_fine, 0),
  }

  const term = search.trim().toLowerCase()
  const filtered = branchRows.filter((r) => {
    if (term && ![r.full_name, r.employee_code, r.passport_number, r.emirates_id].some((v) => v?.toLowerCase().includes(term))) return false
    if (nationality !== 'all' && r.nationality !== nationality) return false
    if (position !== 'all' && r.job_title?.trim() !== position) return false
    if (visaStatus !== 'all' && r.visa_status !== visaStatus) return false
    if (quick === 'active' && r.visa_status !== 'active') return false
    if (quick === 'expiring' && !isExpiring(r)) return false
    if (quick === 'expired' && !isExpired(r)) return false
    if (quick === 'missing_docs' && docScore(r) === CHECKLIST.length) return false
    if (quick === 'fines' && r.labour_fine <= 0) return false
    return true
  })

  const sortValue = (r: ReportRow): string | number => {
    switch (sort.key) {
      case 'name':
        return r.full_name.toLowerCase()
      case 'branch':
        return r.branch.toLowerCase()
      case 'nationality':
        return (r.nationality ?? '~').toLowerCase()
      case 'visa_status':
        return r.visa_status ?? '~'
      case 'labour_fine':
        return r.labour_fine
      case 'docs':
        return docScore(r)
      default:
        // Expiry columns: blanks always last.
        return r[sort.key] ?? (sort.dir === 'asc' ? '9999-12-31' : '0000-01-01')
    }
  }
  const rows = [...filtered].sort((a, b) => {
    const va = sortValue(a)
    const vb = sortValue(b)
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sort.dir === 'asc' ? cmp : -cmp
  })
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const toggleQuick = (q: QuickFilter) => setQuick((cur) => (cur === q ? 'all' : q))

  async function exportToExcel() {
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((r, i) => ({
          '#': i + 1,
          'Employee name': r.full_name,
          'Employee ID': r.employee_code,
          Branch: r.branch,
          Position: r.job_title ?? '',
          Nationality: r.nationality ?? '',
          'Visa status': optionLabel(VISA_STATUSES, r.visa_status),
          'Labour card expiry': r.labour_card_expiry ?? '',
          'Work permit expiry': r.work_permit_na ? 'N/A' : (r.work_permit_expiry ?? ''),
          'Visa expiry': r.visa_expiry ?? '',
          'Emirates ID expiry': r.emirates_id_expiry ?? '',
          'Insurance expiry': r.insurance_expiry ?? '',
          'Passport expiry': r.passport_expiry ?? '',
          'Labour fine (AED)': r.labour_fine,
          [`Documents (${CHECKLIST.length})`]: `${docScore(r)}/${CHECKLIST.length}`,
          Missing: missingItems(r).join(', '),
        })),
      )
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Employees')
      XLSX.writeFile(book, `employees-report-${format(today, 'yyyy-MM-dd')}.xlsx`)
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message })
    }
  }

  const filterSelect = (value: string, onChange: (v: string) => void, all: string, options: { value: string; label: string }[]) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees Report</h1>
          <p className="text-muted-foreground">Manage your employees, visa status, labour cards, work permits, insurance, fines and documents across your restaurants.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={rows.length === 0}>
            <FileSpreadsheet /> Export
          </Button>
          {hasPermission('employees.manage') && (
            <Button asChild>
              <Link to="/employees/new">
                <Plus /> Add Employee
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={Users} tone="blue" label="Total Employees" value={String(kpis.total)} active={quick === 'all'} onClick={() => setQuick('all')} />
        <Kpi icon={FileCheck2} tone="green" label="Active" value={String(kpis.active)} active={quick === 'active'} onClick={() => toggleQuick('active')} />
        <Kpi icon={Clock} tone="amber" label="Expiring Within 30 Days" value={String(kpis.expiring)} active={quick === 'expiring'} onClick={() => toggleQuick('expiring')} />
        <Kpi icon={AlertTriangle} tone="red" label="Expired" value={String(kpis.expired)} active={quick === 'expired'} onClick={() => toggleQuick('expired')} />
        <Kpi icon={FileWarning} tone="indigo" label="Missing Documents" value={String(kpis.missingDocs)} active={quick === 'missing_docs'} onClick={() => toggleQuick('missing_docs')} />
        <Kpi icon={CircleDollarSign} tone="rose" label="Total Labour Fines" value={formatCurrency(kpis.fines)} active={quick === 'fines'} onClick={() => toggleQuick('fines')} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 bg-card pl-9" placeholder="Search by name, employee ID, passport or Emirates ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filterSelect(branch, setBranch, 'All Branches', restaurants.map((r) => ({ value: r.id, label: r.name })))}
        {filterSelect(nationality, setNationality, 'All Nationalities', nationalities.map((n) => ({ value: n, label: n })))}
        {filterSelect(position, setPosition, 'All Positions', positions.map((p) => ({ value: p, label: p })))}
        {filterSelect(visaStatus, setVisaStatus, 'All Visa Statuses', VISA_STATUSES)}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-330 border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <SortHead label="#" sort={sort} onSort={onSort} className="w-10 text-center" />
              <SortHead label="Photo" sort={sort} onSort={onSort} className="w-16" />
              <SortHead label="Employee Name" sub="Employee ID" sortKey="name" sort={sort} onSort={onSort} />
              <SortHead label="Branch" sortKey="branch" sort={sort} onSort={onSort} />
              <SortHead label="Position" sort={sort} onSort={onSort} />
              <SortHead label="Nationality" sortKey="nationality" sort={sort} onSort={onSort} />
              <SortHead label="Visa Status" sortKey="visa_status" sort={sort} onSort={onSort} />
              {EXPIRIES.map((e) => {
                const [first, ...rest] = e.label.split(' ')
                const label = rest.length > 1 ? `${first} ${rest[0]}` : first
                const sub = rest.length > 1 ? rest.slice(1).join(' ') : rest.join(' ')
                return <SortHead key={e.key} label={label} sub={sub} sortKey={e.key} sort={sort} onSort={onSort} />
              })}
              <SortHead label="Labour Fine" sub="(AED)" sortKey="labour_fine" sort={sort} onSort={onSort} />
              <SortHead label={`Documents`} sub={`(${CHECKLIST.length})`} sortKey="docs" sort={sort} onSort={onSort} className="text-center" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={16} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={16} className="h-32 text-center text-muted-foreground">
                  No employees match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} onClick={() => navigate(`/employees/${r.id}`)} className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-2 py-2 text-center font-medium">{i + 1}</td>
                  <td className="px-2 py-2">
                    <Avatar row={r} />
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-semibold whitespace-nowrap uppercase">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">{r.employee_code}</p>
                  </td>
                  <td className="max-w-36 px-2 py-2 text-xs">{r.branch}</td>
                  <td className="max-w-36 px-2 py-2 text-xs uppercase">{r.job_title || '—'}</td>
                  <td className="px-2 py-2 text-xs">
                    <Flag nationality={r.nationality} />
                  </td>
                  <td className="px-2 py-2">
                    {r.visa_status ? (
                      <span className={cn('inline-flex rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap', VISA_STATUS_STYLES[r.visa_status] ?? 'bg-muted')}>
                        {optionLabel(VISA_STATUSES, r.visa_status)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {EXPIRIES.map((e) => (
                    <td key={e.key} className="px-2 py-2">
                      <ExpiryCell value={r[e.key]} days={daysUntil(r[e.key], today)} na={e.key === 'work_permit_expiry' && r.work_permit_na} />
                    </td>
                  ))}
                  <td className={cn('px-2 py-2 text-xs whitespace-nowrap tabular-nums', r.labour_fine > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                    {formatCurrency(r.labour_fine)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <DocRing row={r} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {branchRows.length} employees ·{' '}
        <span className="text-red-600 dark:text-red-400">red</span> = expired, <span className="text-amber-700 dark:text-amber-400">amber</span> = expires within 30 days ·
        Documents counts 20 record items (numbers, expiries and uploaded copies) — hover a ring to see what’s missing.
      </p>
    </div>
  )
}
