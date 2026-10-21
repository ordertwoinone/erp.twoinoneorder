import { addDays, format, isValid, parseISO } from 'date-fns'
import { AlertTriangle, Check, Loader2, Paperclip, Undo2, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import { VacationListEditor, type VacationEntry } from './VacationListEditor'

export interface LabourListRowState {
  itemId: string
  matchStatus: string
  reviewed: boolean
  passportNumber: string | null
  personName: string
  /** MOHRE person code (the long number under the name). */
  personCode: string | null
  cardType: string | null
  jobName: string | null
  nationality: string | null
  /** Work permit / labour card number. */
  cardNumber: string | null
  cardExpiry: string | null
  cardStatus: string | null
  contractType: string | null
  civilIdNumber: string | null
  matchReason: string | null
  isUncertain: boolean
  confidence: number
  matchedEmployeeId: string | null
  matchedEmployeeName: string | null
  matchedEmployeeCode: string | null
  /** The reviewer chose "add as new" instead of the suggested match. */
  forceNew: boolean
  employeeCode: string
  restaurantId: string
  emiratesIdExpiry: string
  medicalEntryDate: string
  lastInCountryDate: string
  finalStatus: string
  baseSalary: string
  labourFine: string
  settlementProofFile: File | null
  vacations: VacationEntry[]
  error: string | null
}

const MATCH_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' | 'outline' }> = {
  matched: { label: 'Existing', variant: 'secondary' },
  new: { label: 'New', variant: 'default' },
  uncertain: { label: 'Check match', variant: 'warning' },
  changed: { label: 'Changed', variant: 'warning' },
  ignored: { label: 'Ignored', variant: 'outline' },
}

const shortDate = (iso: string | null) => {
  const d = iso ? parseISO(iso) : null
  return d && isValid(d) ? format(d, 'd MMM yyyy') : null
}

export function LabourListReviewRow({
  row,
  restaurants,
  onChange,
  onConfirm,
  onIgnore,
  isConfirming,
}: {
  row: LabourListRowState
  restaurants: RestaurantOption[]
  onChange: (patch: Partial<LabourListRowState>) => void
  onConfirm: () => void
  onIgnore: () => void
  isConfirming: boolean
}) {
  const linked = row.matchedEmployeeId && !row.forceNew
  const meta = linked ? MATCH_META[row.matchStatus] ?? MATCH_META.matched : MATCH_META.new
  const expiry = shortDate(row.cardExpiry)

  function handleLastInCountryChange(value: string) {
    const patch: Partial<LabourListRowState> = { lastInCountryDate: value }
    if (value && !row.emiratesIdExpiry) {
      const parsed = parseISO(value)
      if (isValid(parsed)) {
        patch.emiratesIdExpiry = addDays(parsed, 27).toISOString().slice(0, 10)
      }
    }
    onChange(patch)
  }

  if (row.reviewed) {
    return (
      <TableRow className="opacity-60">
        <TableCell colSpan={13} className="text-sm text-muted-foreground">
          <Check className="mr-1.5 inline size-3.5 text-success" />
          {row.personName} — {row.matchStatus === 'ignored' ? 'ignored' : 'saved'}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className={linked && row.matchStatus === 'uncertain' ? 'bg-warning/5' : undefined}>
      <TableCell className="min-w-36 align-top">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {row.matchedEmployeeId && (
          <div className="mt-1 text-xs">
            {linked ? (
              <>
                <p className="font-medium">{row.matchedEmployeeName}</p>
                <p className="text-muted-foreground">
                  {row.matchedEmployeeCode} · by {row.matchReason ?? 'match'}
                </p>
                <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline" onClick={() => onChange({ forceNew: true })}>
                  <UserPlus className="size-3" /> Not them — add as new
                </button>
              </>
            ) : (
              <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => onChange({ forceNew: false })}>
                <Undo2 className="size-3" /> Use {row.matchedEmployeeName}
              </button>
            )}
          </div>
        )}
        {row.error && <p className="mt-1 max-w-52 text-xs whitespace-normal text-destructive">{row.error}</p>}
      </TableCell>
      <TableCell className="align-top font-mono text-xs whitespace-nowrap">{row.passportNumber ?? '—'}</TableCell>
      <TableCell className="min-w-56 align-top">
        <Input className="h-8 font-medium uppercase" value={row.personName} onChange={(e) => onChange({ personName: e.target.value })} aria-label="Name" />
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.personCode ?? '—'}</p>
        {row.isUncertain && (
          <Badge variant="outline" className="mt-1 gap-1 border-warning/40 text-warning-foreground">
            <AlertTriangle className="size-3" /> {row.confidence}% sure
          </Badge>
        )}
      </TableCell>
      <TableCell className="max-w-44 align-top text-xs">
        <p className="font-medium">{row.jobName ?? '—'}</p>
        <p className="text-muted-foreground">{row.cardType ?? ''}</p>
      </TableCell>
      <TableCell className="align-top text-xs">{row.nationality ?? '—'}</TableCell>
      <TableCell className="align-top text-xs whitespace-nowrap">
        <p className="font-mono">{row.cardNumber ?? '—'}</p>
        {expiry && <p className="text-muted-foreground">Exp. {expiry}</p>}
        {row.cardStatus && <p className="max-w-36 whitespace-normal text-warning-foreground">{row.cardStatus}</p>}
      </TableCell>
      <TableCell className="w-44 align-top">
        <Select value={row.restaurantId} onValueChange={(v) => onChange({ restaurantId: v })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Restaurant" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!linked && (
          <Input className="mt-1 h-8" placeholder="Code (auto EMP-…)" value={row.employeeCode} onChange={(e) => onChange({ employeeCode: e.target.value })} />
        )}
      </TableCell>
      <TableCell className="w-36 align-top">
        <Input type="date" className="h-8" value={row.lastInCountryDate} onChange={(e) => handleLastInCountryChange(e.target.value)} aria-label="Last in country" />
      </TableCell>
      <TableCell className="w-36 align-top">
        <Input type="date" className="h-8" value={row.emiratesIdExpiry} onChange={(e) => onChange({ emiratesIdExpiry: e.target.value })} aria-label="Emirates ID expiry" />
      </TableCell>
      <TableCell className="w-36 align-top">
        <Input type="date" className="h-8" value={row.medicalEntryDate} onChange={(e) => onChange({ medicalEntryDate: e.target.value })} aria-label="Medical entry" />
      </TableCell>
      <TableCell className="w-40 align-top">
        <Select value={row.finalStatus} onValueChange={(v) => onChange({ finalStatus: v })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Not decided" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="renew">Renew</SelectItem>
            <SelectItem value="cancel">Cancel</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" step="0.01" className="mt-1 h-8" placeholder="Salary" value={row.baseSalary} onChange={(e) => onChange({ baseSalary: e.target.value })} />
        <Input
          type="number"
          step="0.01"
          min="0"
          className="mt-1 h-8"
          placeholder="Labour fine (AED)"
          value={row.labourFine}
          onChange={(e) => onChange({ labourFine: e.target.value })}
        />
      </TableCell>
      <TableCell className="w-52 space-y-1.5 align-top">
        <VacationListEditor vacations={row.vacations} onChange={(vacations) => onChange({ vacations })} />
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 text-xs text-muted-foreground hover:bg-muted/50">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="truncate">{row.settlementProofFile?.name ?? 'Settlement proof'}</span>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onChange({ settlementProofFile: e.target.files?.[0] ?? null })} />
        </label>
      </TableCell>
      <TableCell className="w-28 align-top">
        <div className="flex flex-col gap-1">
          <Button size="sm" className="h-8" onClick={onConfirm} disabled={isConfirming || !row.restaurantId || !row.personName.trim()}>
            {isConfirming ? <Loader2 className="animate-spin" /> : <Check />}
            {linked ? 'Update' : 'Add'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onIgnore} disabled={isConfirming}>
            <X /> Ignore
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
