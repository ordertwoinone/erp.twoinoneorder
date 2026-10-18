import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

/** Amount per typing-centre step key (offer_letter, work_permit, ...). */
export type StepAmounts = Record<string, number>

/** A template of amounts for the typing-centre visa steps. */
export interface CompanyCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  step_amounts: StepAmounts
}

export interface CompanyCategoryInput {
  id?: string
  name: string
  description: string
  is_active: boolean
  /** Blank ('') means no amount for that step. */
  step_amounts: Record<string, number | ''>
}

export function stepAmountsTotal(amounts: Record<string, number | ''>) {
  return Object.values(amounts).reduce<number>((s, v) => s + (v === '' ? 0 : Number(v) || 0), 0)
}

export function useCompanyCategoriesQuery() {
  return useQuery({
    queryKey: ['company-categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanyCategory[]> => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('id, name, description, is_active, step_amounts')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((c) => {
        const raw = (c.step_amounts ?? {}) as Record<string, unknown>
        const step_amounts: StepAmounts = {}
        for (const [key, value] of Object.entries(raw)) if (value !== null && value !== '') step_amounts[key] = Number(value)
        return { id: c.id, name: c.name, description: c.description, is_active: c.is_active, step_amounts }
      })
    },
  })
}

export function useSaveCompanyCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompanyCategoryInput) => {
      const amounts: Record<string, number> = {}
      for (const [key, value] of Object.entries(input.step_amounts)) if (value !== '') amounts[key] = Number(value)
      const { data, error } = await supabase.rpc('save_company_category', {
        payload: {
          id: input.id ?? null,
          name: input.name,
          description: input.description,
          is_active: input.is_active,
          step_amounts: amounts,
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
