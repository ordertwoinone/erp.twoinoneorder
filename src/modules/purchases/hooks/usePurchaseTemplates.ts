import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface TemplateSource {
  kind: 'purchase' | 'order'
  id: string
  label: string
  date: string
  status: string
}

export interface TemplateLine {
  product_id: string
  unit_id: string
  unit_code: string | null
  quantity: number
  unit_price: number
  pack_size: number | null
  product_name: string
  brand_name: string | null
  category_name: string | null
}

/** Previous invoices from this supplier + purchase orders placed with them, for this restaurant. */
export function usePurchaseTemplatesQuery(supplierId: string | null, restaurantId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['purchase-templates', supplierId, restaurantId],
    enabled: enabled && !!supplierId && !!restaurantId,
    queryFn: async (): Promise<TemplateSource[]> => {
      const [purchasesRes, ordersRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, invoice_number, invoice_date, status')
          .eq('supplier_id', supplierId!)
          .eq('restaurant_id', restaurantId!)
          .neq('status', 'cancelled')
          .order('invoice_date', { ascending: false })
          .limit(10),
        supabase
          .from('purchase_orders')
          .select('id, order_number, order_date, status')
          .eq('supplier_id', supplierId!)
          .eq('restaurant_id', restaurantId!)
          .neq('status', 'cancelled')
          .order('order_date', { ascending: false })
          .limit(10),
      ])
      if (purchasesRes.error) throw purchasesRes.error
      if (ordersRes.error) throw ordersRes.error
      return [
        ...ordersRes.data.map((o) => ({ kind: 'order' as const, id: o.id, label: o.order_number, date: o.order_date, status: o.status })),
        ...purchasesRes.data.map((p) => ({ kind: 'purchase' as const, id: p.id, label: p.invoice_number, date: p.invoice_date, status: p.status })),
      ]
    },
  })
}

export async function fetchTemplateLines(source: TemplateSource): Promise<TemplateLine[]> {
  const select = 'product_id, unit_id, quantity, unit_price, pack_size, units(code), products(name, brands(name), categories(name))'
  const { data, error } =
    source.kind === 'purchase'
      ? await supabase.from('purchase_items').select(select).eq('purchase_id', source.id)
      : await supabase.from('purchase_order_items').select(select).eq('purchase_order_id', source.id)
  if (error) throw error
  return data.map((row) => ({
    product_id: row.product_id,
    unit_id: row.unit_id,
    unit_code: row.units?.code ?? null,
    quantity: row.quantity,
    unit_price: row.unit_price,
    pack_size: row.pack_size,
    product_name: row.products?.name ?? 'Item',
    brand_name: row.products?.brands?.name ?? null,
    category_name: row.products?.categories?.name ?? null,
  }))
}
