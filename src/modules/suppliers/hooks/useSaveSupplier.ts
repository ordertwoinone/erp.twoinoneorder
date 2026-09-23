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

      if (input.id) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', input.id)
        if (error) throw error
        return input.id
      }

      const { data, error } = await supabase.from('suppliers').insert(payload).select('id').single()
      if (error) throw error
      return data.id
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
