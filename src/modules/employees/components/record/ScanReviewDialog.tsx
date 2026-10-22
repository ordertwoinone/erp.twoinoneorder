import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { ArrowRight, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { EmployeeRecordInput } from '@/schemas/employee'
import type { ScannedEmployeeFields } from '../../hooks/useEmployeeRecord'
import { SCANNED_DOCUMENT_LABELS, scannedChanges, type ScanFieldChange } from '../../scanMapping'
import { useRecordLock } from './recordLockContext'

export interface ScanReview {
  key: string
  fileName: string
  fields: ScannedEmployeeFields
}

const show = (c: ScanFieldChange, v: string | number) => {
  if (v === '' || v === null || v === undefined) return '—'
  if (c.kind === 'date' && typeof v === 'string') return format(parseISO(v), 'd MMM yyyy')
  if (c.name === 'gender') return String(v).charAt(0).toUpperCase() + String(v).slice(1)
  return String(v)
}

/**
 * After a scan: what the document says next to what the record has, one
 * tick box per field. Apply writes the ticked values into the form; the user
 * then saves the record as usual. A locked record asks for the password first.
 */
export function ScanReviewDialog({
  form,
  review,
  remaining,
  onDone,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  review: ScanReview | undefined
  remaining: number
  onDone: () => void
}) {
  const lock = useRecordLock()
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [changes, setChanges] = useState<ScanFieldChange[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Work out the changes once per scanned document (state adjusted during render).
  if (review && review.key !== loadedKey) {
    const next = scannedChanges(review.fields, (name) => form.getValues(name))
    setLoadedKey(review.key)
    setChanges(next)
    setSelected(new Set(next.filter((c) => c.defaultOn).map((c) => c.name)))
  }

  const docLabel = review ? (SCANNED_DOCUMENT_LABELS[review.fields.document_type] ?? 'Document') : ''
  const toggle = (name: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(name)
      else next.delete(name)
      return next
    })

  function apply() {
    const picked = changes.filter((c) => selected.has(c.name))
    for (const c of picked) form.setValue(c.name, c.scanned as never, { shouldDirty: true })
    toast.success(`Updated ${picked.length} field${picked.length === 1 ? '' : 's'} from ${review?.fileName}`, {
      description: 'Click “Save changes” at the bottom to keep them.',
    })
    onDone()
  }

  const groups = [...new Set(changes.map((c) => c.group))]
  const allOn = changes.length > 0 && selected.size === changes.length

  return (
    <Dialog open={!!review} onOpenChange={(open) => !open && onDone()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" /> Review scanned details
          </DialogTitle>
          <DialogDescription>
            {review?.fileName} — read as <b>{docLabel}</b>
            {review && review.fields.confidence < 70 && <span className="text-warning-foreground"> · low confidence ({review.fields.confidence}%), check each value</span>}
            {remaining > 0 && <> · {remaining} more file{remaining === 1 ? '' : 's'} after this</>}
          </DialogDescription>
        </DialogHeader>

        {changes.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nothing new on this document — the record already has the same details.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <Checkbox
                      checked={allOn}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(changes.map((c) => c.name)) : new Set())}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Field</th>
                  <th className="px-3 py-2 text-left font-semibold">On record now</th>
                  <th className="w-6" />
                  <th className="px-3 py-2 text-left font-semibold">From document</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <GroupRows key={group} group={group} changes={changes.filter((c) => c.group === group)} selected={selected} onToggle={toggle} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground sm:self-center">
            Unticked: name / position / sponsor already on the record are kept unless you tick them.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDone}>
              {changes.length ? 'Skip' : 'Close'}
            </Button>
            {changes.length > 0 && (
              <Button
                type="button"
                disabled={selected.size === 0}
                onClick={() => (lock.isUnlocked('personal') ? apply() : lock.requestUnlock('all', apply))}
              >
                Apply {selected.size} change{selected.size === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupRows({
  group,
  changes,
  selected,
  onToggle,
}: {
  group: string
  changes: ScanFieldChange[]
  selected: Set<string>
  onToggle: (name: string, on: boolean) => void
}) {
  return (
    <>
      <tr className="border-t bg-muted/20">
        <td colSpan={5} className="px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {group}
        </td>
      </tr>
      {changes.map((c) => (
        <tr key={c.name} className="border-t">
          <td className="px-3 py-1.5">
            <Checkbox checked={selected.has(c.name)} onCheckedChange={(v) => onToggle(c.name, v === true)} aria-label={`Update ${c.label}`} />
          </td>
          <td className="px-3 py-1.5 font-medium">{c.label}</td>
          <td className="px-3 py-1.5 text-muted-foreground">{show(c, c.current)}</td>
          <td className="text-muted-foreground">
            <ArrowRight className="size-3.5" />
          </td>
          <td className={selected.has(c.name) ? 'px-3 py-1.5 font-medium text-primary' : 'px-3 py-1.5'}>{show(c, c.scanned)}</td>
        </tr>
      ))}
    </>
  )
}
