import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export function usePriceLocksQuery(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-price-locks', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_price_locks')
        .select('*, products(name, sku), units(code, name)')
        .eq('supplier_id', supplierId!)
        .order('is_current', { ascending: false })
        .order('valid_from', { ascending: false })
      if (error) throw error

      const lockIds = data.map((l) => l.id)
      const { data: scopes, error: scopesError } =
        lockIds.length > 0
          ? await supabase
              .from('supplier_price_lock_restaurants')
              .select('price_lock_id, restaurants(name)')
              .in('price_lock_id', lockIds)
          : { data: [] as { price_lock_id: string; restaurants: { name: string } | null }[], error: null }
      if (scopesError) throw scopesError

      return data.map((lock) => ({
        ...lock,
        restaurantNames: scopes.filter((s) => s.price_lock_id === lock.id).map((s) => s.restaurants?.name ?? ''),
      }))
    },
  })
}

export function useSavePriceLock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      supplierId: string
      productId: string
      unitId: string
      packSize?: number
      agreedPrice: number
      restaurantIds: string[]
    }) => {
      const { error } = await supabase.rpc('save_price_lock', {
        payload: {
          supplier_id: input.supplierId,
          product_id: input.productId,
          unit_id: input.unitId,
          pack_size: input.packSize ?? null,
          agreed_price: input.agreedPrice,
          restaurant_ids: input.restaurantIds,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-price-locks'] })
      toast.success('Price lock saved')
    },
    onError: (error: Error) => {
      toast.error('Unable to save price lock', { description: error.message })
    },
  })
}

export function useQuickCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; baseUnitId: string; sku?: string; brandId?: string; barcode?: string }) => {
      const { data, error } = await supabase.rpc('quick_create_product', {
        p_name: input.name,
        p_base_unit_id: input.baseUnitId,
        p_sku: input.sku || null,
        p_brand_id: input.brandId || null,
        p_barcode: input.barcode || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] })
    },
    onError: (error: Error) => {
      toast.error('Unable to create product', { description: error.message })
    },
  })
}
