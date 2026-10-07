import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface ExpenseHead {
  id: string
  name: string
  description: string | null
  is_head_office_only: boolean
  is_active: boolean
  restaurant_id: string | null
  ledger_account_id: string | null
  restaurants: { name: string } | null
  accounting_accounts: { code: string; name: string } | null
}

export interface ExpenseHeadInput {
  id?: string
  name: string
  description: string
  restaurant_id: string | null
  ledger_account_id: string | null
  is_head_office_only: boolean
  is_active: boolean
}

export interface Ledger {
  id: string
  code: string
  name: string
  account_type: string
  restaurant_id: string | null
  restaurant_name: string | null
  is_active: boolean
  description: string | null
}

/** Every head the user can see (shared + their restaurants'), including inactive ones. */
export function useExpenseHeadsQuery() {
  return useQuery({
    queryKey: ['expense-heads'],
    queryFn: async (): Promise<ExpenseHead[]> => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select(
          'id, name, description, is_head_office_only, is_active, restaurant_id, ledger_account_id, restaurants(name), accounting_accounts!expense_categories_ledger_account_id_fkey(code, name)',
        )
        .order('name')
      if (error) throw error
      return data as unknown as ExpenseHead[]
    },
  })
}

/**
 * Ledgers for a restaurant: shared ledgers plus that restaurant's own. With no
 * restaurant: shared plus every restaurant the user can access.
 */
export function useLedgers(restaurantId: string | null) {
  return useQuery({
    queryKey: ['ledgers', restaurantId],
    queryFn: async (): Promise<Ledger[]> => {
      const { data, error } = await supabase.rpc('list_ledgers', { p_restaurant_id: restaurantId })
      if (error) throw error
      return data ?? []
    },
  })
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['expense-heads'] })
  // The expense form's head dropdown.
  queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
}

export function useSaveExpenseHead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ExpenseHeadInput) => {
      const { data, error } = await supabase.rpc('save_expense_head', {
        payload: {
          id: input.id ?? null,
          name: input.name,
          description: input.description,
          restaurant_id: input.restaurant_id,
          ledger_account_id: input.ledger_account_id,
          is_head_office_only: input.is_head_office_only,
          is_active: input.is_active,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_id, input) => {
      invalidate(queryClient)
      toast.success(input.id ? 'Expense head updated' : 'Expense head added')
    },
    onError: (error: Error) => toast.error('Unable to save expense head', { description: error.message }),
  })
}

export function useDeleteExpenseHead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_expense_head', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate(queryClient)
      toast.success('Expense head deleted')
    },
    onError: (error: Error) => toast.error('Unable to delete expense head', { description: error.message }),
  })
}

export function useCreateLedger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; restaurantId: string | null; code?: string; description?: string }) => {
      const { data, error } = await supabase.rpc('create_ledger', {
        p_name: input.name,
        p_restaurant_id: input.restaurantId,
        p_account_type: 'expense',
        p_code: input.code || null,
        p_description: input.description || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] })
      toast.success('Ledger added')
    },
    onError: (error: Error) => toast.error('Unable to add ledger', { description: error.message }),
  })
}
