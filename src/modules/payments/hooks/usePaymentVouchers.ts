import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function usePaymentVouchersQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['payment-vouchers', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('payment_vouchers')
        .select('id, voucher_number, payee_type, amount, status, voucher_date, restaurant_id, suppliers(name)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function usePaymentVoucherQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['payment-vouchers', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [voucherRes, itemsRes, approvalsRes] = await Promise.all([
        supabase.from('payment_vouchers').select('*, suppliers(name), restaurants(name)').eq('id', id!).single(),
        supabase.from('payment_voucher_items').select('*').eq('payment_voucher_id', id!),
        supabase
          .from('approvals')
          .select('*, profiles(full_name)')
          .eq('entity_type', 'payment_voucher')
          .eq('entity_id', id!)
          .order('created_at', { ascending: false }),
      ])
      if (voucherRes.error) throw voucherRes.error
      if (itemsRes.error) throw itemsRes.error
      if (approvalsRes.error) throw approvalsRes.error

      return { voucher: voucherRes.data, items: itemsRes.data, approvals: approvalsRes.data }
    },
  })
}

/** Unpaid/partially-paid posted purchases for a supplier, for allocating a payment against. */
export function useUnpaidPurchasesQuery(supplierId: string | undefined, restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['purchases', 'unpaid', supplierId, restaurantId],
    enabled: !!supplierId && !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchase_number, invoice_number, total_amount, paid_amount, payment_status')
        .eq('supplier_id', supplierId!)
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'posted')
        .in('payment_status', ['unpaid', 'partially_paid'])
        .order('invoice_date')
      if (error) throw error
      return data
    },
  })
}

export { PAGE_SIZE as PAYMENTS_PAGE_SIZE }
