import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { RestaurantInput } from '@/schemas/restaurant'

export function useRestaurantAdminQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['restaurants', 'admin', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export function useAllRestaurantsQuery() {
  return useQuery({
    queryKey: ['restaurants', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('is_head_office', { ascending: false })
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useSaveRestaurant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RestaurantInput) => {
      const payload = {
        code: input.code,
        name: input.name,
        legal_name: input.legal_name || null,
        address: input.address || null,
        city: input.city || null,
        emirate: input.emirate || null,
        phone: input.phone || null,
        email: input.email || null,
        trn: input.trn || null,
        is_head_office: input.is_head_office,
        is_active: input.is_active,
      }

      if (input.id) {
        const { error } = await supabase.from('restaurants').update(payload).eq('id', input.id)
        if (error) throw error
        return input.id
      }

      const { data, error } = await supabase.from('restaurants').insert(payload).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      toast.success('Restaurant saved')
    },
    onError: (error: Error) => {
      toast.error('Unable to save restaurant', { description: error.message })
    },
  })
}
