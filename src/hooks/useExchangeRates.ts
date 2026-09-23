import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export function useExchangeRatesQuery() {
  return useQuery({
    queryKey: ['exchange-rates'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exchange_rates').select('*')
      if (error) throw error
      return data
    },
  })
}

/** AED equivalent for an amount in `currencyCode`, or null if no rate is set (never fabricate a conversion). */
export function useAedEquivalent(amount: number | null | undefined, currencyCode: string | null | undefined) {
  const { data: rates } = useExchangeRatesQuery()
  if (amount == null || !currencyCode) return null
  const rate = rates?.find((r) => r.currency_code === currencyCode)?.rate_to_aed
  return rate ? amount * rate : null
}

export function useSetExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { currencyCode: string; rateToAed: number }) => {
      const { error } = await supabase.rpc('set_exchange_rate', {
        p_currency_code: input.currencyCode,
        p_rate_to_aed: input.rateToAed,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })
      toast.success('Exchange rate updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update exchange rate', { description: error.message })
    },
  })
}
