import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { SalesEntryFormInput } from '@/schemas/sales'

export function useSaveSalesEntry() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: SalesEntryFormInput) => {
      const { data, error } = await supabase.rpc('save_sales_entry', {
        payload: {
          id: input.id ?? null,
          restaurant_id: input.restaurant_id,
          business_date: input.business_date,
          shift: input.shift,
          gross_sales: input.gross_sales,
          discounts: input.discounts,
          refunds: input.refunds,
          tax_amount: input.tax_amount,
          notes: input.notes ?? null,
          breakdowns: input.breakdowns.map((b) => ({
            sales_channel_id: b.sales_channel_id || null,
            payment_method_id: b.payment_method_id,
            amount: b.amount,
          })),
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (entryId) => {
      queryClient.invalidateQueries({ queryKey: ['sales-entries'] })
      toast.success('Sales entry saved')
      navigate(`/sales/${entryId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save sales entry', { description: error.message })
    },
  })
}

export function useTransitionSalesEntry(entryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: string) => {
      const { error } = await supabase.rpc('transition_sales_entry', {
        p_sales_entry_id: entryId,
        p_action: action,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-entries'] })
      toast.success('Sales entry updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update sales entry', { description: error.message })
    },
  })
}
