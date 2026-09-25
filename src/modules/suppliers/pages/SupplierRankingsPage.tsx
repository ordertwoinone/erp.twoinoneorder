import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { SUPPLIER_TYPE_OPTIONS } from '@/schemas/supplier'
import { SupplierPerformancePanel } from '@/modules/dashboard/components/SupplierPerformancePanel'
import { PeriodSelector } from '@/modules/dashboard/components/PeriodSelector'
import { usePeriodScope } from '@/modules/dashboard/hooks/usePeriodScope'
import { useSupplierPerformanceQuery, type DashboardScope } from '@/modules/dashboard/hooks/useDashboardData'

export default function SupplierRankingsPage() {
  const { selectedRestaurantId } = useRestaurantScope()
  const period = usePeriodScope()
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const scope = useMemo<DashboardScope>(
    () => ({
      restaurantIds: selectedRestaurantId ? [selectedRestaurantId] : null,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    }),
    [selectedRestaurantId, period.periodStart, period.periodEnd],
  )

  const { data: allSuppliers, isLoading } = useSupplierPerformanceQuery(scope)
  const suppliers = typeFilter ? allSuppliers?.filter((s) => s.supplier_type === typeFilter) : allSuppliers

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Rankings"
        description="Purchase volume and price reliability, ranked from approved purchase totals for the selected period."
        actions={<PeriodSelector period={period} />}
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={typeFilter === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setTypeFilter(null)}>
          All types
        </Badge>
        {SUPPLIER_TYPE_OPTIONS.map((t) => (
          <Badge
            key={t}
            variant={typeFilter === t ? 'default' : 'outline'}
            className="cursor-pointer capitalize"
            onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
          >
            {t}
          </Badge>
        ))}
      </div>

      <SupplierPerformancePanel
        suppliers={suppliers}
        isLoading={isLoading}
        periodStart={period.periodStart}
        periodEnd={period.periodEnd}
      />

      <p className="text-xs text-muted-foreground">
        Price reliability compares each invoice line against the supplier's agreed price at the time it was entered.
        Click any supplier to open the invoices behind its numbers.
      </p>
    </div>
  )
}
