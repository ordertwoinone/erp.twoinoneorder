import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function useScanLabourList() {
  return useMutation({
    mutationFn: async ({ restaurantId, file }: { restaurantId: string; file: File }) => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type. Upload a PDF or image (JPG/PNG/WebP).')
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('File is too large (max 20 MB).')
      }

      const path = `${restaurantId}/labour-list/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, file, {
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const { data: importId, error: importError } = await supabase.rpc('create_labour_list_scan_job', {
        p_restaurant_id: restaurantId,
        p_storage_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_file_size_bytes: file.size,
      })
      if (importError) throw importError

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/scan-labour-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ importId }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Scan failed')
      }

      return { importId: importId as string, itemCount: result.itemCount as number }
    },
    onError: (error: Error) => {
      toast.error('Unable to scan labour list', { description: error.message })
    },
  })
}

export function useLabourListImportItemsQuery(importId: string | undefined) {
  return useQuery({
    queryKey: ['labour-list-import-items', importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labour_list_import_items')
        .select('*, employees(employee_code, full_name, emirates_id_expiry, base_salary, current_restaurant_id)')
        .eq('labour_list_import_id', importId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export interface ConfirmLabourListItemInput {
  itemId: string
  employeeId: string | null
  employeeCode: string
  fullName: string
  jobTitle: string | null
  restaurantId: string
  emiratesId: string | null
  emiratesIdExpiry: string | null
  medicalEntryDate: string | null
  lastInCountryDate: string | null
  finalStatus: string | null
  baseSalary: number | null
  vacations: { start_date: string; end_date: string | null; paid_by: string | null; amount: number | null; notes: string | null }[]
  settlementProofFile: File | null
}

export function useConfirmLabourListItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ConfirmLabourListItemInput) => {
      const { data: employeeId, error } = await supabase.rpc('confirm_labour_list_import_item', {
        p_item_id: input.itemId,
        payload: {
          employee_id: input.employeeId,
          employee_code: input.employeeCode,
          full_name: input.fullName,
          job_title: input.jobTitle,
          restaurant_id: input.restaurantId,
          emirates_id: input.emiratesId,
          emirates_id_expiry: input.emiratesIdExpiry,
          medical_entry_date: input.medicalEntryDate,
          last_in_country_date: input.lastInCountryDate,
          final_status: input.finalStatus,
          base_salary: input.baseSalary,
          vacations: input.vacations,
        } as never,
      })
      if (error) throw error

      if (input.settlementProofFile) {
        const file = input.settlementProofFile
        const path = `${input.restaurantId}/employee/${employeeId}/${crypto.randomUUID()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, file, {
          contentType: file.type,
        })
        if (!uploadError) {
          const { data: attachment } = await supabase
            .from('attachments')
            .insert({
              restaurant_id: input.restaurantId,
              entity_type: 'employee',
              entity_id: employeeId as string,
              category: 'employee-documents',
              storage_bucket: 'employee-documents',
              storage_path: path,
              file_name: file.name,
              mime_type: file.type,
              file_size_bytes: file.size,
            })
            .select('id')
            .single()
          if (attachment) {
            await supabase.from('employees').update({ settlement_proof_attachment_id: attachment.id }).eq('id', employeeId as string)
          }
        }
      }

      return employeeId as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labour-list-import-items'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee confirmed')
    },
    onError: (error: Error) => {
      toast.error('Unable to confirm employee', { description: error.message })
    },
  })
}

export function useIgnoreLabourListItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('ignore_labour_list_import_item', { p_item_id: itemId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labour-list-import-items'] })
    },
    onError: (error: Error) => {
      toast.error('Unable to ignore row', { description: error.message })
    },
  })
}
