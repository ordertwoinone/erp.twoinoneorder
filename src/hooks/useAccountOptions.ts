import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useBankAccountsOptions(restaurantId: string | null) {
  return useQuery({
    queryKey: ['accounts', 'bank', restaurantId],
    queryFn: async () => {
      let query = supabase.from('bank_accounts').select('id, bank_name, account_name').eq('is_active', true)
      if (restaurantId) query = query.or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
      const { data, error } = await query.order('bank_name')
      if (error) throw error
      return data
    },
  })
}

export function useCashAccountsOptions(restaurantId: string | null) {
  return useQuery({
    queryKey: ['accounts', 'cash', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_accounts')
        .select('id, name')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useExpenseCategoriesOptions() {
  return useQuery({
    queryKey: ['expense-categories'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}
