import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function usePnlReportQuery(restaurantId: string | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['pnl-report', restaurantId, periodStart, periodEnd],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pnl_report', {
        p_restaurant_id: restaurantId!,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      })
      if (error) throw error
      return data[0]
    },
  })
}
