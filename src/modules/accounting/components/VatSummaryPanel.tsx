import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import { PeriodSelector } from '@/modules/dashboard/components/PeriodSelector'
import { usePeriodScope } from '@/modules/dashboard/hooks/usePeriodScope'
import { useVatSummaryQuery } from '../hooks/useBankReconciliation'

export function VatSummaryPanel({ restaurantId }: { restaurantId: string | null }) {
  const period = usePeriodScope()
  const { data: vat, isLoading } = useVatSummaryQuery(restaurantId ? [restaurantId] : null, period.periodStart, period.periodEnd)

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">UAE VAT at 5% — output VAT collected on sales minus input VAT paid on posted purchases.</p>
        <PeriodSelector period={period} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">VAT return summary — {period.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading || !vat ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Output VAT (on sales)</span>
                <span className="tabular-nums">{formatCurrency(vat.output_vat)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Input VAT (on purchases)</span>
                <span className="tabular-nums">− {formatCurrency(vat.input_vat)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <span>Net payable to FTA</span>
                <span className="tabular-nums">{formatCurrency(vat.net_payable)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
