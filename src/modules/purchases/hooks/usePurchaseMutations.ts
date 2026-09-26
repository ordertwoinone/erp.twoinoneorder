import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { computeLines, type PurchaseFormInput } from '@/schemas/purchase'

function buildPayload(input: PurchaseFormInput) {
  const lines = computeLines(input.items, input.invoice_discount)
  return {
    id: input.id ?? null,
    restaurant_id: input.restaurant_id,
    supplier_id: input.supplier_id,
    invoice_number: input.invoice_number,
    invoice_date: input.invoice_date,
    payment_terms_days: input.payment_terms_days === '' ? null : input.payment_terms_days,
    notes: input.notes ?? null,
    // The server recomputes VAT from vat_rate; discount_amount is this line's
    // share of the invoice discount.
    items: input.items.map((item, index) => ({
      product_id: item.product_id,
      unit_id: item.unit_id,
      pack_size: item.pack_size === '' ? null : item.pack_size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: lines[index].discount,
      vat_rate: item.vat_rate,
    })),
  }
}

interface SaveInput {
  values: PurchaseFormInput
  /** Set when this draft originated from a reviewed AI invoice scan. */
  scanResultId?: string | null
}

async function savePurchase({ values, scanResultId }: SaveInput): Promise<string> {
  const payload = buildPayload(values)
  if (scanResultId) {
    const { data, error } = await supabase.rpc('confirm_purchase_scan', { p_scan_result_id: scanResultId, payload: payload as never })
    if (error) throw error
    return data as string
  }
  const { data, error } = await supabase.rpc('save_purchase_draft', { payload: payload as never })
  if (error) throw error
  return data as string
}

export function useSavePurchaseDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: savePurchase,
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

/** Saves the draft (or confirms a scan) and immediately submits it for approval, in one action. */
export function useSubmitPurchaseForApproval() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: SaveInput) => {
      const purchaseId = await savePurchase(input)
      const { error } = await supabase.rpc('transition_purchase', { p_purchase_id: purchaseId, p_action: 'submit' })
      if (error) throw error
      return purchaseId
    },
    onSuccess: (purchaseId) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Submitted for approval')
      navigate(`/purchases/${purchaseId}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to submit purchase', { description: error.message })
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
