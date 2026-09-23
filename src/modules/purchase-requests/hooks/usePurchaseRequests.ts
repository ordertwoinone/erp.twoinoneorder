import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { PurchaseRequestFormInput } from '@/schemas/purchaseRequest'

const PAGE_SIZE = 20

export function usePurchaseRequestsQuery({ restaurantId, pageIndex }: { restaurantId: string | null; pageIndex: number }) {
  return useQuery({
    queryKey: ['purchase-requests', { restaurantId, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('purchase_requests')
        .select('id, request_number, status, requested_at, restaurant_id, restaurants(name)', { count: 'exact' })
        .order('requested_at', { ascending: false })
        .range(from, to)

      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function usePurchaseRequestQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase-requests', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [requestRes, itemsRes] = await Promise.all([
        supabase.from('purchase_requests').select('*, restaurants(name)').eq('id', id!).single(),
        supabase.from('purchase_request_items').select('*, products(name), units(code)').eq('purchase_request_id', id!),
      ])
      if (requestRes.error) throw requestRes.error
      if (itemsRes.error) throw itemsRes.error

      return { request: requestRes.data, items: itemsRes.data }
    },
  })
}

export function useSavePurchaseRequest() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: PurchaseRequestFormInput) => {
      const { data, error } = await supabase.rpc('save_purchase_request', {
        payload: {
          id: input.id ?? null,
          restaurant_id: input.restaurant_id,
          notes: input.notes || null,
          items: input.items,
        },
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      toast.success('Purchase request submitted')
      navigate(`/purchases/requests/${id}`)
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase request', { description: error.message })
    },
  })
}

export function useReviewPurchaseRequest(requestId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, comment }: { action: string; comment?: string }) => {
      const { error } = await supabase.rpc('review_purchase_request', {
        p_request_id: requestId,
        p_action: action,
        p_comment: comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      toast.success('Purchase request updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update purchase request', { description: error.message })
    },
  })
}

export { PAGE_SIZE as PURCHASE_REQUESTS_PAGE_SIZE }
