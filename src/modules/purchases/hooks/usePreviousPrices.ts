import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface PreviousPrice {
  supplierPrice: number | null
  supplierUnit: string | null
  supplierDate: string | null
  supplierQuantity: number | null
  anyPrice: number | null
  anyUnit: string | null
  anyDate: string | null
  anySupplier: string | null
}

/**
 * Last purchase price of each product — from the selected supplier and from
 * any supplier — at this restaurant. The purchase being edited is excluded so
 * an item doesn't show its own price as "previous".
 */
export function usePreviousPrices(restaurantId: string | null, supplierId: string | null, productIds: string[], excludePurchaseId?: string) {
  const ids = [...new Set(productIds.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['purchases', 'previous-prices', restaurantId, supplierId, ids, excludePurchaseId ?? null],
    enabled: !!restaurantId && !!supplierId && ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_previous_purchase_prices', {
        p_restaurant_id: restaurantId!,
        p_supplier_id: supplierId!,
        p_product_ids: ids,
        p_exclude_purchase_id: excludePurchaseId ?? null,
      })
      if (error) throw error
      return new Map<string, PreviousPrice>(
        (data ?? []).map((r) => [
          r.product_id,
          {
            supplierPrice: r.supplier_price,
            supplierUnit: r.supplier_unit_code,
            supplierDate: r.supplier_date,
            supplierQuantity: r.supplier_quantity,
            anyPrice: r.any_price,
            anyUnit: r.any_unit_code,
            anyDate: r.any_date,
            anySupplier: r.any_supplier_name,
          },
        ]),
      )
    },
  })
}
