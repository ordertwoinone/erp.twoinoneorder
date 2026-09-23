import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { ExpenseFormInput } from '@/schemas/expense'

export function useSaveExpenseDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: ExpenseFormInput) => {
      const { data, error } = await supabase.rpc('save_expense_draft', {
        payload: {
          id: input.id ?? null,
          restaurant_id: input.restaurant_id,
          expense_category_id: input.expense_category_id,
          amount: input.amount,
          expense_date: input.expense_date,
          notes: input.notes || null,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (expenseId) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense saved')
      navigate(`/expenses/${expenseId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save expense', { description: error.message })
    },
  })
}

export function useTransitionExpense(expenseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, comment }: { action: string; comment?: string }) => {
      const { error } = await supabase.rpc('transition_expense', {
        p_expense_id: expenseId,
        p_action: action,
        p_comment: comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update expense', { description: error.message })
    },
  })
}
