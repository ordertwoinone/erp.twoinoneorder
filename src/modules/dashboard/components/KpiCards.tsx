import { AlertTriangle, ArrowDownRight, ArrowUpRight, CreditCard, ShoppingCart, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { Database } from '@/types/database'

type Kpis = Database['public']['Functions']['get_dashboard_kpis']['Returns'][number]

function deltaPct(current: number, prior: number) {
  if (!prior) return current > 0 ? null : 0
  return ((current - prior) / prior) * 100
}

function Delta({ pct, badWhenPositive }: { pct: number | null; badWhenPositive: boolean }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">No prior-period data</span>
  const isPositive = pct >= 0
  const isGood = badWhenPositive ? !isPositive : isPositive
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isGood ? 'text-success-foreground' : 'text-destructive')}>
      <Icon className="size-3.5" />
      {Math.abs(pct).toFixed(0)}% vs last period
    </span>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  pct,
  badWhenPositive = false,
  isLoading,
}: {
  icon: LucideIcon
  label: string
  value: string
  pct: number | null
  badWhenPositive?: boolean
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        )}
        <div className="mt-1">{isLoading ? <Skeleton className="h-4 w-24" /> : <Delta pct={pct} badWhenPositive={badWhenPositive} />}</div>
      </CardContent>
    </Card>
  )
}

export function KpiCards({ kpis, isLoading }: { kpis: Kpis | null | undefined; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={ShoppingCart}
        label="Purchases"
        value={formatCurrency(kpis?.purchases_total)}
        pct={kpis ? deltaPct(kpis.purchases_total, kpis.purchases_prior) : null}
        isLoading={isLoading}
      />
      <KpiCard
        icon={TrendingUp}
        label="Sales"
        value={formatCurrency(kpis?.sales_total)}
        pct={kpis ? deltaPct(kpis.sales_total, kpis.sales_prior) : null}
        isLoading={isLoading}
      />
      <KpiCard
        icon={CreditCard}
        label="Payables"
        value={formatCurrency(kpis?.payables_total)}
        pct={kpis ? deltaPct(kpis.payables_total, kpis.payables_prior) : null}
        badWhenPositive
        isLoading={isLoading}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Exceptions"
        value={kpis ? String(kpis.exceptions_count) : '—'}
        pct={kpis ? deltaPct(kpis.exceptions_count, kpis.exceptions_prior_count) : null}
        badWhenPositive
        isLoading={isLoading}
      />
    </div>
  )
}
