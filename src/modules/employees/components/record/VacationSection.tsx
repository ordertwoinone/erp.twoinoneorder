import type { UseFormReturn } from 'react-hook-form'
import { Controller, useFieldArray } from 'react-hook-form'
import { CalendarDays, CircleDollarSign, Paperclip, Plane, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { TICKET_CLAIM_STATUSES, TICKET_PAID_BY } from '../../employeeOptions'
import { openEmployeeFile, validateDocumentFile } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, OptionSelect, SectionCard, SegmentedToggle } from './RecordUi'

const CLAIM_STYLES: Record<string, string> = {
  claimed: 'border-success/30 bg-success/10 text-success-foreground',
  not_claimed: 'border-warning/40 bg-warning/15 text-warning-foreground',
  pending: 'border-primary/30 bg-primary/10 text-primary',
}

export function VacationSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, setValue } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'vacations' })
  const claimed = watch('flight_ticket_claimed')

  return (
    <SectionCard icon={Plane} title="Vacation & flight tickets">
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,20rem)_auto]">
        <Field label="Flight ticket claimed?">
          <Controller
            control={control}
            name="flight_ticket_claimed"
            render={({ field }) => (
              <SegmentedToggle
                value={field.value}
                onChange={field.onChange}
                options={[
                  { label: 'Claimed', value: true },
                  { label: 'Not claimed', value: false },
                ]}
              />
            )}
          />
        </Field>
        <Field label="Ticket entitlement status">
          <span
            className={cn(
              'inline-flex h-10 w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium',
              claimed ? 'bg-muted/50 text-muted-foreground' : 'border-success/30 bg-success/10 text-success-foreground',
            )}
          >
            <span className={cn('size-2.5 rounded-full', claimed ? 'bg-muted-foreground' : 'bg-success')} />
            {claimed ? 'Used' : 'Available'}
          </span>
        </Field>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Vacation history</h3>
        <Button
          type="button"
          variant="outline"
          className="border-primary text-primary"
          onClick={() => append({ start_date: '', end_date: '', paid_by: 'company', amount: '', ticket_claim_status: '', attachment_id: null })}
        >
          <Plus /> Add vacation
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Vacation start</TableHead>
              <TableHead>Vacation end</TableHead>
              <TableHead>Flight ticket paid by</TableHead>
              <TableHead>Ticket value (AED)</TableHead>
              <TableHead>Ticket claim status</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">
                  No vacations recorded yet.
                </TableCell>
              </TableRow>
            )}
            {fields.map((row, index) => {
              const status = watch(`vacations.${index}.ticket_claim_status`)
              const pendingFile = watch(`vacations.${index}.pending_file`) as File | undefined
              const attachmentName = watch(`vacations.${index}.attachment_name`)
              const attachmentPath = watch(`vacations.${index}.attachment_path`)
              const startError = form.formState.errors.vacations?.[index]?.start_date?.message
              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-40">
                    <IconInput icon={CalendarDays} type="date" aria-invalid={!!startError} {...register(`vacations.${index}.start_date`)} />
                    {startError && <p className="mt-1 text-xs text-destructive">{startError}</p>}
                  </TableCell>
                  <TableCell className="min-w-40">
                    <IconInput icon={CalendarDays} type="date" {...register(`vacations.${index}.end_date`)} />
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Controller
                      control={control}
                      name={`vacations.${index}.paid_by`}
                      render={({ field }) => (
                        <OptionSelect value={field.value} onChange={field.onChange} options={TICKET_PAID_BY} placeholder="Paid by" />
                      )}
                    />
                  </TableCell>
                  <TableCell className="min-w-36">
                    <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="Enter amount" {...register(`vacations.${index}.amount`)} />
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Controller
                      control={control}
                      name={`vacations.${index}.ticket_claim_status`}
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger className={cn('h-10 w-full', status && CLAIM_STYLES[status])}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {TICKET_CLAIM_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </TableCell>
                  <TableCell className="min-w-40">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Paperclip className="size-4 shrink-0 text-primary" />
                      {pendingFile || attachmentName ? (
                        <span
                          className="max-w-36 truncate text-primary hover:underline"
                          onClick={(e) => {
                            if (attachmentPath && !pendingFile) {
                              e.preventDefault()
                              openEmployeeFile(attachmentPath)
                            }
                          }}
                        >
                          {pendingFile?.name ?? attachmentName}
                        </span>
                      ) : (
                        <span className="text-primary">Attach</span>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (!file) return
                          const problem = validateDocumentFile(file)
                          if (problem) return void toast.error(problem)
                          setValue(`vacations.${index}.pending_file`, file, { shouldDirty: true })
                        }}
                      />
                    </label>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive" aria-label="Remove vacation">
                      <X className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}
