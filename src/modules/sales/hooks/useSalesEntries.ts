import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useSalesEntriesQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['sales-entries', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('sales_entries')
        .select('id, business_date, shift, gross_sales, net_sales, status, restaurant_id, restaurants(name)', {
          count: 'exact',
        })
        .order('business_date', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useSalesEntryQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['sales-entries', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: entry, error } = await supabase.from('sales_entries').select('*').eq('id', id!).single()
      if (error) throw error

      const { data: breakdowns, error: breakdownsError } = await supabase
        .from('sales_payment_breakdowns')
        .select('*, payment_methods(name), sales_channels(name)')
        .eq('sales_entry_id', id!)
      if (breakdownsError) throw breakdownsError

      return { entry, breakdowns }
    },
  })
}

export function useSalesLookupsQuery() {
  return useQuery({
    queryKey: ['sales', 'lookups'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [{ data: channels, error: channelsError }, { data: methods, error: methodsError }] = await Promise.all([
        supabase.from('sales_channels').select('id, code, name').eq('is_active', true).order('name'),
        supabase.from('payment_methods').select('id, code, name').eq('is_active', true).order('name'),
      ])
      if (channelsError) throw channelsError
      if (methodsError) throw methodsError
      return { channels: channels ?? [], methods: methods ?? [] }
    },
  })
}

export { PAGE_SIZE as SALES_PAGE_SIZE }
