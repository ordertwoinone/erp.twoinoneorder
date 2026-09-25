import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { GoodsReceiptFormInput } from '@/schemas/goodsReceipt'

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

export function useGoodsReceiptQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['goods-receipts', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [receiptRes, itemsRes] = await Promise.all([
        supabase
          .from('goods_receipts')
          .select('*, restaurants(name), purchase_orders(order_number, suppliers(name))')
          .eq('id', id!)
          .single(),
        supabase.from('goods_receipt_items').select('*, products(name, sku), units(name, code)').eq('goods_receipt_id', id!),
      ])
      if (receiptRes.error) throw receiptRes.error
      if (itemsRes.error) throw itemsRes.error
      return { receipt: receiptRes.data, items: itemsRes.data }
    },
  })
}

/** Outstanding (not yet fully received) lines for a purchase order — used to pre-fill a new receipt. */
export function usePurchaseOrderOutstandingItemsQuery(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', 'outstanding-items', purchaseOrderId],
    enabled: !!purchaseOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*, products(name, sku), units(name, code)')
        .eq('purchase_order_id', purchaseOrderId!)
      if (error) throw error
      return data.filter((item) => item.quantity_received < item.quantity)
    },
  })
}

export function useSaveGoodsReceipt() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: GoodsReceiptFormInput) => {
      const payload = {
        restaurant_id: input.restaurant_id,
        purchase_order_id: input.purchase_order_id || null,
        received_date: input.received_date,
        notes: input.notes || null,
        items: input.items.map((item) => ({
          product_id: item.product_id,
          unit_id: item.unit_id,
          quantity_received: item.quantity_received,
          quantity_shortage: item.quantity_shortage,
          notes: item.notes || null,
        })),
      }
      const { data, error } = await supabase.rpc('save_goods_receipt', { payload: payload as never })
      if (error) throw error
      return data as string
    },
    onSuccess: (receiptId) => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Goods receipt recorded')
      navigate(`/purchases/receipts/${receiptId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to record goods receipt', { description: error.message })
    },
  })
}

export { PAGE_SIZE as GOODS_RECEIPTS_PAGE_SIZE }
