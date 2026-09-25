import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { PurchaseOrderFormInput } from '@/schemas/purchaseOrder'

const PAGE_SIZE = 20

export function usePurchaseOrdersQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['purchase-orders', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('purchase_orders')
        .select('id, order_number, status, order_date, expected_date, restaurant_id, supplier_id, restaurants(name), suppliers(name)', {
          count: 'exact',
        })
        .order('order_date', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function usePurchaseOrderQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, restaurants(name), suppliers(name)').eq('id', id!).single(),
        supabase.from('purchase_order_items').select('*, products(name, sku), units(name, code)').eq('purchase_order_id', id!),
      ])
      if (orderRes.error) throw orderRes.error
      if (itemsRes.error) throw itemsRes.error
      return { order: orderRes.data, items: itemsRes.data }
    },
  })
}

/** Orders that can still receive a goods receipt against them. */
export function useOpenPurchaseOrdersQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: ['purchase-orders', 'open', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, order_number, supplier_id, suppliers(name)')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['ordered', 'partially_received'])
        .order('order_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function buildPayload(input: PurchaseOrderFormInput) {
  return {
    id: input.id ?? null,
    restaurant_id: input.restaurant_id,
    supplier_id: input.supplier_id,
    purchase_request_id: input.purchase_request_id || null,
    order_date: input.order_date,
    expected_date: input.expected_date || null,
    notes: input.notes || null,
    items: input.items.map((item) => ({
      product_id: item.product_id,
      unit_id: item.unit_id,
      pack_size: item.pack_size === '' ? null : item.pack_size,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  }
}

export function useSavePurchaseOrder() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: PurchaseOrderFormInput) => {
      const { data, error } = await supabase.rpc('save_purchase_order', { payload: buildPayload(input) as never })
      if (error) throw error
      return data as string
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order saved as draft')
      navigate(`/purchases/orders/${orderId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase order', { description: error.message })
    },
  })
}

export function usePlacePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('place_purchase_order', { p_order_id: orderId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Order placed with supplier')
    },
    onError: (error: Error) => {
      toast.error('Unable to place order', { description: error.message })
    },
  })
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('cancel_purchase_order', { p_order_id: orderId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order cancelled')
    },
    onError: (error: Error) => {
      toast.error('Unable to cancel order', { description: error.message })
    },
  })
}

export { PAGE_SIZE as PURCHASE_ORDERS_PAGE_SIZE }
