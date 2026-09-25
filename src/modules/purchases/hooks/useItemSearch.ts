import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface ItemSearchResult {
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  brand_name: string | null
  category_name: string | null
  base_unit_id: string
  base_unit_code: string
  pack_size: number | null
  pack_unit_code: string | null
  agreed_price: number | null
  last_purchase_price: number | null
  last_purchase_date: string | null
}

export function useItemSearchQuery(supplierId: string | null, restaurantId: string | null, search: string) {
  return useQuery({
    queryKey: ['item-search', supplierId, restaurantId, search],
    enabled: !!supplierId && !!restaurantId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ItemSearchResult[]> => {
      const { data, error } = await supabase.rpc('search_items_for_purchase', {
        p_supplier_id: supplierId!,
        p_restaurant_id: restaurantId!,
        p_search: search || null,
        p_limit: 15,
      })
      if (error) throw error
      return data ?? []
    },
  })
}
