import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const PAGE_SIZE = 20

export function useSuppliersQuery({ search, pageIndex }: { search: string; pageIndex: number }) {
  return useQuery({
    queryKey: ['suppliers', { search, pageIndex }],
    queryFn: async () => {
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('suppliers')
        .select(
          'id, code, name, trn, payment_terms_days, supplier_type, salesman_name, credit_limit_amount, credit_limit_currency, is_active',
          { count: 'exact' },
        )
        .order('name')
        .range(from, to)

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,code.ilike.%${search.trim()}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, totalCount: count ?? 0 }
    },
  })
}

export function useSupplierQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['suppliers', id],
    enabled: !!id,
    queryFn: async () => {
      const [supplierRes, categoriesRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('id', id!).single(),
        supabase.from('supplier_categories').select('category_id').eq('supplier_id', id!),
      ])
      if (supplierRes.error) throw supplierRes.error
      if (categoriesRes.error) throw categoriesRes.error
      return { ...supplierRes.data, category_ids: categoriesRes.data.map((c) => c.category_id) }
    },
  })
}

export { PAGE_SIZE as SUPPLIERS_PAGE_SIZE }
