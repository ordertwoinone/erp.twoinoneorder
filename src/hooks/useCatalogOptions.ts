import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export function useProductsOptions() {
  return useQuery({
    queryKey: ['catalog', 'products'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, barcode, name, base_unit_id, pack_size, pack_unit_id, image_path, brands(name), categories(name)')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCategoriesOptions() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name').eq('is_active', true).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useBrandsOptions() {
  return useQuery({
    queryKey: ['catalog', 'brands'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('id, name').eq('is_active', true).order('name')
      if (error) throw error
      return data
    },
  })
}

/** Creates a brand (or returns the existing one with the same name) and adds it to the cached brand list. */
export function useQuickCreateBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('quick_create_brand', { p_name: name })
      if (error) throw error
      return { id: data as string, name: name.trim().replace(/\s+/g, ' ') }
    },
    onSuccess: (brand) => {
      queryClient.setQueryData<{ id: string; name: string }[]>(['catalog', 'brands'], (prev) =>
        prev?.some((b) => b.id === brand.id) ? prev : [...(prev ?? []), brand].sort((a, b) => a.name.localeCompare(b.name)),
      )
      queryClient.invalidateQueries({ queryKey: ['catalog', 'brands'] })
    },
    onError: (error: Error) => toast.error('Unable to add brand', { description: error.message }),
  })
}

export function useUnitsOptions() {
  return useQuery({
    queryKey: ['catalog', 'units'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('id, code, name').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useSuppliersOptions() {
  return useQuery({
    queryKey: ['catalog', 'suppliers-options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, code, name, trn, payment_terms_days')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}
