import { Link } from 'react-router-dom'
import { Landmark, Percent, CreditCard as CardIcon, LineChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import type { BranchPnl } from '../hooks/useDashboardData'
import { useBranchPnlQuery } from '../hooks/useDashboardData'
import { BranchPnlChart } from './BranchPnlChart'
import type { Database } from '@/types/database'

type Overview = Database['public']['Functions']['get_dashboard_accounting_overview']['Returns'][number]

function Tile({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Landmark
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      {children}
    </div>
  )
}

export function AccountingOverview({
  overview,
  isLoading,
  restaurants,
  periodStart,
  periodEnd,
}: {
  overview: Overview | null | undefined
  isLoading: boolean
  restaurants: RestaurantOption[]
  periodStart: string
  periodEnd: string
}) {
  const branchPnl = useBranchPnlQuery(restaurants, periodStart, periodEnd)
  const reconciledPct =
    overview?.bank_total_count && overview.bank_total_count > 0
      ? Math.round(((overview.bank_reconciled_count ?? 0) / overview.bank_total_count) * 100)
      : null
  const vatPayable = overview?.vat_payable ?? null
  const unsettledCardAmount = overview?.unsettled_card_amount ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tile icon={Landmark} label="Bank reconciliation">
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : reconciledPct === null ? (
              <p className="text-sm text-muted-foreground">
                {overview?.bank_total_count === null ? 'No access' : 'No reconciliations this period'}
              </p>
            ) : (
              <>
                <div className="mb-1.5 text-xl font-semibold">{reconciledPct}%</div>
                <Progress value={reconciledPct} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {overview?.bank_reconciled_count} of {overview?.bank_total_count} accounts reconciled
                </p>
              </>
            )}
          </Tile>

          <Tile icon={Percent} label="VAT payable">
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : vatPayable === null ? (
              <p className="text-sm text-muted-foreground">No access</p>
            ) : (
              <>
                <div className="text-xl font-semibold tabular-nums">{formatCurrency(vatPayable)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Output VAT − input VAT, this period</p>
              </>
            )}
          </Tile>

          <Tile icon={CardIcon} label="Unsettled card machine">
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : unsettledCardAmount === null ? (
              <p className="text-sm text-muted-foreground">No access</p>
            ) : (
              <>
                <div className="text-xl font-semibold tabular-nums">{formatCurrency(unsettledCardAmount)}</div>
                <Link to="/settlements" className="mt-1 inline-block text-xs text-primary hover:underline">
                  View settlements →
                </Link>
              </>
            )}
          </Tile>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <LineChart className="size-4 text-muted-foreground" />
            Branch P&amp;L
          </div>
          <BranchPnlChart branches={branchPnl.data as BranchPnl[]} isLoading={branchPnl.isLoading} />
        </div>
      </CardContent>
    </Card>
  )
}
