import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { SupplierInput } from '@/schemas/supplier'

export function useSaveSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SupplierInput) => {
      const payload = {
        code: input.code,
        name: input.name,
        trn: input.trn || null,
        payment_terms_days: input.payment_terms_days,
        supplier_type: input.supplier_type || null,
        salesman_name: input.salesman_name || null,
        credit_limit_amount: input.credit_limit_amount === '' ? null : input.credit_limit_amount,
        credit_limit_currency: input.credit_limit_currency,
        bank_name: input.bank_name || null,
        bank_account_name: input.bank_account_name || null,
        bank_account_number: input.bank_account_number || null,
        bank_iban: input.bank_iban || null,
        bank_swift: input.bank_swift || null,
        is_active: input.is_active,
      }

      let supplierId: string
      if (input.id) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', input.id)
        if (error) throw error
        supplierId = input.id
      } else {
        const { data, error } = await supabase.from('suppliers').insert(payload).select('id').single()
        if (error) throw error
        supplierId = data.id
      }

      // Categories are a join table, not a column — replace the full set rather
      // than diffing, since a supplier typically has a handful at most.
      const { error: deleteError } = await supabase.from('supplier_categories').delete().eq('supplier_id', supplierId)
      if (deleteError) throw deleteError
      if (input.category_ids.length > 0) {
        const { error: insertError } = await supabase
          .from('supplier_categories')
          .insert(input.category_ids.map((categoryId) => ({ supplier_id: supplierId, category_id: categoryId })))
        if (insertError) throw insertError
      }

      return supplierId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier saved')
    },
    onError: (error: Error) => {
      toast.error('Unable to save supplier', { description: error.message })
    },
  })
}
