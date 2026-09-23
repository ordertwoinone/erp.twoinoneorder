import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { PaymentVoucherFormInput } from '@/schemas/payment'

export function useSavePaymentVoucherDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: PaymentVoucherFormInput) => {
      const { data, error } = await supabase.rpc('save_payment_voucher_draft', {
        payload: {
          id: input.id ?? null,
          restaurant_id: input.restaurant_id,
          payee_type: input.payee_type,
          supplier_id: input.supplier_id || null,
          expense_category_id: input.expense_category_id || null,
          amount: input.amount,
          payment_method: input.payment_method,
          bank_account_id: input.bank_account_id || null,
          cash_account_id: input.cash_account_id || null,
          payment_reference: input.payment_reference || null,
          voucher_date: input.voucher_date,
          notes: input.notes || null,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (voucherId) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] })
      toast.success('Payment voucher saved')
      navigate(`/payments/${voucherId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save payment voucher', { description: error.message })
    },
  })
}

export function useTransitionPaymentVoucher(voucherId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, comment }: { action: string; comment?: string }) => {
      const { error } = await supabase.rpc('transition_payment_voucher', {
        p_voucher_id: voucherId,
        p_action: action,
        p_comment: comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] })
      toast.success('Payment voucher updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update payment voucher', { description: error.message })
    },
  })
}

export function usePostPaymentVoucher(voucherId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (allocations: { purchase_id: string; amount: number }[]) => {
      const { error } = await supabase.rpc('post_payment_voucher', {
        p_voucher_id: voucherId,
        p_allocations: allocations,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Payment posted', { description: 'Supplier balance and accounting records have been updated.' })
    },
    onError: (error: Error) => {
      toast.error('Unable to post payment', { description: error.message })
    },
  })
}
