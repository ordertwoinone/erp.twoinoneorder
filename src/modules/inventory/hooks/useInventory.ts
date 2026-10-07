import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useStockBalancesQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: ['stock-balances', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_balances')
        .select('*, products(name, sku)')
        .eq('restaurant_id', restaurantId!)
        .order('quantity_on_hand', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
