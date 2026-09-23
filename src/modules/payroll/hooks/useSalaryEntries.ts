import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useSalaryEntriesQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['salary-entries', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('salary_entries')
        .select('id, period_month, net_salary, status, payment_status, restaurant_id, employees(full_name)', {
          count: 'exact',
        })
        .order('period_month', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useSalaryEntryQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['salary-entries', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: entry, error } = await supabase
        .from('salary_entries')
        .select('*, employees(full_name, employee_code), restaurants(name)')
        .eq('id', id!)
        .single()
      if (error) throw error

      const { data: payments, error: paymentsError } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('salary_entry_id', id!)
        .order('payment_date', { ascending: false })
      if (paymentsError) throw paymentsError

      return { entry, payments }
    },
  })
}

export function useEmployeesOptions() {
  return useQuery({
    queryKey: ['employees', 'options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, employee_code, current_restaurant_id, base_salary')
        .eq('employment_status', 'active')
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

export { PAGE_SIZE as PAYROLL_PAGE_SIZE }
