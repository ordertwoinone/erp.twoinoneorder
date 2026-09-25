import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { requireUserWithPermission, AuthError } from './_lib/auth.js'
import { extractFromImageOrPdf } from './_lib/extractInvoice.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await requireUserWithPermission(req.headers.authorization, 'purchases.create')

    const { jobId } = req.body as { jobId?: string }
    if (!jobId) {
      res.status(400).json({ error: 'jobId is required' })
      return
    }

    const admin = getSupabaseAdmin()

    const { data: job, error: jobError } = await admin
      .from('ai_scan_jobs')
      .select('*, attachments:attachment_id(storage_bucket, storage_path, mime_type, file_name)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      res.status(404).json({ error: 'Scan job not found' })
      return
    }
    if (job.job_type !== 'invoice') {
      res.status(400).json({ error: 'Not an invoice scan job' })
      return
    }
    if (job.status !== 'queued') {
      res.status(409).json({ error: `Job is already ${job.status}` })
      return
    }

    const attachment = (job as any).attachments as {
      storage_bucket: string
      storage_path: string
      mime_type: string
      file_name: string
    } | null
    if (!attachment) {
      res.status(400).json({ error: 'Scan job has no attached file' })
      return
    }

    await admin.from('ai_scan_jobs').update({ status: 'processing' }).eq('id', jobId)

    try {
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from(attachment.storage_bucket)
        .download(attachment.storage_path)
      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || 'Failed to download the uploaded file')
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { raw, parsed } = await extractFromImageOrPdf(buffer.toString('base64'), attachment.mime_type, attachment.file_name)

      const { data: scanResult, error: insertError } = await admin
        .from('ai_scan_results')
        .insert({
          ai_scan_job_id: jobId,
          raw_response: raw as never,
          parsed_data: parsed as never,
          review_status: 'pending_review',
        })
        .select('id')
        .single()
      if (insertError || !scanResult) {
        throw new Error(insertError?.message || 'Failed to save scan result')
      }

      await admin.from('ai_scan_jobs').update({ status: 'completed' }).eq('id', jobId)

      res.status(200).json({ scanResultId: scanResult.id, parsedData: parsed })
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Unknown processing error'
      await admin.from('ai_scan_jobs').update({ status: 'failed', error_message: message }).eq('id', jobId)
      res.status(502).json({ error: message })
    }
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
