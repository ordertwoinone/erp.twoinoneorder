import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { BranchTransferFormInput } from '@/schemas/branchTransfer'

const PAGE_SIZE = 20

export function useBranchTransfersQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['branch-transfers', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('branch_transfers')
        .select(
          'id, transfer_number, status, dispatch_date, from_restaurant_id, to_restaurant_id, from:restaurants!branch_transfers_from_restaurant_id_fkey(name), to:restaurants!branch_transfers_to_restaurant_id_fkey(name)',
          { count: 'exact' },
        )
        .order('dispatch_date', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.or(`from_restaurant_id.eq.${restaurantId},to_restaurant_id.eq.${restaurantId}`)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useBranchTransferQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['branch-transfers', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [transferRes, itemsRes] = await Promise.all([
        supabase
          .from('branch_transfers')
          .select(
            '*, from:restaurants!branch_transfers_from_restaurant_id_fkey(name), to:restaurants!branch_transfers_to_restaurant_id_fkey(name)',
          )
          .eq('id', id!)
          .single(),
        supabase.from('branch_transfer_items').select('*, products(name), units(code)').eq('branch_transfer_id', id!),
      ])
      if (transferRes.error) throw transferRes.error
      if (itemsRes.error) throw itemsRes.error

      return { transfer: transferRes.data, items: itemsRes.data }
    },
  })
}

export function useStockBalancesQuery(restaurantId: string | null) {
  return useQuery({
    queryKey: ['stock-balances', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_balances')
        .select('*, products(name, sku)')
        .eq('restaurant_id', restaurantId!)
        .order('quantity_on_hand', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateBranchTransfer() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: BranchTransferFormInput) => {
      const { data, error } = await supabase.rpc('create_branch_transfer', {
        payload: {
          from_restaurant_id: input.from_restaurant_id,
          to_restaurant_id: input.to_restaurant_id,
          notes: input.notes || null,
          items: input.items,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      toast.success('Transfer dispatched')
      navigate(`/inventory/transfers/${id}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to create transfer', { description: error.message })
    },
  })
}

export function useReceiveBranchTransfer(transferId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('receive_branch_transfer', { p_transfer_id: transferId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
      toast.success('Transfer received')
    },
    onError: (error: Error) => {
      toast.error('Unable to receive transfer', { description: error.message })
    },
  })
}

export { PAGE_SIZE as TRANSFERS_PAGE_SIZE }
