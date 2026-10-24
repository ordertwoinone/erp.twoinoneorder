import { useEffect, useMemo } from 'react'
import { useSignedFileUrl } from './useEmployeeRecord'

/** A picked-but-unsaved file's preview, else the saved file's signed URL. */
export function useFilePreview(pending: unknown, savedPath: string | null | undefined) {
  const pendingUrl = useMemo(() => (pending instanceof File ? URL.createObjectURL(pending) : null), [pending])
  useEffect(() => () => void (pendingUrl && URL.revokeObjectURL(pendingUrl)), [pendingUrl])
  const { data: savedUrl } = useSignedFileUrl(pendingUrl ? null : savedPath)
  return pendingUrl ?? savedUrl ?? null
}
