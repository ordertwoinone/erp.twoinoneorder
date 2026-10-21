import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { requireUserWithPermission, AuthError } from './_lib/auth.js'
import { extractFromImageOrPdf } from './_lib/extractLabourList.js'
import { matchEmployee } from './_lib/matchEmployee.js'

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

      // Match each person to an existing employee: passport / MOHRE person code /
      // work permit number / Emirates ID first (sure), then a loose name match
      // (marked uncertain for review). Unmatched people are new.
      const { data: employees, error: employeesError } = await admin
        .from('employees')
        .select('id, full_name, passport_number, labour_person_number, work_permit_number, emirates_id')
        .range(0, 9999)
      if (employeesError) throw new Error(`Loading employees failed: ${employeesError.message}`)

      const claimed = new Set<string>()
      const rows = parsed.items
        .filter((item) => item.person_name?.trim())
        .map((item) => {
          // One employee can only be matched once per list.
          const match = matchEmployee(item, (employees ?? []).filter((e) => !claimed.has(e.id)))
          if (match) claimed.add(match.employee.id)
          return {
            labour_list_import_id: importId,
            matched_employee_id: match?.employee.id ?? null,
            match_status: match?.status ?? ('new' as const),
            extracted_data: { ...item, match_reason: match?.reason ?? null } as never,
            confidence_score: item.confidence,
          }
        })
      if (rows.length === 0) throw new Error('No employees could be read from this file. Check it is a MOHRE List of Employees and try again.')

      const { error: insertError } = await admin.from('labour_list_import_items').insert(rows)
      if (insertError) throw new Error(`Saving scanned rows failed: ${insertError.message}`)

      await admin.from('labour_list_imports').update({ status: 'completed' }).eq('id', importId)

      res.status(200).json({ itemCount: rows.length, expectedCount: parsed.total_employees ?? null })
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Unknown processing error'
      console.error('scan-labour-list processing failed', { importId, message })
      await admin.from('labour_list_imports').update({ status: 'failed' }).eq('id', importId)
      res.status(502).json({ error: message })
    }
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('scan-labour-list failed', message)
    res.status(500).json({ error: message })
  }
}
