import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface RestaurantOption {
  id: string
  code: string
  name: string
  is_head_office: boolean
}

/**
 * Restaurants visible to the current user. RLS already scopes this to
 * whatever the user is allowed to see — no client-side filtering needed.
 */
export function useRestaurantsQuery() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['restaurants', 'accessible'],
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RestaurantOption[]> => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, code, name, is_head_office')
        .eq('is_active', true)
        .order('is_head_office', { ascending: false })
        .order('name')
      if (error) throw error
      return data
    },
  })
}
