import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

export interface CompanyCategory {
  id: string
  name: string
  amount: number
  description: string | null
  is_active: boolean
}

export interface CompanyCategoryInput {
  id?: string
  name: string
  amount: number | ''
  description: string
  is_active: boolean
}

/** Every company category with its amount. */
export function useCompanyCategoriesQuery() {
  return useQuery({
    queryKey: ['company-categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanyCategory[]> => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('id, name, amount, description, is_active')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((c) => ({ ...c, amount: Number(c.amount) }))
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
          amount: input.amount === '' ? 0 : input.amount,
          description: input.description,
          is_active: input.is_active,
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
