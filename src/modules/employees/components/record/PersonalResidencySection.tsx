import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { CalendarDays, FileBadge, Hash, Mail, MapPin, Phone, ScanLine, Smartphone, UserRound } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { GENDERS, MARITAL_STATUSES } from '../../employeeOptions'
import { ExpiryBadge } from './EntryAndInsuranceSections'
import { Field, IconInput, OptionSelect, SectionCard } from './RecordUi'

/**
 * Residency, personal, passport-extra and contact details — what an ICP /
 * GDRFA residency record shows. Usually filled by "Scan document".
 */
export function PersonalResidencySection({ form, onScan }: { form: UseFormReturn<EmployeeRecordInput>; onScan: () => void }) {
  const { register, control, watch } = form

  return (
    <SectionCard icon={UserRound} title="Personal & residency details" lockKey="personal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Scan the employee’s residency record, passport or Emirates ID to fill these in.</span>
        {/* Not a <button>: a locked section disables its buttons, but scanning only reads the
            file — applying the result asks for the password. */}
        <span
          role="button"
          tabIndex={0}
          onClick={onScan}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onScan()
            }
          }}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer')}
        >
          <ScanLine /> Scan document
        </span>
      </div>

      <h3 className="mb-2 text-sm font-semibold">Residency</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Residency type">
          <IconInput icon={FileBadge} placeholder="e.g. Residency - Work - Private Sector" {...register('residency_type')} />
        </Field>
        <Field label="Residency file number">
          <IconInput icon={Hash} placeholder="e.g. 301/2024/2/184836" {...register('residency_file_number')} />
        </Field>
        <Field label="Unified number (UID)">
          <IconInput icon={Hash} placeholder="Emirate unified number" {...register('unified_number')} />
        </Field>
        <Field label="Residency issue date">
          <IconInput icon={CalendarDays} type="date" {...register('residency_issue_date')} />
        </Field>
        <Field label={<span className="flex items-center gap-2">Residency expiry date <ExpiryBadge date={watch('visa_expiry')} /></span>}>
          <IconInput icon={CalendarDays} type="date" {...register('visa_expiry')} />
        </Field>
        <Field label="Residency status">
          <IconInput icon={FileBadge} placeholder="e.g. Active" {...register('residency_status')} />
        </Field>
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Personal</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date of birth">
          <IconInput icon={CalendarDays} type="date" {...register('date_of_birth')} />
        </Field>
        <Field label="Gender">
          <Controller control={control} name="gender" render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={GENDERS} placeholder="Select gender" />} />
        </Field>
        <Field label="Marital status">
          <Controller
            control={control}
            name="marital_status"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={field.onChange}
                // A scanned value outside the list must still show.
                options={field.value && !MARITAL_STATUSES.some((o) => o.value === field.value) ? [{ value: field.value, label: field.value }, ...MARITAL_STATUSES] : MARITAL_STATUSES}
                placeholder="Select status"
              />
            )}
          />
        </Field>
        <Field label="Place of birth">
          <IconInput icon={MapPin} {...register('place_of_birth')} />
        </Field>
        <Field label="Birth country">
          <IconInput icon={MapPin} {...register('birth_country')} />
        </Field>
        <Field label="Religion">
          <IconInput icon={UserRound} {...register('religion')} />
        </Field>
        <Field label="Mother’s name">
          <IconInput icon={UserRound} {...register('mother_name')} />
        </Field>
        <Field label="Passport type">
          <IconInput icon={FileBadge} placeholder="e.g. Ordinary passport" {...register('passport_type')} />
        </Field>
        <Field label="Passport issue place">
          <IconInput icon={MapPin} {...register('passport_issue_place')} />
        </Field>
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Contact & address</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="UAE mobile">
          <IconInput icon={Smartphone} inputMode="tel" {...register('phone')} />
        </Field>
        <Field label="UAE phone">
          <IconInput icon={Phone} inputMode="tel" {...register('alternate_phone')} />
        </Field>
        <Field label="Email">
          <IconInput icon={Mail} type="email" {...register('email')} />
        </Field>
        <Field label="Address in UAE">
          <IconInput icon={MapPin} placeholder="e.g. Kalba, Sharjah" {...register('uae_address')} />
        </Field>
        <Field label="Home country address">
          <IconInput icon={MapPin} {...register('home_country_address')} />
        </Field>
        <Field label="Home country mobile">
          <IconInput icon={Smartphone} inputMode="tel" {...register('home_country_mobile')} />
        </Field>
      </div>
    </SectionCard>
  )
}
