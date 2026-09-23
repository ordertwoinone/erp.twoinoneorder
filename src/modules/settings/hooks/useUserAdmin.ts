import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export function useProfilesQuery() {
  return useQuery({
    queryKey: ['profiles', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, status').order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useRolesQuery() {
  return useQuery({
    queryKey: ['roles', 'admin'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('id, key, name, is_all_restaurants').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useProfileAssignmentsQuery(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profiles', 'assignments', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [{ data: userRoles, error: rolesError }, { data: userRestaurants, error: restaurantsError }] = await Promise.all([
        supabase.from('user_roles').select('role_id').eq('profile_id', profileId!),
        supabase.from('user_restaurants').select('restaurant_id').eq('profile_id', profileId!),
      ])
      if (rolesError) throw rolesError
      if (restaurantsError) throw restaurantsError
      return {
        roleIds: userRoles.map((r) => r.role_id),
        restaurantIds: userRestaurants.map((r) => r.restaurant_id),
      }
    },
  })
}

export function useUpdateUserAssignments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      profileId: string
      status: 'active' | 'inactive' | 'suspended'
      roleIds: string[]
      restaurantIds: string[]
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const grantedBy = user?.id ?? null

      const { error: statusError } = await supabase
        .from('profiles')
        .update({ status: input.status })
        .eq('id', input.profileId)
      if (statusError) throw statusError

      const { error: deleteRolesError } = await supabase.from('user_roles').delete().eq('profile_id', input.profileId)
      if (deleteRolesError) throw deleteRolesError
      if (input.roleIds.length > 0) {
        const { error: insertRolesError } = await supabase
          .from('user_roles')
          .insert(input.roleIds.map((role_id) => ({ profile_id: input.profileId, role_id, granted_by: grantedBy })))
        if (insertRolesError) throw insertRolesError
      }

      const { error: deleteRestaurantsError } = await supabase
        .from('user_restaurants')
        .delete()
        .eq('profile_id', input.profileId)
      if (deleteRestaurantsError) throw deleteRestaurantsError
      if (input.restaurantIds.length > 0) {
        const { error: insertRestaurantsError } = await supabase.from('user_restaurants').insert(
          input.restaurantIds.map((restaurant_id) => ({ profile_id: input.profileId, restaurant_id, granted_by: grantedBy })),
        )
        if (insertRestaurantsError) throw insertRestaurantsError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('User access updated')
    },
    onError: (error: Error) => {
      toast.error('Unable to update user access', { description: error.message })
    },
  })
}
