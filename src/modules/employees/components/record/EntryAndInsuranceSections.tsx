import { useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { CalendarDays, CircleDollarSign, Clock, Paperclip, PlaneLanding, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import { INITIAL_VISA_TYPES, INSURANCE_STATUSES } from '../../employeeOptions'
import { openEmployeeFile } from '../../hooks/useEmployeeRecord'
import { Field, FileChip, IconInput, OptionSelect, SectionCard, SegmentedToggle } from './RecordUi'

/** "Expired · 4 days overdue" / "12 days left" badge for a date field. */
export function ExpiryBadge({ date }: { date: string | undefined }) {
  const parsed = date ? parseISO(date) : null
  if (!parsed || !isValid(parsed)) return null
  const days = differenceInCalendarDays(parsed, new Date())
  const tone = days < 0 ? 'expired' : days <= 30 ? 'soon' : 'ok'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tone === 'expired' && 'border-destructive/30 bg-destructive/10 text-destructive',
        tone === 'soon' && 'border-warning/40 bg-warning/15 text-warning-foreground',
        tone === 'ok' && 'border-success/30 bg-success/10 text-success',
      )}
    >
      {days < 0 ? `Expired · ${Math.abs(days)} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
    </span>
  )
}

export function EntrySection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { register, control, watch, formState } = form
  const initialType = watch('initial_visa_type')
  const entryDate = watch('entry_date')
  const stay = watch('allowed_stay_days')

  const entry = entryDate ? parseISO(entryDate) : null
  const stayExpiry = entry && isValid(entry) && stay !== '' && stay !== undefined ? format(addDays(entry, Number(stay)), 'yyyy-MM-dd') : ''

  return (
    <SectionCard icon={PlaneLanding} title="Basic information · entry & initial visa">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Initial visa type" className="lg:col-span-2">
          <Controller
            control={control}
            name="initial_visa_type"
            render={({ field }) => (
              <div className="grid h-10 grid-cols-3 rounded-lg border bg-muted/40 p-0.5">
                {INITIAL_VISA_TYPES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => field.onChange(field.value === o.value ? '' : o.value)}
                    className={cn(
                      'rounded-md text-sm font-medium transition-colors',
                      field.value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>
        <Field label="Entry date">
          <IconInput icon={CalendarDays} type="date" {...register('entry_date')} />
        </Field>
        <Field label="Allowed stay (days)" error={formState.errors.allowed_stay_days?.message}>
          <IconInput icon={Clock} type="number" min="0" step="1" placeholder={initialType === 'visit_visa' ? 'e.g. 30 / 60' : 'Days'} {...register('allowed_stay_days')} />
        </Field>
        <Field label={<span className="flex items-center gap-2">Stay expires on <ExpiryBadge date={stayExpiry} /></span>}>
          <IconInput icon={CalendarDays} value={stayExpiry ? format(parseISO(stayExpiry), 'd MMM yyyy') : 'Entry date + allowed stay'} disabled readOnly />
        </Field>
      </div>
    </SectionCard>
  )
}

export function InsuranceSection({
  form,
  insuranceDocs,
  onAttach,
  onRemoveDoc,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  insuranceDocs: EmployeeDocumentItem[]
  onAttach: (files: File[]) => void
  onRemoveDoc: (key: string) => void
}) {
  const { register, control, watch, formState } = form
  const inputRef = useRef<HTMLInputElement>(null)
  const applicable = watch('insurance_applicable')
  const fineApplicable = watch('insurance_fine_applicable')

  return (
    <SectionCard icon={ShieldCheck} title="Health & employment insurance">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={<span className="flex items-center gap-2">Health insurance expiry <ExpiryBadge date={watch('health_insurance_expiry')} /></span>}>
          <IconInput icon={CalendarDays} type="date" {...register('health_insurance_expiry')} />
        </Field>
        <Field label="Employment (ILOE) insurance applicable?">
          <Controller
            control={control}
            name="insurance_applicable"
            render={({ field }) => (
              <SegmentedToggle value={field.value} onChange={field.onChange} options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
            )}
          />
        </Field>
        {applicable && (
          <>
            <Field label="Start date">
              <IconInput icon={CalendarDays} type="date" {...register('insurance_start_date')} />
            </Field>
            <Field label={<span className="flex items-center gap-2">Expiry date <ExpiryBadge date={watch('insurance_expiry_date')} /></span>}>
              <IconInput icon={CalendarDays} type="date" {...register('insurance_expiry_date')} />
            </Field>
            <Field label="Fine?">
              <Controller
                control={control}
                name="insurance_fine_applicable"
                render={({ field }) => (
                  <SegmentedToggle value={field.value} onChange={field.onChange} options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
                )}
              />
            </Field>
            <Field label="Fine amount (AED)" error={formState.errors.insurance_fine_amount?.message}>
              <IconInput
                icon={CircleDollarSign}
                type="number"
                step="0.01"
                min="0"
                placeholder={fineApplicable ? '0.00' : 'No fine'}
                disabled={!fineApplicable}
                {...register('insurance_fine_amount')}
              />
            </Field>
            <Field label="Status">
              <Controller
                control={control}
                name="insurance_status"
                render={({ field }) => (
                  <OptionSelect value={field.value} onChange={field.onChange} options={INSURANCE_STATUSES} placeholder="Select status" />
                )}
              />
            </Field>
            <Field label="Insurance document">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
              >
                <Paperclip className="size-4 shrink-0 text-primary" />
                <span className="flex-1 truncate">Attach policy / certificate</span>
                <Plus className="size-4 text-primary" />
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) onAttach(files)
                  e.target.value = ''
                }}
              />
            </Field>
          </>
        )}
      </div>
      {applicable && insuranceDocs.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {insuranceDocs.map((d) => (
            <FileChip
              key={d.key}
              name={d.file_name}
              size={d.file_size_bytes}
              pending={!!d.pending_file}
              onOpen={d.storage_path ? () => openEmployeeFile(d.storage_path!) : undefined}
              onRemove={() => onRemoveDoc(d.key)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  )
}
