import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'

export interface DashboardScope {
  /** null = every restaurant the current user can access. */
  restaurantIds: string[] | null
  periodStart: string
  periodEnd: string
}

function scopeKeyParts(scope: DashboardScope) {
  return [scope.restaurantIds ? [...scope.restaurantIds].sort().join(',') : 'all', scope.periodStart, scope.periodEnd]
}

export function usePipelineCountsQuery(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'pipeline', ...scopeKeyParts(scope)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_pipeline_counts', {
        p_restaurant_ids: scope.restaurantIds,
        p_period_start: scope.periodStart,
        p_period_end: scope.periodEnd,
      })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

export function useDashboardKpisQuery(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', ...scopeKeyParts(scope)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_kpis', {
        p_restaurant_ids: scope.restaurantIds,
        p_period_start: scope.periodStart,
        p_period_end: scope.periodEnd,
      })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

export function useDashboardExceptionsQuery(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'exceptions', ...scopeKeyParts(scope)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_exceptions', {
        p_restaurant_ids: scope.restaurantIds,
        p_period_start: scope.periodStart,
        p_period_end: scope.periodEnd,
        p_limit: 50,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSupplierPerformanceQuery(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'supplier-performance', ...scopeKeyParts(scope)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_supplier_performance', {
        p_restaurant_ids: scope.restaurantIds,
        p_period_start: scope.periodStart,
        p_period_end: scope.periodEnd,
        p_limit: 20,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export interface BranchPnl {
  restaurantId: string
  restaurantName: string
  netProfit: number | null
  isProvisional: boolean
}

/**
 * get_pnl_report is per-restaurant (spec §33: never derive a group P&L by
 * summing provisional branch figures), so the branch chart fans it out
 * across the restaurants in scope rather than adding a group-level RPC.
 */
export function useBranchPnlQuery(restaurants: RestaurantOption[], periodStart: string, periodEnd: string) {
  const results = useQueries({
    queries: restaurants.map((restaurant) => ({
      queryKey: ['dashboard', 'branch-pnl', restaurant.id, periodStart, periodEnd],
      queryFn: async (): Promise<BranchPnl> => {
        const { data, error } = await supabase.rpc('get_pnl_report', {
          p_restaurant_id: restaurant.id,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        })
        if (error) throw error
        const row = data?.[0]
        return {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          netProfit: row?.net_profit ?? null,
          isProvisional: row?.is_provisional ?? true,
        }
      },
    })),
  })

  return {
    data: results.map((r) => r.data).filter((d): d is BranchPnl => !!d),
    isLoading: results.some((r) => r.isLoading),
  }
}

export function useAccountingOverviewQuery(scope: DashboardScope) {
  return useQuery({
    queryKey: ['dashboard', 'accounting-overview', ...scopeKeyParts(scope)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_accounting_overview', {
        p_restaurant_ids: scope.restaurantIds,
        p_period_start: scope.periodStart,
        p_period_end: scope.periodEnd,
      })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}
