import { useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { BookUser, BriefcaseBusiness, CalendarDays, CircleDollarSign, Globe, Hash, Paperclip, TrendingDown, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import { NATIONALITIES } from '../../employeeOptions'
import { openEmployeeFile } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, SectionCard } from './RecordUi'

export function PassportSection({
  form,
  passportDocs,
  onAttachPassport,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  passportDocs: EmployeeDocumentItem[]
  onAttachPassport: (files: File[]) => void
}) {
  const { register, control } = form
  const inputRef = useRef<HTMLInputElement>(null)
  const latest = passportDocs[passportDocs.length - 1]

  return (
    <SectionCard icon={BookUser} title="Passport details">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Passport number">
          <IconInput icon={Hash} placeholder="e.g. N12345678" {...register('passport_number')} />
        </Field>
        <Field label="Passport issue date">
          <IconInput icon={CalendarDays} type="date" {...register('passport_issue_date')} />
        </Field>
        <Field label="Passport expiry date">
          <IconInput icon={CalendarDays} type="date" {...register('passport_expiry_date')} />
        </Field>
        <Field label="Nationality">
          <Controller
            control={control}
            name="nationality"
            render={({ field }) => (
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="h-10 w-full pl-9">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {NATIONALITIES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </Field>
        <Field label="Passport copy">
          <div className="flex h-10 items-center gap-2 rounded-md border bg-primary/5 px-3 text-sm">
            <Paperclip className="size-4 shrink-0 text-primary" />
            {latest ? (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-medium"
                onClick={latest.storage_path ? () => openEmployeeFile(latest.storage_path!) : undefined}
              >
                {latest.file_name}
              </button>
            ) : (
              <span className="flex-1 text-muted-foreground">No copy yet</span>
            )}
            <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={() => inputRef.current?.click()}>
              {latest ? 'Replace' : 'Attach passport'}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) onAttachPassport(files)
                e.target.value = ''
              }}
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  )
}

export function EmploymentSalarySection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { register, watch, formState } = form
  const current = Number(watch('base_salary')) || 0
  const renewal = watch('renewal_salary')
  const hasChange = renewal !== '' && renewal !== undefined && current > 0
  const change = hasChange ? Number(renewal) - current : 0

  return (
    <SectionCard icon={BriefcaseBusiness} title="Employment & salary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Position">
          <Input className="h-10" placeholder="e.g. Grill Chef" {...register('job_title')} />
        </Field>
        <Field label="Current salary (AED / month)" error={formState.errors.base_salary?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('base_salary')} />
        </Field>
        <Field label="Renewal salary (AED / month)" error={formState.errors.renewal_salary?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('renewal_salary')} />
        </Field>
        <Field label="Salary change">
          <div
            className={cn(
              'flex h-10 items-center gap-2 rounded-md px-3 text-base font-semibold',
              !hasChange && 'bg-muted/40 text-sm font-normal text-muted-foreground',
              hasChange && change >= 0 && 'bg-primary/5 text-primary',
              hasChange && change < 0 && 'bg-destructive/10 text-destructive',
            )}
          >
            {hasChange ? (
              <>
                {change >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
                {change >= 0 ? '+' : '−'} {formatCurrency(Math.abs(change))} / month
              </>
            ) : (
              'Enter both salaries'
            )}
          </div>
        </Field>
      </div>
    </SectionCard>
  )
}
