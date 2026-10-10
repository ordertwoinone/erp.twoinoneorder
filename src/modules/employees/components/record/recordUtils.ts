import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

/** Form number fields hold '' when blank. */
export const num = (v: unknown) => (v === '' || v === undefined || v === null ? 0 : Number(v) || 0)

export function daysUntil(date: string | null | undefined): number | null {
  const parsed = date ? parseISO(date) : null
  return parsed && isValid(parsed) ? differenceInCalendarDays(parsed, new Date()) : null
}

export function shortDate(value: string | null | undefined, pattern = 'd MMM yyyy') {
  const d = value ? parseISO(value) : null
  return d && isValid(d) ? format(d, pattern) : '—'
}

export type CountdownTone = 'ok' | 'soon' | 'expired' | 'today' | 'na' | 'none'

/** Same buckets as the design's countdown legend: >30 days, ≤30 days, today, expired, N/A. */
export function countdown(expiry: string | null | undefined, notApplicable = false): { tone: CountdownTone; label: string } {
  if (notApplicable) return { tone: 'na', label: 'N/A' }
  const days = daysUntil(expiry)
  if (days === null) return { tone: 'none', label: '—' }
  if (days < 0) return { tone: 'expired', label: `Expired ${Math.abs(days)}d ago` }
  if (days === 0) return { tone: 'today', label: 'Expires today' }
  return { tone: days <= 30 ? 'soon' : 'ok', label: `${days} day${days === 1 ? '' : 's'} left` }
}

export const TONE_CLASSES: Record<CountdownTone, string> = {
  ok: 'border-success/30 bg-success/10 text-success',
  soon: 'border-warning/40 bg-warning/15 text-warning-foreground',
  expired: 'border-destructive/30 bg-destructive/10 text-destructive',
  today: 'border-primary/30 bg-primary/10 text-primary',
  na: 'border-border bg-muted/60 text-muted-foreground',
  none: 'border-transparent text-muted-foreground',
}

export const newId = () => crypto.randomUUID()

/**
 * What a typing-centre step counts as paid: its full amount when a company
 * category is picked and marked "Paid: Yes", otherwise the payments recorded
 * against it. Shared by the step table and the printout.
 */
export function stepPaid(
  step: { government_fee?: unknown; other_charges?: unknown; company_category_id?: string | null; category_paid?: boolean | null },
  ledgerPaid: number,
) {
  return step.company_category_id && step.category_paid ? num(step.government_fee) + num(step.other_charges) : ledgerPaid
}

/** Orders basis: rate is AED per order. Sales bases: rate is a percentage of sales. */
export function computeIncentive(
  row: { eligible_sales?: unknown; orders_count?: unknown; incentive_rate?: unknown },
  basis: string | undefined,
): number {
  const rate = num(row.incentive_rate)
  if (!rate) return 0
  const amount = basis === 'orders' ? num(row.orders_count) * rate : (num(row.eligible_sales) * rate) / 100
  return Math.round(amount * 100) / 100
}
