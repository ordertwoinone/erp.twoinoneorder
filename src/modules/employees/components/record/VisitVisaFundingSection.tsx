import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { CalendarDays, CircleDollarSign, HandCoins } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { VISIT_VISA_SOURCES, VISIT_VISA_SUPPORT } from '../../employeeOptions'
import { Field, IconInput, OptionSelect, SectionCard } from './RecordUi'
import { num } from './recordUtils'

export function VisitVisaFundingSection({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { control, register, watch, formState } = form
  const support = watch('visit_visa_support')
  const loan = num(watch('visit_visa_loan_amount'))
  const recovered = num(watch('visit_visa_recovered_amount'))
  const monthly = num(watch('visit_visa_monthly_deduction'))
  const balance = Math.max(loan - recovered, 0)
  const monthsLeft = monthly > 0 && balance > 0 ? Math.ceil(balance / monthly) : 0
  const isLoan = support === 'recoverable_loan'

  return (
    <SectionCard icon={HandCoins} title="Visit visa funding" lockKey="visit_visa">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-3">
        <Field label="Visa source">
          <Controller
            control={control}
            name="visit_visa_source"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={VISIT_VISA_SOURCES} placeholder="Select source" />}
          />
        </Field>
        <Field label="Company support">
          <Controller
            control={control}
            name="visit_visa_support"
            render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={VISIT_VISA_SUPPORT} placeholder="Select support" />}
          />
        </Field>
        <Field label="Visit visa cost (AED)" error={formState.errors.visit_visa_cost?.message}>
          <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_cost')} />
        </Field>
        {isLoan && (
          <>
            <Field label="Loan amount (AED)" error={formState.errors.visit_visa_loan_amount?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_loan_amount')} />
            </Field>
            <Field label="Disbursed date">
              <IconInput icon={CalendarDays} type="date" {...register('visit_visa_disbursed_date')} />
            </Field>
            <Field label="Repayment starts">
              <IconInput icon={CalendarDays} type="date" {...register('visit_visa_repayment_start')} />
            </Field>
            <Field label="Monthly deduction (AED)" error={formState.errors.visit_visa_monthly_deduction?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_monthly_deduction')} />
            </Field>
            <Field label="Recovered so far (AED)" error={formState.errors.visit_visa_recovered_amount?.message}>
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('visit_visa_recovered_amount')} />
            </Field>
            <Field label="Balance to recover" hint={monthsLeft ? `≈ ${monthsLeft} more month${monthsLeft === 1 ? '' : 's'} of deductions` : undefined}>
              <Input className={cn('h-10 font-semibold', balance > 0 ? 'text-destructive' : 'text-success')} value={formatCurrency(balance)} disabled readOnly />
            </Field>
          </>
        )}
      </div>
    </SectionCard>
  )
}
