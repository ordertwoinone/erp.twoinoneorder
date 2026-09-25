import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { CalendarDays, CircleDollarSign, FileBadge, IdCard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { VISA_SPONSORSHIP_TYPES, VISA_STATUSES, WORK_PERMIT_CATEGORIES } from '../../employeeOptions'
import { Field, IconInput, OptionSelect, SectionCard, SegmentedToggle } from './RecordUi'

export function VisaSponsorshipSection({ form, restaurants }: { form: UseFormReturn<EmployeeRecordInput>; restaurants: RestaurantOption[] }) {
  const { register, control, watch, formState } = form
  const expiryAvailable = watch('work_permit_expiry_available')

  return (
    <SectionCard icon={IdCard} title="Visa & sponsorship">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Visa sponsorship type">
          <Controller
            control={control}
            name="visa_sponsorship_type"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={VISA_SPONSORSHIP_TYPES} placeholder="Select type" />
            )}
          />
        </Field>
        <Field label="Sponsor / establishment">
          <Input className="h-10" list="sponsor-establishments" placeholder="Select or type establishment" {...register('sponsor_name')} />
          <datalist id="sponsor-establishments">
            {restaurants.map((r) => (
              <option key={r.id} value={r.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Work permit category">
          <Controller
            control={control}
            name="work_permit_category"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={WORK_PERMIT_CATEGORIES} placeholder="Select category" />
            )}
          />
        </Field>
        <Field label="Visa status">
          <Controller
            control={control}
            name="visa_status"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={VISA_STATUSES} placeholder="Select status" />
            )}
          />
        </Field>

        <Field label="Work permit expiry available?" hint="If No, work permit expiry date will be shown as Not available.">
          <Controller
            control={control}
            name="work_permit_expiry_available"
            render={({ field }) => (
              <SegmentedToggle
                value={field.value}
                onChange={field.onChange}
                options={[
                  { label: 'Yes', value: true },
                  { label: 'No', value: false },
                ]}
              />
            )}
          />
        </Field>
        <Field label="Work permit expiry date">
          {expiryAvailable ? (
            <IconInput icon={CalendarDays} type="date" {...register('work_permit_expiry')} />
          ) : (
            <IconInput icon={CalendarDays} value="Not available" disabled readOnly />
          )}
        </Field>
        <Field label="Work permit salary (AED / month)" error={formState.errors.work_permit_salary?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('work_permit_salary')} />
        </Field>
        <Field label="Work permit number">
          <IconInput icon={FileBadge} placeholder="e.g. WP-2026-1042" {...register('work_permit_number')} />
        </Field>
      </div>
    </SectionCard>
  )
}
