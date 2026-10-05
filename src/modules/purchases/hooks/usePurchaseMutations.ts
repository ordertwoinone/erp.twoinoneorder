import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { computeLines, effectiveBillDiscount, type PurchaseFormInput } from '@/schemas/purchase'

const orNull = <T,>(v: T | '' | undefined) => (v === '' || v === undefined ? null : v)

function buildPayload(input: PurchaseFormInput) {
  const otherExpenses = input.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const billDiscount = effectiveBillDiscount(input.items, input.invoice_discount, input.bill_discount_percent)
  const lines = computeLines(input.items, billDiscount, { taxDisabled: input.tax_disabled, otherExpenses })
  return {
    id: input.id ?? null,
    restaurant_id: input.restaurant_id,
    supplier_id: input.supplier_id,
    invoice_number: input.invoice_number,
    invoice_date: input.invoice_date,
    received_date: orNull(input.received_date),
    payment_mode: orNull(input.payment_mode),
    payment_terms_days: orNull(input.payment_terms_days),
    po_reference: orNull(input.po_reference),
    tax_disabled: input.tax_disabled,
    currency_code: input.currency_code,
    exchange_rate: input.currency_code === 'AED' ? 1 : input.exchange_rate,
    bill_discount_percent: orNull(input.bill_discount_percent),
    notes: input.notes ?? null,
    // The server recomputes VAT from vat_rate (forcing 0 when tax is
    // disabled); discount_amount is the line's unit discount plus its share of
    // the bill discount.
    items: input.items.map((item, index) => ({
      product_id: item.product_id,
      unit_id: item.unit_id,
      pack_size: orNull(item.pack_size),
      quantity: item.quantity,
      foc_quantity: orNull(item.foc_quantity) ?? 0,
      unit_price: item.unit_price,
      foreign_unit_price: input.currency_code === 'AED' ? null : orNull(item.foreign_unit_price),
      unit_discount: orNull(item.unit_discount) ?? 0,
      discount_amount: lines[index].discount,
      vat_rate: item.vat_rate,
      description: item.description?.trim() || item.product_name || null,
    })),
    expenses: input.expenses.map((e) => ({ description: e.description, payee: orNull(e.payee), amount: e.amount })),
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

/** Saves as draft. The caller decides where to go next (Save & New / Save & Close). */
export function useSavePurchaseDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: savePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase saved as draft')
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase', { description: error.message })
    },
  })
}

/**
 * "Post" from the entry screen, for users allowed to approve and post: saves,
 * submits, approves and posts in one go — the same steps (and audit trail) as
 * doing them one by one. If a later step fails, the purchase is left at the
 * last successful status and the user is told which step failed.
 */
export function usePostPurchaseNow() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: SaveInput) => {
      const purchaseId = await savePurchase(input)
      const step = async (label: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
        const { error } = await run()
        if (error) throw Object.assign(new Error(`${label} failed: ${error.message}`), { purchaseId })
      }
      await step('Submit', () => supabase.rpc('transition_purchase', { p_purchase_id: purchaseId, p_action: 'submit' }))
      await step('Approve', () => supabase.rpc('transition_purchase', { p_purchase_id: purchaseId, p_action: 'approve', p_comment: 'Approved and posted from entry screen' }))
      await step('Post', () => supabase.rpc('post_purchase', { p_purchase_id: purchaseId }))
      return purchaseId
    },
    onSuccess: (purchaseId) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase posted', { description: 'Stock and accounting records have been updated.' })
      navigate(`/purchases/${purchaseId}`)
    },
    onError: (error: Error & { purchaseId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.error('Unable to post purchase', { description: error.message })
      if (error.purchaseId) navigate(`/purchases/${error.purchaseId}`)
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
