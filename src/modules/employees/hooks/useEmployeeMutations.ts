import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import type { EmployeeInput } from '@/schemas/employee'

export function useSaveEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const payload = {
        employee_code: input.employee_code,
        full_name: input.full_name,
        job_title: input.job_title || null,
        joining_date: input.joining_date || null,
        current_restaurant_id: input.current_restaurant_id || null,
        phone: input.phone || null,
        email: input.email || null,
        employment_status: input.employment_status,
        is_shared_employee: input.is_shared_employee,
      }

      if (input.id) {
        const { error } = await supabase.from('employees').update(payload).eq('id', input.id)
        if (error) throw error
        return input.id
      }

      const { data, error } = await supabase.from('employees').insert(payload).select('id').single()
      if (error) throw error

      if (payload.current_restaurant_id) {
        await supabase.from('employee_assignments').insert({
          employee_id: data.id,
          restaurant_id: payload.current_restaurant_id,
          starts_at: payload.joining_date ?? new Date().toISOString().slice(0, 10),
        })
      }

      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee saved')
    },
    onError: (error: Error) => {
      toast.error('Unable to save employee', { description: error.message })
    },
  })
}

export function useTransferEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ employeeId, restaurantId }: { employeeId: string; restaurantId: string }) => {
      const { error } = await supabase.rpc('transfer_employee', {
        p_employee_id: employeeId,
        p_new_restaurant_id: restaurantId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee transferred')
    },
    onError: (error: Error) => {
      toast.error('Unable to transfer employee', { description: error.message })
    },
  })
}
