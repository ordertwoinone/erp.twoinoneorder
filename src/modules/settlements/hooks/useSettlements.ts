import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { CardSettlementFormInput, DeliverySettlementFormInput } from '@/schemas/settlement'

const PAGE_SIZE = 20

export function useCardMachinesOptions() {
  return useQuery({
    queryKey: ['card-machines', 'options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_machines')
        .select('id, machine_name, terminal_id')
        .eq('status', 'active')
        .order('machine_name')
      if (error) throw error
      return data
    },
  })
}

export function useDeliveryPlatformsOptions() {
  return useQuery({
    queryKey: ['delivery-platforms', 'options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_platforms')
        .select('id, code, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCardSettlementsQuery(pageIndex: number) {
  return useQuery({
    queryKey: ['card-settlements', pageIndex],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('card_settlements')
        .select('id, credit_date, amount, status, card_machines(machine_name)', { count: 'exact' })
        .order('credit_date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useDeliverySettlementsQuery(pageIndex: number) {
  return useQuery({
    queryKey: ['delivery-settlements', pageIndex],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('delivery_settlements')
        .select('id, credit_date, amount, status, restaurants(name), delivery_platforms(name)', { count: 'exact' })
        .order('credit_date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useCreateCardSettlement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CardSettlementFormInput) => {
      const { data, error } = await supabase.rpc('create_card_settlement', {
        payload: {
          card_machine_id: input.card_machine_id,
          bank_account_id: input.bank_account_id,
          credit_date: input.credit_date,
          bank_reference: input.bank_reference || null,
          amount: input.amount,
          notes: input.notes || null,
          allocations: input.allocations,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-settlements'] })
      toast.success('Card settlement recorded')
    },
    onError: (error: Error) => {
      toast.error('Unable to record settlement', { description: error.message })
    },
  })
}

export function useCreateDeliverySettlement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeliverySettlementFormInput) => {
      const { error } = await supabase.from('delivery_settlements').insert({
        delivery_platform_id: input.delivery_platform_id,
        restaurant_id: input.restaurant_id,
        bank_account_id: input.bank_account_id || null,
        credit_date: input.credit_date,
        bank_reference: input.bank_reference || null,
        amount: input.amount,
        covers_from: input.covers_from,
        covers_to: input.covers_to,
        status: 'matched',
        notes: input.notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-settlements'] })
      toast.success('Delivery settlement recorded')
    },
    onError: (error: Error) => {
      toast.error('Unable to record settlement', { description: error.message })
    },
  })
}

export { PAGE_SIZE as SETTLEMENTS_PAGE_SIZE }
