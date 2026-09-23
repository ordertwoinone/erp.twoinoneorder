import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useAccountingAccountsQuery() {
  return useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounting_accounts').select('*').order('code')
      if (error) throw error
      return data
    },
  })
}

export function useJournalEntriesQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['journal-entries', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let query = supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, source_type, description, status', { count: 'exact' })
        .order('entry_date', { ascending: false })
        .range(from, to)
      if (restaurantId) query = query.eq('restaurant_id', restaurantId)
      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useJournalEntryLinesQuery(journalEntryId: string | undefined) {
  return useQuery({
    queryKey: ['journal-lines', journalEntryId],
    enabled: !!journalEntryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_lines')
        .select('*, accounting_accounts(code, name)')
        .eq('journal_entry_id', journalEntryId!)
      if (error) throw error
      return data
    },
  })
}

export function useAccountingPeriodsQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: ['accounting-periods', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('period_month', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSetAccountingPeriodStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { restaurantId: string; periodMonth: string; status: 'open' | 'locked' }) => {
      const { error } = await supabase.rpc('set_accounting_period_status', {
        p_restaurant_id: input.restaurantId,
        p_period_month: input.periodMonth,
        p_status: input.status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] })
      toast.success('Accounting period updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update period', { description: error.message })
    },
  })
}

export { PAGE_SIZE as JOURNAL_PAGE_SIZE }
