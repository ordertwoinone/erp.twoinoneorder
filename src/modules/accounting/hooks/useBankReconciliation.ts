import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export function useBankAccountsQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: ['bank-accounts', restaurantId],
    queryFn: async () => {
      let query = supabase
        .from('bank_accounts')
        .select('id, bank_name, account_name, account_number, currency, restaurant_id, restaurants(name)')
        .eq('is_active', true)
        .order('bank_name')
      if (restaurantId) query = query.eq('restaurant_id', restaurantId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useBankReconciliationsQuery(bankAccountId: string | undefined) {
  return useQuery({
    queryKey: ['bank-reconciliations', bankAccountId],
    enabled: !!bankAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('bank_account_id', bankAccountId!)
        .order('period_end', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Ledger closing balance = running sum of bank_transactions up to a date (no opening-balance concept in this schema). */
export function useLedgerBalanceQuery(bankAccountId: string | undefined, asOfDate: string) {
  return useQuery({
    queryKey: ['bank-ledger-balance', bankAccountId, asOfDate],
    enabled: !!bankAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('direction, amount')
        .eq('bank_account_id', bankAccountId!)
        .lte('transaction_date', asOfDate)
      if (error) throw error
      return data.reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0)
    },
  })
}

export function useCreateBankReconciliation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      bankAccountId: string
      periodStart: string
      periodEnd: string
      statementClosingBalance: number
      ledgerClosingBalance: number
      markCompleted: boolean
    }) => {
      const { data: userRes } = await supabase.auth.getUser()
      const { error } = await supabase.from('bank_reconciliations').insert({
        bank_account_id: input.bankAccountId,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        statement_closing_balance: input.statementClosingBalance,
        ledger_closing_balance: input.ledgerClosingBalance,
        status: input.markCompleted ? 'completed' : 'in_progress',
        reconciled_by: input.markCompleted ? userRes.user?.id : null,
        reconciled_at: input.markCompleted ? new Date().toISOString() : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      toast.success('Reconciliation saved')
    },
    onError: (error: Error) => {
      toast.error('Unable to save reconciliation', { description: error.message })
    },
  })
}

export function useVatSummaryQuery(restaurantIds: string[] | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['vat-summary', restaurantIds, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_vat_summary', {
        p_restaurant_ids: restaurantIds,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}
