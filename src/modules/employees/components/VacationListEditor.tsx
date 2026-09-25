import { Plane, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface VacationEntry {
  start_date: string
  end_date: string
  paid_by: string
  amount: string
  notes: string
}

export const emptyVacationEntry: VacationEntry = { start_date: '', end_date: '', paid_by: '', amount: '', notes: '' }

export function VacationListEditor({
  vacations,
  onChange,
}: {
  vacations: VacationEntry[]
  onChange: (vacations: VacationEntry[]) => void
}) {
  function updateEntry(index: number, patch: Partial<VacationEntry>) {
    onChange(vacations.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8">
          <Plane className="size-3.5" />
          Vacations
          {vacations.length > 0 && <Badge variant="secondary">{vacations.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="start">
        <p className="text-sm font-medium">Vacation listing</p>
        {vacations.length === 0 && <p className="text-xs text-muted-foreground">No vacations added yet.</p>}
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {vacations.map((v, index) => (
            <div key={index} className="space-y-2 rounded-md border p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Start</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={v.start_date}
                    onChange={(e) => updateEntry(index, { start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">End</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={v.end_date}
                    onChange={(e) => updateEntry(index, { end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Paid by</Label>
                  <Select value={v.paid_by} onValueChange={(val) => updateEntry(index, { paid_by: val })}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Who paid" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="shared">Shared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Value (AED)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8"
                    value={v.amount}
                    onChange={(e) => updateEntry(index, { amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Notes</Label>
                  <Input className="h-8" value={v.notes} onChange={(e) => updateEntry(index, { notes: e.target.value })} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onChange(vacations.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...vacations, { ...emptyVacationEntry }])}>
          <Plus /> Add vacation
        </Button>
      </PopoverContent>
    </Popover>
  )
}
