import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useGoodsReceiptsQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['goods-receipts', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('goods_receipts')
        .select(
          'id, receipt_number, status, received_date, restaurant_id, purchase_order_id, purchase_id, restaurants(name), purchase_orders(order_number), purchases(invoice_number)',
          { count: 'exact' },
        )
        .order('received_date', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export { PAGE_SIZE as GOODS_RECEIPTS_PAGE_SIZE }
