import { useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { PeriodSelector } from '../components/PeriodSelector'
import { PipelineStrip } from '../components/PipelineStrip'
import { KpiCards } from '../components/KpiCards'
import { ExceptionQueue } from '../components/ExceptionQueue'
import { SupplierPerformancePanel } from '../components/SupplierPerformancePanel'
import { AccountingOverview } from '../components/AccountingOverview'
import { usePeriodScope } from '../hooks/usePeriodScope'
import {
  usePipelineCountsQuery,
  useDashboardKpisQuery,
  useDashboardExceptionsQuery,
  useSupplierPerformanceQuery,
  useAccountingOverviewQuery,
  type DashboardScope,
} from '../hooks/useDashboardData'

export default function DashboardPage() {
  const { appContext } = useAuth()
  const { selectedRestaurantId, canSwitchRestaurants } = useRestaurantScope()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const period = usePeriodScope()

  const scope = useMemo<DashboardScope>(
    () => ({
      restaurantIds: selectedRestaurantId ? [selectedRestaurantId] : null,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    }),
    [selectedRestaurantId, period.periodStart, period.periodEnd],
  )

  const pipeline = usePipelineCountsQuery(scope)
  const kpis = useDashboardKpisQuery(scope)
  const exceptions = useDashboardExceptionsQuery(scope)
  const supplierPerformance = useSupplierPerformanceQuery(scope)
  const accountingOverview = useAccountingOverviewQuery(scope)

  const scopedRestaurants = selectedRestaurantId
    ? restaurants.filter((r) => r.id === selectedRestaurantId)
    : restaurants

  return (
    <div className="space-y-6">
      <PageHeader
        title={canSwitchRestaurants && !selectedRestaurantId ? 'Group Operations' : 'Dashboard'}
        description={
          canSwitchRestaurants && !selectedRestaurantId
            ? `${restaurants.length} restaurants · consolidated view`
            : `Welcome back, ${appContext?.fullName ?? ''}`
        }
        actions={<PeriodSelector period={period} />}
      />

      <PipelineStrip counts={pipeline.data} isLoading={pipeline.isLoading} />

      <KpiCards kpis={kpis.data} isLoading={kpis.isLoading} />

      <ExceptionQueue exceptions={exceptions.data} isLoading={exceptions.isLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SupplierPerformancePanel
          suppliers={supplierPerformance.data}
          isLoading={supplierPerformance.isLoading}
          periodStart={period.periodStart}
          periodEnd={period.periodEnd}
        />
        <AccountingOverview
          overview={accountingOverview.data}
          isLoading={accountingOverview.isLoading}
          restaurants={scopedRestaurants}
          periodStart={period.periodStart}
          periodEnd={period.periodEnd}
        />
      </div>
    </div>
  )
}
