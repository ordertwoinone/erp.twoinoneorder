import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import { Eye, Plus, Search, User, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { EmployeeRecordInput, ReplacementRow } from '@/schemas/employee'
import { REPLACEMENT_AVAILABILITY } from '../../employeeOptions'
import { searchEmployees } from '../../hooks/useEmployeeRecord'
import { Field, OptionSelect, SectionCard } from './RecordUi'

type Match = Awaited<ReturnType<typeof searchEmployees>>[number]

function availabilityDisplay(row: ReplacementRow): { text: string; dot: string } {
  if (row.availability === 'available_from' && row.available_from) {
    const date = parseISO(row.available_from)
    const days = isValid(date) ? differenceInCalendarDays(date, new Date()) : 0
    if (days > 0) return { text: `${days} day${days === 1 ? '' : 's'}`, dot: 'bg-warning' }
    return { text: 'Available now', dot: 'bg-success' }
  }
  if (row.availability === 'interview_pending') return { text: 'Interview pending', dot: 'bg-muted-foreground' }
  if (row.availability === 'not_available') return { text: 'Not available', dot: 'bg-destructive' }
  return { text: 'Available now', dot: 'bg-success' }
}

const emptyCandidate: ReplacementRow = {
  candidate_name: '',
  position: '',
  source: 'Candidate pool',
  availability: 'interview_pending',
  available_from: '',
  notes: '',
  replacement_employee_id: null,
}

export function ReplacementsSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const navigate = useNavigate()
  const { control, getValues } = form
  const { fields, append, remove, update } = useFieldArray({ control, name: 'replacements' })

  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedValue(term, 250)
  const [matches, setMatches] = useState<Match[]>([])
  const [editing, setEditing] = useState<{ index: number | null; row: ReplacementRow } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!debouncedTerm.trim()) return
    searchEmployees(debouncedTerm, getValues('id'))
      .then((found) => !cancelled && setMatches(found))
      .catch(() => !cancelled && setMatches([]))
    return () => {
      cancelled = true
    }
  }, [debouncedTerm, getValues])

  function addEmployee(match: Match) {
    const alreadyAdded = getValues('replacements').some((r) => r.replacement_employee_id === match.id)
    if (!alreadyAdded) {
      append({
        replacement_employee_id: match.id,
        candidate_name: match.full_name,
        position: match.job_title ?? '',
        source: match.restaurants?.name ?? '',
        availability: 'available_now',
        available_from: '',
        notes: '',
      })
    }
    setTerm('')
    setMatches([])
  }

  function saveCandidate() {
    if (!editing || !editing.row.candidate_name?.trim()) return
    if (editing.index === null) append(editing.row)
    else update(editing.index, editing.row)
    setEditing(null)
  }

  return (
    <SectionCard
      icon={Users}
      title="Potential replacements"
      actions={
        <div className="flex flex-wrap gap-2">
          <Popover open={matches.length > 0} onOpenChange={(open) => !open && setMatches([])}>
            <PopoverAnchor asChild>
              <div className="relative w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-10 pl-9" placeholder="Search employees or candidates" value={term}
                  onChange={(e) => {
                    setTerm(e.target.value)
                    if (!e.target.value.trim()) setMatches([])
                  }}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent align="start" className="w-72 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addEmployee(m)}
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[m.job_title, m.restaurants?.name].filter(Boolean).join(' · ') || m.employee_code}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" className="border-primary text-primary" onClick={() => setEditing({ index: null, row: { ...emptyCandidate } })}>
            <Plus /> Add replacement
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Branch / source</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="w-32">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                  No replacements shortlisted. Search your staff or add an outside candidate.
                </TableCell>
              </TableRow>
            )}
            {fields.map((row, index) => {
              const availability = availabilityDisplay(row)
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <User className="size-4 text-primary" />
                      {row.candidate_name}
                    </span>
                  </TableCell>
                  <TableCell>{row.position || '—'}</TableCell>
                  <TableCell>{row.source || '—'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={cn('size-2.5 rounded-full', availability.dot)} />
                      {availability.text}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-primary"
                        onClick={() =>
                          row.replacement_employee_id
                            ? navigate(`/employees/${row.replacement_employee_id}`)
                            : setEditing({ index, row: getValues(`replacements.${index}`) })
                        }
                      >
                        <Eye /> View
                      </Button>
                      <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive" aria-label="Remove replacement">
                        <X className="size-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.index === null ? 'Add replacement candidate' : 'Replacement candidate'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <Field label="Name">
                <Input value={editing.row.candidate_name ?? ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, candidate_name: e.target.value } })} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Position">
                  <Input value={editing.row.position ?? ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, position: e.target.value } })} />
                </Field>
                <Field label="Branch / source">
                  <Input value={editing.row.source ?? ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, source: e.target.value } })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Availability">
                  <OptionSelect
                    value={editing.row.availability}
                    onChange={(v) => setEditing({ ...editing, row: { ...editing.row, availability: v } })}
                    options={REPLACEMENT_AVAILABILITY}
                    placeholder="Select"
                  />
                </Field>
                {editing.row.availability === 'available_from' && (
                  <Field label="Available from">
                    <Input
                      type="date"
                      value={editing.row.available_from ?? ''}
                      onChange={(e) => setEditing({ ...editing, row: { ...editing.row, available_from: e.target.value } })}
                    />
                  </Field>
                )}
              </div>
              <Field label="Notes">
                <Textarea value={editing.row.notes ?? ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, notes: e.target.value } })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCandidate} disabled={!editing?.row.candidate_name?.trim()}>
              {editing?.index === null ? 'Add' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
