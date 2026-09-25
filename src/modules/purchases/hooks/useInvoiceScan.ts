import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface ExtractedInvoiceItem {
  description: string
  sku: string | null
  uom: string | null
  pack_size: number | null
  quantity: number
  unit_price: number
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedInvoice {
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  items: ExtractedInvoiceItem[]
}

export function useScanInvoice() {
  return useMutation({
    mutationFn: async ({ restaurantId, supplierId, file }: { restaurantId: string; supplierId: string | null; file: File }) => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type. Upload a PDF or image (JPG/PNG/WebP).')
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('File is too large (max 20 MB).')
      }

      const path = `${restaurantId}/invoice-scans/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('invoices').upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: jobId, error: jobError } = await supabase.rpc('create_invoice_scan_job', {
        p_restaurant_id: restaurantId,
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

      const response = await fetch('/api/scan-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ jobId }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Scan failed')
      }

      return { jobId: jobId as string, scanResultId: result.scanResultId as string, parsedData: result.parsedData as ExtractedInvoice }
    },
    onError: (error: Error) => {
      toast.error('Unable to scan invoice', { description: error.message })
    },
  })
}
