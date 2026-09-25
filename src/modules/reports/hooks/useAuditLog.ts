import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 30

export interface AuditLogFilters {
  module: string | 'all'
  search: string
  pageIndex: number
}

export function useAuditLogQuery(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      const from = filters.pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('audit_logs')
        .select('id, action, module, entity_type, entity_id, old_value, new_value, created_at, profiles(full_name)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.module !== 'all') query = query.eq('module', filters.module)
      if (filters.search.trim()) {
        query = query.or(`action.ilike.%${filters.search.trim()}%,entity_type.ilike.%${filters.search.trim()}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useAuditLogModulesQuery() {
  return useQuery({
    queryKey: ['audit-log', 'modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('module').limit(1000)
      if (error) throw error
      return Array.from(new Set(data.map((r) => r.module))).sort()
    },
  })
}

export { PAGE_SIZE as AUDIT_LOG_PAGE_SIZE }
