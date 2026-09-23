import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useEmployeesQuery({ search, pageIndex }: { search: string; pageIndex: number }) {
  return useQuery({
    queryKey: ['employees', { search, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('employees')
        .select('id, employee_code, full_name, job_title, employment_status, current_restaurant_id, restaurants(name)', {
          count: 'exact',
        })
        .order('full_name')
        .range(from, to)

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search.trim()}%,employee_code.ilike.%${search.trim()}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useEmployeeQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export { PAGE_SIZE as EMPLOYEES_PAGE_SIZE }
