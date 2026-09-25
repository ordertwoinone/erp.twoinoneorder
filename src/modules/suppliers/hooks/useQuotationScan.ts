import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { readApiResponse } from '@/lib/utils/readApiResponse'
import type { ExtractedQuotation } from './quotationTypes'

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

export function useScanQuotation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ supplierId, file }: { supplierId: string; file: File }) => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type. Upload a PDF, image (JPG/PNG/WebP), or spreadsheet (XLS/XLSX/CSV).')
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('File is too large (max 20 MB).')
      }

      const path = `quotations/${supplierId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('supplier-documents').upload(path, file, {
        contentType: file.type,
      })
      if (uploadError) throw uploadError

      const { data: jobId, error: jobError } = await supabase.rpc('create_quotation_scan_job', {
        p_supplier_id: supplierId,
        p_storage_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_file_size_bytes: file.size,
      })
      if (jobError) throw jobError

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/scan-quotation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ jobId }),
      })

      const result = await readApiResponse<{ scanResultId: string; parsedData: ExtractedQuotation }>(
        response,
        'Quotation scan failed',
      )

      return { jobId: jobId as string, scanResultId: result.scanResultId, parsedData: result.parsedData }
    },
    onError: (error: Error) => {
      toast.error('Unable to scan document', { description: error.message })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-scan-jobs'] })
    },
  })
}

export function useSupplierScanJobsQuery(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-scan-jobs', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_scan_jobs')
        .select('*, attachments:attachment_id(file_name)')
        .eq('supplier_id', supplierId!)
        .eq('job_type', 'quotation')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useScanResultQuery(scanResultId: string | undefined) {
  return useQuery({
    queryKey: ['ai-scan-result', scanResultId],
    enabled: !!scanResultId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_scan_results').select('*').eq('id', scanResultId!).single()
      if (error) throw error
      return data
    },
  })
}
