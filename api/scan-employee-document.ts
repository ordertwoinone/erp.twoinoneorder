import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUserWithPermission, AuthError } from './_lib/auth.js'
import { extractFromImageOrPdf } from './_lib/extractEmployeeDocument.js'

const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

/**
 * Reads an already-uploaded employee document and returns the fields it
 * contains, for the Employee Details page to pre-fill. Nothing is saved
 * here — the user reviews the values and saves the record themselves.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { client } = await requireUserWithPermission(req.headers.authorization, 'employees.manage')

    const { storagePath, mimeType } = req.body as { storagePath?: string; mimeType?: string }
    if (!storagePath || !mimeType) {
      res.status(400).json({ error: 'storagePath and mimeType are required' })
      return
    }
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: 'Unsupported file type. Upload a PDF or image (JPG/PNG/WebP).' })
      return
    }

    // Downloaded with the caller's own session, so storage RLS decides
    // whether they may read it (branch access via the path's first segment).
    const { data: fileBlob, error: downloadError } = await client.storage.from('employee-documents').download(storagePath)
    if (downloadError || !fileBlob) {
      res.status(404).json({ error: downloadError?.message || 'File not found or not accessible' })
      return
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer())
    const { parsed } = await extractFromImageOrPdf(buffer.toString('base64'), mimeType)

    res.status(200).json({ fields: parsed })
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('scan-employee-document failed', message)
    res.status(502).json({ error: message })
  }
}
