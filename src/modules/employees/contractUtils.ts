import { addDays, addMonths, differenceInCalendarDays, differenceInMonths, format, intervalToDuration, isAfter, isBefore, isValid, parseISO } from 'date-fns'
import type { ContractSalary } from '@/schemas/employee'
import type { Option } from './employeeOptions'

export type ContractLanguage = 'en' | 'ar' | 'both'
export const CONTRACT_LANGUAGES: { value: ContractLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'both', label: 'English + Arabic' },
]

export const CONTRACT_TYPES: (Option & { months?: number })[] = [
  { value: '2_year', label: '2-Year Employment Contract', months: 24 },
  { value: '1_year', label: '1-Year Employment Contract', months: 12 },
  { value: '3_year', label: '3-Year Employment Contract', months: 36 },
  { value: 'limited', label: 'Limited (fixed-term) contract' },
  { value: 'unlimited', label: 'Unlimited contract' },
  { value: 'part_time', label: 'Part-time contract' },
  { value: 'probation', label: 'Probation contract', months: 6 },
]

export const CONTRACT_STATUSES: (Option & { dot: string })[] = [
  { value: 'draft', label: 'Draft', dot: 'bg-muted-foreground' },
  { value: 'active', label: 'Active', dot: 'bg-success' },
  { value: 'renewed', label: 'Renewed', dot: 'bg-primary' },
  { value: 'expired', label: 'Expired', dot: 'bg-destructive' },
  { value: 'terminated', label: 'Terminated', dot: 'bg-destructive' },
]

export const MIN_SERVICE_OPTIONS: Option[] = [
  { value: '0', label: 'Not required' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year (12 months)' },
  { value: '24', label: '2 years (24 months)' },
  { value: '36', label: '3 years (36 months)' },
]

/** Total monthly salary: basic + every allowance paid as an amount (in-kind allowances add nothing). */
export function salaryTotal(s: ContractSalary | undefined) {
  if (!s) return 0
  const n = (v: number | '' | undefined) => Number(v) || 0
  return n(s.basic) + (s.housing_by_employer ? 0 : n(s.housing)) + (s.transport_by_employer ? 0 : n(s.transport)) + (s.food_by_employer ? 0 : n(s.food)) + n(s.other)
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} hundred`)
  const r = n % 100
  if (r) parts.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ''))
  return parts.join(' ')
}

/** 5000 → "Five thousand"; 1250.5 → "One thousand two hundred fifty and 50 fils". */
export function amountInWords(amount: number) {
  const whole = Math.floor(Math.abs(amount))
  const fils = Math.round((Math.abs(amount) - whole) * 100)
  let words = ''
  if (whole === 0) words = 'zero'
  else {
    const parts: string[] = []
    let rest = whole
    for (const [size, name] of [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1000, 'thousand']] as const) {
      if (rest >= size) {
        parts.push(`${below1000(Math.floor(rest / size))} ${name}`)
        rest %= size
      }
    }
    if (rest) parts.push(below1000(rest))
    words = parts.join(' ')
  }
  if (fils) words += ` and ${fils} fils`
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const parse = (v: string | null | undefined) => {
  const d = v ? parseISO(v) : null
  return d && isValid(d) ? d : null
}

/** "2 years 3 months 4 days" style, short: "1y 8 months 3 days". */
export function spanText(from: Date, to: Date) {
  if (!isAfter(to, from)) return '0 days'
  const d = intervalToDuration({ start: from, end: to })
  const parts: string[] = []
  if (d.years) parts.push(`${d.years}y`)
  if (d.months) parts.push(`${d.months} month${d.months === 1 ? '' : 's'}`)
  if (d.days || parts.length === 0) parts.push(`${d.days ?? 0} day${d.days === 1 ? '' : 's'}`)
  return parts.join(' ')
}

/** End date for a contract type that has a fixed length: start + months − 1 day. */
export function defaultEndDate(start: string, contractType: string) {
  const s = parse(start)
  const months = CONTRACT_TYPES.find((t) => t.value === contractType)?.months
  if (!s || !months) return null
  // format(), not toISOString(): local midnight in the UAE is the previous day in UTC.
  return format(addDays(addMonths(s, months), -1), 'yyyy-MM-dd')
}

export interface ContractProgress {
  durationMonths: number | null
  /** Months the progress bar counts towards: minimum service, else the contract length. */
  targetMonths: number | null
  monthsCompleted: number
  percent: number
  completedText: string
  remainingText: string
  started: boolean
  ended: boolean
  minServiceMet: boolean
}

export function contractProgress(start: string, end: string, minServiceMonths: number | '' | undefined, today = new Date()): ContractProgress | null {
  const s = parse(start)
  if (!s) return null
  const e = parse(end)
  const durationMonths = e ? differenceInMonths(addDays(e, 1), s) : null
  const min = typeof minServiceMonths === 'number' && minServiceMonths > 0 ? minServiceMonths : null
  const targetMonths = min ?? durationMonths
  const started = !isBefore(today, s)
  const ended = !!e && isAfter(today, e)
  const until = e && ended ? addDays(e, 1) : today
  const monthsCompleted = started ? Math.max(differenceInMonths(until, s), 0) : 0
  // Remaining: to the end of the contract, else to the end of the minimum service.
  const remainingTo = e ? addDays(e, 1) : min ? addMonths(s, min) : null
  const daysDone = started ? Math.max(differenceInCalendarDays(until, s), 0) : 0
  const daysTotal = e ? differenceInCalendarDays(addDays(e, 1), s) : min ? differenceInCalendarDays(addMonths(s, min), s) : 0
  return {
    durationMonths,
    targetMonths,
    monthsCompleted: targetMonths ? Math.min(monthsCompleted, targetMonths) : monthsCompleted,
    percent: daysTotal > 0 ? Math.min(100, Math.round((daysDone / daysTotal) * 100)) : 0,
    completedText: started ? spanText(s, until) : 'Not started',
    remainingText: remainingTo ? (isAfter(remainingTo, today) ? spanText(started ? today : s, remainingTo) : 'Completed') : '—',
    started,
    ended,
    minServiceMet: !min || (started && differenceInMonths(today, s) >= min),
  }
}
