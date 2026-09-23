import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

const PAGE_SIZE = 20

type PurchaseStatus = Database['public']['Tables']['purchases']['Row']['status']

export interface PurchaseFilters {
  search: string
  status: PurchaseStatus | 'all'
  restaurantId: string | null
  pageIndex: number
}

export function usePurchasesQuery(filters: PurchaseFilters) {
  return useQuery({
    queryKey: ['purchases', filters],
    queryFn: async () => {
      const from = filters.pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('purchases')
        .select(
          'id, purchase_number, invoice_number, invoice_date, status, payment_status, total_amount, restaurant_id, supplier_id, restaurants(name), suppliers(name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.restaurantId) query = query.eq('restaurant_id', filters.restaurantId)
      if (filters.search.trim()) {
        query = query.or(`invoice_number.ilike.%${filters.search.trim()}%,purchase_number.ilike.%${filters.search.trim()}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function usePurchaseQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['purchases', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [purchaseRes, itemsRes, approvalsRes] = await Promise.all([
        supabase.from('purchases').select('*, restaurants(name), suppliers(name)').eq('id', id!).single(),
        supabase.from('purchase_items').select('*, products(name, sku), units(name, code)').eq('purchase_id', id!),
        supabase
          .from('approvals')
          .select('*, profiles(full_name)')
          .eq('entity_type', 'purchase')
          .eq('entity_id', id!)
          .order('created_at', { ascending: false }),
      ])
      if (purchaseRes.error) throw purchaseRes.error
      if (itemsRes.error) throw itemsRes.error
      if (approvalsRes.error) throw approvalsRes.error

      return { purchase: purchaseRes.data, items: itemsRes.data, approvals: approvalsRes.data }
    },
  })
}

export { PAGE_SIZE as PURCHASES_PAGE_SIZE }
