import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { SalaryEntryFormInput } from '@/schemas/payroll'

export function useSaveSalaryEntry() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: SalaryEntryFormInput) => {
      const { data, error } = await supabase.rpc('save_salary_entry_draft', {
        payload: {
          id: input.id ?? null,
          employee_id: input.employee_id,
          restaurant_id: input.restaurant_id,
          period_month: input.period_month,
          basic_salary: input.basic_salary,
          allowances_total: input.allowances_total,
          overtime_amount: input.overtime_amount,
          deductions_total: input.deductions_total,
          advances_deducted: input.advances_deducted,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (entryId) => {
      queryClient.invalidateQueries({ queryKey: ['salary-entries'] })
      toast.success('Salary entry saved')
      navigate(`/payroll/${entryId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save salary entry', { description: error.message })
    },
  })
}

export function useTransitionSalaryEntry(entryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: string) => {
      const { error } = await supabase.rpc('transition_salary_entry', {
        p_salary_entry_id: entryId,
        p_action: action,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-entries'] })
      toast.success('Salary entry updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update salary entry', { description: error.message })
    },
  })
}

export function usePostSalaryPayment(entryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      amount: number
      paymentMethod: 'bank' | 'cash'
      bankAccountId?: string
      cashAccountId?: string
    }) => {
      const { error } = await supabase.rpc('post_salary_payment', {
        p_salary_entry_id: entryId,
        p_amount: input.amount,
        p_payment_method: input.paymentMethod,
        p_bank_account_id: input.bankAccountId || null,
        p_cash_account_id: input.cashAccountId || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-entries'] })
      toast.success('Salary payment recorded')
    },
    onError: (error: Error) => {
      toast.error('Unable to record payment', { description: error.message })
    },
  })
}
