import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { PurchaseFormInput } from '@/schemas/purchase'

export function useSavePurchaseDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: PurchaseFormInput) => {
      const { data, error } = await supabase.rpc('save_purchase_draft', {
        payload: {
          id: input.id ?? null,
          restaurant_id: input.restaurant_id,
          supplier_id: input.supplier_id,
          invoice_number: input.invoice_number,
          invoice_date: input.invoice_date,
          notes: input.notes ?? null,
          items: input.items.map((item) => ({
            product_id: item.product_id,
            unit_id: item.unit_id,
            pack_size: item.pack_size === '' ? null : item.pack_size,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount,
            tax_amount: item.tax_amount,
          })),
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (purchaseId) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase saved as draft')
      navigate(`/purchases/${purchaseId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase', { description: error.message })
    },
  })
}

export function useTransitionPurchase(purchaseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, comment }: { action: string; comment?: string }) => {
      const { error } = await supabase.rpc('transition_purchase', {
        p_purchase_id: purchaseId,
        p_action: action,
        p_comment: comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update purchase', { description: error.message })
    },
  })
}

export function usePostPurchase(purchaseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('post_purchase', { p_purchase_id: purchaseId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase posted', { description: 'Stock and accounting records have been updated.' })
    },
    onError: (error: Error) => {
      toast.error('Unable to post purchase', { description: error.message })
    },
  })
}
