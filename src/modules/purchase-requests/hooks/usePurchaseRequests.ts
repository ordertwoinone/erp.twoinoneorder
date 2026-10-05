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
        supabase.from('purchase_request_items').select('*, products(name, image_path), units(code)').eq('purchase_request_id', id!),
      ])
      if (requestRes.error) throw requestRes.error
      if (itemsRes.error) throw itemsRes.error

      return { request: requestRes.data, items: itemsRes.data }
    },
  })
}

/** submit = true sends the request for review; false keeps it as a draft ("Save PO"). */
export function useSavePurchaseRequest() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({ values, submit }: { values: PurchaseRequestFormInput; submit: boolean }) => {
      const { data, error } = await supabase.rpc('save_purchase_request', {
        payload: {
          id: values.id ?? null,
          restaurant_id: values.restaurant_id,
          notes: values.notes || null,
          items: values.items,
          submit,
        },
      })
      if (error) throw error
      return { id: data as string, submit }
    },
    onSuccess: ({ id, submit }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      toast.success(submit ? 'Purchase order sent for review' : 'Saved as draft', {
        description: submit ? undefined : 'You can keep editing it and send it later.',
      })
      navigate(submit ? `/purchases/requests/${id}` : `/purchases/requests/${id}/edit`, { replace: !submit })
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase request', { description: error.message })
    },
  })
}

export interface RequestCatalogItem {
  product_id: string
  name: string
  sku: string | null
  category_id: string | null
  category_name: string | null
  image_path: string | null
  base_unit_id: string
  unit_code: string
  price: number | null
  times_purchased: number
}

/** Item cards for the ordering screen: this restaurant's usual items first, with last prices. */
export function useRequestCatalog(restaurantId: string | null) {
  return useQuery({
    queryKey: ['purchase-requests', 'catalog', restaurantId],
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RequestCatalogItem[]> => {
      const { data, error } = await supabase.rpc('get_request_catalog', { p_restaurant_id: restaurantId! })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Target, allowance and value of requests already sent today (excluding the one being edited). */
export function useRequestDashboard(restaurantId: string | null, excludeRequestId?: string) {
  return useQuery({
    queryKey: ['purchase-requests', 'dashboard', restaurantId, excludeRequestId ?? null],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_purchase_request_dashboard', {
        p_restaurant_id: restaurantId!,
        p_exclude_request_id: excludeRequestId ?? null,
      })
      if (error) throw error
      const row = data?.[0]
      return {
        target: row?.daily_purchase_target ?? null,
        allowance: row?.daily_purchase_allowance ?? null,
        sentToday: Number(row?.requests_today ?? 0),
        sentTodayCount: Number(row?.requests_today_count ?? 0),
      }
    },
  })
}

export function useSetPurchaseTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { restaurantId: string; target: number | null; allowance: number | null }) => {
      const { error } = await supabase.rpc('set_restaurant_purchase_targets', {
        p_restaurant_id: input.restaurantId,
        p_target: input.target,
        p_allowance: input.allowance,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', 'dashboard'] })
      toast.success('Purchase target updated')
    },
    onError: (error: Error) => toast.error('Unable to update target', { description: error.message }),
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
