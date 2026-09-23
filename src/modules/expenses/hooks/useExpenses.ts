import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useExpensesQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['expenses', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('operating_expenses')
        .select('id, expense_number, amount, expense_date, status, restaurant_id, expense_categories(name)', {
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

export function useExpenseQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: expense, error } = await supabase
        .from('operating_expenses')
        .select('*, expense_categories(name), restaurants(name)')
        .eq('id', id!)
        .single()
      if (error) throw error

      const { data: approvals, error: approvalsError } = await supabase
        .from('approvals')
        .select('*, profiles(full_name)')
        .eq('entity_type', 'operating_expense')
        .eq('entity_id', id!)
        .order('created_at', { ascending: false })
      if (approvalsError) throw approvalsError

      return { expense, approvals }
    },
  })
}

export { PAGE_SIZE as EXPENSES_PAGE_SIZE }
