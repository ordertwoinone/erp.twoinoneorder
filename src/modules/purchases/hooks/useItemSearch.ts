import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface ItemSearchResult {
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  brand_name: string | null
  category_id: string | null
  category_name: string | null
  base_unit_id: string
  base_unit_code: string
  pack_size: number | null
  pack_unit_code: string | null
  agreed_price: number | null
  last_purchase_price: number | null
  last_purchase_date: string | null
}

export function useItemSearchQuery(
  supplierId: string | null,
  restaurantId: string | null,
  search: string,
  categoryId: string | null,
) {
  return useQuery({
    queryKey: ['item-search', supplierId, restaurantId, search, categoryId],
    enabled: !!supplierId && !!restaurantId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ItemSearchResult[]> => {
      const { data, error } = await supabase.rpc('search_items_for_purchase', {
        p_supplier_id: supplierId!,
        p_restaurant_id: restaurantId!,
        p_search: search || null,
        p_limit: 20,
        p_category_id: categoryId,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Current agreed (contract) prices for a supplier, keyed "productId|unitId".
 * Used to show the contract price on lines that didn't come from item search
 * (manual rows, imported templates, unit changes). The authoritative
 * price-at-entry is still captured server-side on save.
 */
export async function fetchAgreedPrices(supplierId: string, productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!supplierId || productIds.length === 0) return map
  const { data, error } = await supabase
    .from('supplier_price_locks')
    .select('product_id, unit_id, agreed_price')
    .eq('supplier_id', supplierId)
    .eq('is_current', true)
    .in('product_id', productIds)
  if (error) throw error
  for (const row of data) map.set(`${row.product_id}|${row.unit_id}`, row.agreed_price)
  return map
}
