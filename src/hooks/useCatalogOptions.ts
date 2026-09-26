import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useProductsOptions() {
  return useQuery({
    queryKey: ['catalog', 'products'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, base_unit_id, pack_size, brands(name), categories(name)')
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
        .select('id, code, name, payment_terms_days')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}
