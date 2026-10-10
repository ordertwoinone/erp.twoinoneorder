import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

export interface CompanyCategoryValue {
  id: string
  label: string
  amount: number
  sort_order: number
}

export interface CompanyCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  company_category_values: CompanyCategoryValue[]
}

export interface CompanyCategoryInput {
  id?: string
  name: string
  description: string
  is_active: boolean
  values: { id: string | null; label: string; amount: number | '' }[]
}

/** Every category with its values (values in their saved order). */
export function useCompanyCategoriesQuery() {
  return useQuery({
    queryKey: ['company-categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanyCategory[]> => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('id, name, description, is_active, company_category_values(id, label, amount, sort_order)')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data as unknown as CompanyCategory[]).map((c) => ({
        ...c,
        company_category_values: [...c.company_category_values].sort((a, b) => a.sort_order - b.sort_order),
      }))
    },
  })
}

export function useSaveCompanyCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompanyCategoryInput) => {
      const { data, error } = await supabase.rpc('save_company_category', {
        payload: {
          id: input.id ?? null,
          name: input.name,
          description: input.description,
          is_active: input.is_active,
          values: input.values.map((v) => ({ id: v.id, label: v.label, amount: v.amount === '' ? 0 : v.amount })),
        } as unknown as Json,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] })
      toast.success(input.id ? 'Category updated' : 'Category added')
    },
    onError: (error: Error) => toast.error('Unable to save category', { description: error.message }),
  })
}

export function useDeleteCompanyCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_company_category', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] })
      toast.success('Category deleted')
    },
    onError: (error: Error) => toast.error('Unable to delete category', { description: error.message }),
  })
}
