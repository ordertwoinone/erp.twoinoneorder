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
        supabase.from('purchase_requests').select('*, restaurants(name), employees(full_name)').eq('id', id!).single(),
        supabase.from('purchase_request_items').select('*, products(name, sku, image_path), units(code), suppliers(name)').eq('purchase_request_id', id!),
      ])
      if (requestRes.error) throw requestRes.error
      if (itemsRes.error) throw itemsRes.error

      return { request: requestRes.data, items: itemsRes.data }
    },
  })
}

/** submit = true sends the request for review; false keeps it as a draft. */
export function useSavePurchaseRequest() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({
      values,
      submit,
      chef,
    }: {
      values: PurchaseRequestFormInput
      submit: boolean
      /** The logged-in chef; the PIN is re-checked on the server. */
      chef?: { employeeId: string; pin: string } | null
    }) => {
      const { data, error } = await supabase.rpc('save_purchase_request', {
        payload: {
          id: values.id ?? null,
          restaurant_id: values.restaurant_id,
          notes: values.notes || null,
          needed_date: values.needed_date || null,
          items: values.items,
          submit,
          employee_id: chef?.employeeId ?? null,
          employee_pin: chef?.pin ?? null,
        },
      })
      if (error) throw error
      return { id: data as string, submit }
    },
    onSuccess: ({ id, submit }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      toast.success(submit ? 'Purchase request submitted for approval' : 'Saved as draft', {
        description: submit ? undefined : 'You can keep editing it and submit it later.',
      })
      navigate(submit ? `/purchases/requests/${id}` : `/purchases/requests/${id}/edit`, { replace: !submit })
    },
    onError: (error: Error) => {
      toast.error('Unable to save purchase request', { description: error.message })
    },
  })
}

export interface RequestSupplierPrice {
  supplier_id: string
  supplier_name: string
  unit_id: string
  unit_code: string
  price: number
  locked: boolean
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
  pinned: boolean
  price_change_pct: number | null
  suppliers: RequestSupplierPrice[]
}

/** Item cards: pinned items first, then this restaurant's usual items, with prices per supplier and unit. */
export function useRequestCatalog(restaurantId: string | null) {
  return useQuery({
    queryKey: ['purchase-requests', 'catalog', restaurantId],
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RequestCatalogItem[]> => {
      const { data, error } = await supabase.rpc('get_request_catalog', { p_restaurant_id: restaurantId! })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, suppliers: (r.suppliers as unknown as RequestSupplierPrice[]) ?? [] }))
    },
  })
}

export interface RequestDashboard {
  dailyTarget: number | null
  monthlyBudget: number | null
  bonusGood: number | null
  bonusSafe: number | null
  dayTotal: number
  dayCount: number
  monthTotal: number
  priceVariancePct: number | null
}

/** Every figure for the cards, from one server calculation (the request being edited is excluded). */
export function useRequestDashboard(restaurantId: string | null, date: string, excludeRequestId?: string) {
  return useQuery({
    queryKey: ['purchase-requests', 'dashboard', restaurantId, date, excludeRequestId ?? null],
    enabled: !!restaurantId,
    queryFn: async (): Promise<RequestDashboard> => {
      const { data, error } = await supabase.rpc('get_purchase_request_dashboard', {
        p_restaurant_id: restaurantId!,
        p_date: date,
        p_exclude_request_id: excludeRequestId ?? null,
      })
      if (error) throw error
      const row = data?.[0]
      return {
        dailyTarget: row?.daily_purchase_target ?? null,
        monthlyBudget: row?.monthly_purchase_budget ?? null,
        bonusGood: row?.bonus_good_amount ?? null,
        bonusSafe: row?.bonus_safe_amount ?? null,
        dayTotal: Number(row?.day_total ?? 0),
        dayCount: Number(row?.day_count ?? 0),
        monthTotal: Number(row?.month_total ?? 0),
        priceVariancePct: row?.price_variance_pct ?? null,
      }
    },
  })
}

export function useSetPurchaseBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { restaurantId: string; dailyTarget: number | null; monthlyBudget: number | null; bonusGood: number | null; bonusSafe: number | null }) => {
      const { error } = await supabase.rpc('set_restaurant_purchase_budget', {
        p_restaurant_id: input.restaurantId,
        p_daily_target: input.dailyTarget,
        p_monthly_budget: input.monthlyBudget,
        p_bonus_good: input.bonusGood,
        p_bonus_safe: input.bonusSafe,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', 'dashboard'] })
      toast.success('Purchase budget updated')
    },
    onError: (error: Error) => toast.error('Unable to update budget', { description: error.message }),
  })
}

export function useRequestEmployees(restaurantId: string | null) {
  return useQuery({
    queryKey: ['purchase-requests', 'employees', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_request_employees', { p_restaurant_id: restaurantId! })
      if (error) throw error
      return data ?? []
    },
  })
}

export interface ChefSession {
  employeeId: string
  fullName: string
  jobTitle: string | null
  /** null = may order from every category */
  categoryIds: string[] | null
  pin: string
}

export function useVerifyRequestPin() {
  return useMutation({
    mutationFn: async ({ employeeId, pin }: { employeeId: string; pin: string }): Promise<ChefSession> => {
      const { data, error } = await supabase.rpc('verify_request_pin', { p_employee_id: employeeId, p_pin: pin })
      if (error) throw error
      const row = data?.[0]
      if (!row) throw new Error('Wrong PIN')
      return { employeeId: row.employee_id, fullName: row.full_name, jobTitle: row.job_title, categoryIds: row.category_ids, pin }
    },
    onError: (error: Error) => toast.error('Login failed', { description: error.message }),
  })
}

export function useEmployeeRequestAccess(employeeId: string | null) {
  return useQuery({
    queryKey: ['purchase-requests', 'employee-access', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_request_access', { p_employee_id: employeeId! })
      if (error) throw error
      return data?.[0] ?? { has_pin: false, category_ids: null }
    },
  })
}

export function useSetEmployeeRequestAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; pin: string | null; categoryIds: string[] | null }) => {
      const { error } = await supabase.rpc('set_employee_request_access', {
        p_employee_id: input.employeeId,
        p_pin: input.pin,
        p_category_ids: input.categoryIds,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', 'employees'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-requests', 'employee-access'] })
      toast.success('Employee access saved')
    },
    onError: (error: Error) => toast.error('Unable to save access', { description: error.message }),
  })
}

/** Pins / unpins an item for the restaurant, updating the cards straight away. */
export function useToggleRequestPin(restaurantId: string | null) {
  const queryClient = useQueryClient()
  const key = ['purchase-requests', 'catalog', restaurantId]
  return useMutation({
    mutationFn: async ({ productId, pinned }: { productId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('toggle_request_pin', { p_restaurant_id: restaurantId!, p_product_id: productId, p_pinned: pinned })
      if (error) throw error
    },
    onMutate: ({ productId, pinned }) => {
      const previous = queryClient.getQueryData<RequestCatalogItem[]>(key)
      queryClient.setQueryData<RequestCatalogItem[]>(key, (items) => items?.map((i) => (i.product_id === productId ? { ...i, pinned } : i)))
      return { previous }
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error('Unable to pin item', { description: error.message })
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
