import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'
import { requireUserWithPermission, AuthError } from './_lib/auth'
import { extractFromImageOrPdf } from './_lib/extractLabourList'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await requireUserWithPermission(req.headers.authorization, 'employees.manage')

    const { importId } = req.body as { importId?: string }
    if (!importId) {
      res.status(400).json({ error: 'importId is required' })
      return
    }

    const admin = getSupabaseAdmin()

    const { data: job, error: jobError } = await admin
      .from('labour_list_imports')
      .select('*, attachments:attachment_id(storage_bucket, storage_path, mime_type, file_name)')
      .eq('id', importId)
      .single()

    if (jobError || !job) {
      res.status(404).json({ error: 'Labour list import not found' })
      return
    }
    if (job.status !== 'queued') {
      res.status(409).json({ error: `Import is already ${job.status}` })
      return
    }

    const attachment = (job as any).attachments as {
      storage_bucket: string
      storage_path: string
      mime_type: string
      file_name: string
    } | null
    if (!attachment) {
      res.status(400).json({ error: 'Import has no attached file' })
      return
    }

    await admin.from('labour_list_imports').update({ status: 'processing' }).eq('id', importId)

    try {
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from(attachment.storage_bucket)
        .download(attachment.storage_path)
      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || 'Failed to download the uploaded file')
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { parsed } = await extractFromImageOrPdf(buffer.toString('base64'), attachment.mime_type, attachment.file_name)

      // Match each extracted person against existing employees by Emirates
      // ID (exact) first, falling back to an exact name match — anything
      // else is 'new' or 'uncertain' rather than guessed.
      const civilIds = parsed.items.map((i) => i.civil_id_number).filter((v): v is string => !!v)
      const names = parsed.items.map((i) => i.person_name).filter(Boolean)

      const [byId, byName] = await Promise.all([
        civilIds.length > 0
          ? admin.from('employees').select('id, emirates_id, full_name').in('emirates_id', civilIds)
          : Promise.resolve({ data: [] as { id: string; emirates_id: string | null; full_name: string }[] }),
        names.length > 0
          ? admin.from('employees').select('id, emirates_id, full_name').in('full_name', names)
          : Promise.resolve({ data: [] as { id: string; emirates_id: string | null; full_name: string }[] }),
      ])

      const rows = parsed.items.map((item) => {
        const idMatch = item.civil_id_number ? byId.data?.find((e) => e.emirates_id === item.civil_id_number) : undefined
        const nameMatch = byName.data?.find((e) => e.full_name.toLowerCase() === item.person_name.toLowerCase())
        const matched = idMatch ?? nameMatch
        const matchStatus: 'matched' | 'uncertain' | 'new' = matched ? (idMatch ? 'matched' : 'uncertain') : 'new'
        return {
          labour_list_import_id: importId,
          matched_employee_id: matched?.id ?? null,
          match_status: matchStatus,
          extracted_data: item as never,
          confidence_score: item.confidence,
        }
      })

      const { error: insertError } = await admin.from('labour_list_import_items').insert(rows)
      if (insertError) throw insertError

      await admin.from('labour_list_imports').update({ status: 'completed' }).eq('id', importId)

      res.status(200).json({ itemCount: rows.length })
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Unknown processing error'
      await admin.from('labour_list_imports').update({ status: 'failed' }).eq('id', importId)
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
