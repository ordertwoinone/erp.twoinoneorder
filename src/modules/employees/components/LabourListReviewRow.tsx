import { addDays, isValid, parseISO } from 'date-fns'
import { AlertTriangle, Check, Loader2, Paperclip, X } from 'lucide-react'
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
  personNumber: string | null
  personName: string
  jobType: string | null
  jobName: string | null
  nationality: string | null
  civilIdNumber: string | null
  contractType: string | null
  isUncertain: boolean
  confidence: number
  matchedEmployeeId: string | null
  matchedEmployeeName: string | null
  employeeCode: string
  restaurantId: string
  emiratesIdExpiry: string
  medicalEntryDate: string
  lastInCountryDate: string
  finalStatus: string
  baseSalary: string
  settlementProofFile: File | null
  vacations: VacationEntry[]
}

const MATCH_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' | 'outline' }> = {
  matched: { label: 'Matched', variant: 'secondary' },
  new: { label: 'New', variant: 'default' },
  uncertain: { label: 'Uncertain match', variant: 'warning' },
  changed: { label: 'Changed', variant: 'warning' },
  ignored: { label: 'Ignored', variant: 'outline' },
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
  const meta = MATCH_META[row.matchStatus] ?? MATCH_META.new

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
          <Check className="mr-1.5 inline size-3.5 text-success-foreground" />
          {row.personName} — confirmed
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className={row.matchStatus === 'uncertain' ? 'bg-warning/5' : undefined}>
      <TableCell>
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {row.matchedEmployeeName && <p className="mt-1 text-xs text-muted-foreground">{row.matchedEmployeeName}</p>}
      </TableCell>
      <TableCell className="max-w-32 truncate">{row.personNumber ?? '—'}</TableCell>
      <TableCell className="max-w-40">
        <p className="truncate font-medium">{row.personName}</p>
        {row.isUncertain && (
          <Badge variant="outline" className="mt-1 gap-1 border-warning/40 text-warning-foreground">
            <AlertTriangle className="size-3" /> {row.confidence}%
          </Badge>
        )}
      </TableCell>
      <TableCell className="max-w-32 truncate text-sm text-muted-foreground">{row.jobName ?? row.jobType ?? '—'}</TableCell>
      <TableCell className="max-w-28 truncate text-sm text-muted-foreground">{row.nationality ?? '—'}</TableCell>
      <TableCell className="max-w-32 truncate text-sm text-muted-foreground">{row.civilIdNumber ?? '—'}</TableCell>
      <TableCell className="w-40">
        <Select value={row.restaurantId} onValueChange={(v) => onChange({ restaurantId: v })}>
          <SelectTrigger className="h-8">
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
        {!row.matchedEmployeeId && (
          <Input
            className="mt-1 h-8"
            placeholder="Employee code"
            value={row.employeeCode}
            onChange={(e) => onChange({ employeeCode: e.target.value })}
          />
        )}
      </TableCell>
      <TableCell className="w-36">
        <Input
          type="date"
          className="h-8"
          value={row.lastInCountryDate}
          onChange={(e) => handleLastInCountryChange(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-36">
        <Input type="date" className="h-8" value={row.emiratesIdExpiry} onChange={(e) => onChange({ emiratesIdExpiry: e.target.value })} />
      </TableCell>
      <TableCell className="w-36">
        <Input type="date" className="h-8" value={row.medicalEntryDate} onChange={(e) => onChange({ medicalEntryDate: e.target.value })} />
      </TableCell>
      <TableCell className="w-40">
        <Select value={row.finalStatus} onValueChange={(v) => onChange({ finalStatus: v })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Not decided" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="renew">Renew</SelectItem>
            <SelectItem value="cancel">Cancel</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          className="mt-1 h-8"
          placeholder="Salary"
          value={row.baseSalary}
          onChange={(e) => onChange({ baseSalary: e.target.value })}
        />
      </TableCell>
      <TableCell className="w-52 space-y-1.5">
        <VacationListEditor vacations={row.vacations} onChange={(vacations) => onChange({ vacations })} />
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 text-xs text-muted-foreground hover:bg-muted/50">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="truncate">{row.settlementProofFile?.name ?? 'Settlement proof'}</span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => onChange({ settlementProofFile: e.target.files?.[0] ?? null })}
          />
        </label>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex flex-col gap-1">
          <Button size="sm" className="h-8" onClick={onConfirm} disabled={isConfirming || !row.restaurantId}>
            {isConfirming ? <Loader2 className="animate-spin" /> : <Check />}
            Confirm
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onIgnore} disabled={isConfirming}>
            <X /> Ignore
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
