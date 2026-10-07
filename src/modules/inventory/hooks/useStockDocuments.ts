import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'
import type { DocHeader, DocLine, StockDocKind } from '../stockDocs'

export const STOCK_DOCS_PAGE_SIZE = 50

export function useStockDocumentsQuery(
  kind: StockDocKind,
  { restaurantId, search, unpostedOnly, pageIndex }: { restaurantId: string | null; search: string; unpostedOnly: boolean; pageIndex: number },
) {
  return useQuery({
    queryKey: ['stock-docs', kind, { restaurantId, search, unpostedOnly, pageIndex }],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_stock_documents', {
        p_kind: kind,
        p_restaurant_id: restaurantId,
        p_search: search || null,
        p_unposted_only: unpostedOnly,
        p_limit: STOCK_DOCS_PAGE_SIZE,
        p_offset: pageIndex * STOCK_DOCS_PAGE_SIZE,
      })
      if (error) throw error
      return { rows: data ?? [], totalCount: data?.[0]?.total_count ?? 0 }
    },
  })
}

export interface StockDocument {
  header: Record<string, unknown> & { id: string; doc_number: string; status: string }
  items: Array<Record<string, unknown>>
}

export function useStockDocumentQuery(kind: StockDocKind, id: string | undefined) {
  return useQuery({
    queryKey: ['stock-docs', kind, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stock_document', { p_kind: kind, p_id: id! })
      if (error) throw error
      return data as unknown as StockDocument
    },
  })
}

export interface StockItem {
  product_id: string
  name: string
  sku: string | null
  barcode: string | null
  base_unit_id: string
  base_unit_code: string
  pack_size: number | null
  image_path: string | null
  current_stock: number
  average_cost: number
  last_cost: number
}

export function useStockItemSearch(restaurantId: string | null, search: string, supplierId: string | null) {
  return useQuery({
    queryKey: ['stock-item-search', restaurantId, search, supplierId],
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<StockItem[]> => {
      const { data, error } = await supabase.rpc('search_stock_items', {
        p_restaurant_id: restaurantId!,
        p_search: search || null,
        p_limit: 20,
        p_supplier_id: supplierId,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

function payloadFor(kind: StockDocKind, header: DocHeader, lines: DocLine[]) {
  return {
    id: header.id ?? null,
    restaurant_id: header.restaurant_id || null,
    from_restaurant_id: header.from_restaurant_id || null,
    to_restaurant_id: header.to_restaurant_id || null,
    supplier_id: header.supplier_id || null,
    invoice_number: header.invoice_number,
    doc_date: header.doc_date,
    received_date: header.received_date || null,
    payment_mode: header.payment_mode || null,
    tax_disabled: header.tax_disabled,
    discount_percent: header.discount_percent,
    discount_amount: header.discount_amount,
    notes: header.notes,
    item_kind: header.item_kind,
    items: lines.map((l) => ({
      product_id: l.product_id,
      unit_id: l.unit_id,
      quantity: l.quantity,
      foc_quantity: l.foc_quantity,
      unit_cost: l.unit_cost,
      tax_percent: l.tax_percent,
      discount_amount: l.discount_amount,
      new_stock: kind === 'adjustment' ? l.new_stock : null,
      remarks: l.remarks,
    })),
  }
}

function invalidateDocs(queryClient: ReturnType<typeof useQueryClient>, kind: StockDocKind) {
  queryClient.invalidateQueries({ queryKey: ['stock-docs', kind] })
  queryClient.invalidateQueries({ queryKey: ['stock-balances'] })
  queryClient.invalidateQueries({ queryKey: ['stock-item-search'] })
  queryClient.invalidateQueries({ queryKey: ['locations'] })
}

export function useSaveStockDocument(kind: StockDocKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ header, lines, post }: { header: DocHeader; lines: DocLine[]; post: boolean }) => {
      const { data: id, error } = await supabase.rpc('save_stock_document', {
        p_kind: kind,
        payload: payloadFor(kind, header, lines) as unknown as Json,
      })
      if (error) throw error
      if (post) {
        const { error: postError } = await supabase.rpc('post_stock_document', { p_kind: kind, p_id: id })
        if (postError) {
          // The draft is saved; tell the caller so it can switch to edit mode.
          throw Object.assign(new Error(postError.message), { savedId: id })
        }
      }
      return id as string
    },
    onSuccess: (_id, { post }) => {
      invalidateDocs(queryClient, kind)
      toast.success(post ? 'Saved and posted' : 'Saved')
    },
    onError: (error: Error) => {
      invalidateDocs(queryClient, kind)
      toast.error('Unable to save', { description: error.message })
    },
  })
}

export function usePostStockDocument(kind: StockDocKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('post_stock_document', { p_kind: kind, p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateDocs(queryClient, kind)
      toast.success('Posted')
    },
    onError: (error: Error) => toast.error('Unable to post', { description: error.message }),
  })
}

export function useDeleteStockDocument(kind: StockDocKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_stock_document', { p_kind: kind, p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateDocs(queryClient, kind)
      toast.success('Deleted')
    },
    onError: (error: Error) => toast.error('Unable to delete', { description: error.message }),
  })
}

export function useReceiveTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('receive_branch_transfer', { p_transfer_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateDocs(queryClient, 'transfer')
      toast.success('Transfer received into stock')
    },
    onError: (error: Error) => toast.error('Unable to receive transfer', { description: error.message }),
  })
}

export function useCreateTransferFromRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc('create_transfer_from_request', { p_request_id: requestId })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      invalidateDocs(queryClient, 'request')
      invalidateDocs(queryClient, 'transfer')
      toast.success('Draft transfer created — review and post it')
    },
    onError: (error: Error) => toast.error('Unable to create transfer', { description: error.message }),
  })
}

export function useRejectStockRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('reject_stock_request', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateDocs(queryClient, 'request')
      toast.success('Request rejected')
    },
    onError: (error: Error) => toast.error('Unable to reject request', { description: error.message }),
  })
}

export interface LocationRow {
  id: string
  code: string
  name: string
  is_head_office: boolean
  is_active: boolean
  linked_supplier_id: string | null
  linked_supplier_name: string | null
  linked_customer_name: string | null
  item_count: number
  stock_value: number
}

export function useLocationsQuery() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await supabase.rpc('list_locations')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSaveLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; linked_supplier_id: string | null; linked_customer_name: string }) => {
      const { data, error } = await supabase.rpc('save_location', { payload: input as unknown as Json })
      if (error) throw error
      return data as string
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      toast.success(input.id ? 'Location updated' : 'Location added')
    },
    onError: (error: Error) => toast.error('Unable to save location', { description: error.message }),
  })
}
