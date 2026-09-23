import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { formatCurrency } from '@/lib/utils/format'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { salaryEntryFormSchema, type SalaryEntryFormInput } from '@/schemas/payroll'
import { useEmployeesOptions, useSalaryEntryQuery } from '../hooks/useSalaryEntries'
import { useSaveSalaryEntry } from '../hooks/useSalaryMutations'

export default function SalaryEntryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = useSalaryEntryQuery(id)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: employees } = useEmployeesOptions()
  const saveEntry = useSaveSalaryEntry()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SalaryEntryFormInput>({
    resolver: zodResolver(salaryEntryFormSchema),
    defaultValues: {
      employee_id: '',
      restaurant_id: selectedRestaurantId ?? '',
      period_month: new Date().toISOString().slice(0, 7) + '-01',
      basic_salary: 0,
      allowances_total: 0,
      overtime_amount: 0,
      deductions_total: 0,
      advances_deducted: 0,
    },
  })

  const values = watch()

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.entry.id,
      employee_id: existing.entry.employee_id,
      restaurant_id: existing.entry.restaurant_id,
      period_month: existing.entry.period_month,
      basic_salary: existing.entry.basic_salary,
      allowances_total: existing.entry.allowances_total,
      overtime_amount: existing.entry.overtime_amount,
      deductions_total: existing.entry.deductions_total,
      advances_deducted: existing.entry.advances_deducted,
    })
  }, [existing, reset])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  const netSalary =
    (Number(values.basic_salary) || 0) +
    (Number(values.allowances_total) || 0) +
    (Number(values.overtime_amount) || 0) -
    (Number(values.deductions_total) || 0) -
    (Number(values.advances_deducted) || 0)

  function handleEmployeeChange(employeeId: string) {
    setValue('employee_id', employeeId)
    const employee = employees?.find((e) => e.id === employeeId)
    if (employee?.base_salary) setValue('basic_salary', employee.base_salary)
    if (employee?.current_restaurant_id && !isEditing) setValue('restaurant_id', employee.current_restaurant_id)
  }

  async function onSubmit(formValues: SalaryEntryFormInput) {
    await saveEntry.mutateAsync(formValues)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEditing ? 'Edit Salary Entry' : 'New Salary Entry'} />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Controller
                control={control}
                name="employee_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handleEmployeeChange} disabled={isEditing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name} ({e.employee_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employee_id && <p className="text-sm text-destructive">{errors.employee_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Controller
                control={control}
                name="restaurant_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.restaurant_id && <p className="text-sm text-destructive">{errors.restaurant_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_month">Period (month)</Label>
              <Input id="period_month" type="date" disabled={isEditing} {...register('period_month')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salary components</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="basic_salary">Basic salary</Label>
              <Input id="basic_salary" type="number" step="0.01" {...register('basic_salary')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowances_total">Allowances</Label>
              <Input id="allowances_total" type="number" step="0.01" {...register('allowances_total')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overtime_amount">Overtime</Label>
              <Input id="overtime_amount" type="number" step="0.01" {...register('overtime_amount')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deductions_total">Deductions</Label>
              <Input id="deductions_total" type="number" step="0.01" {...register('deductions_total')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advances_deducted">Advances deducted</Label>
              <Input id="advances_deducted" type="number" step="0.01" {...register('advances_deducted')} />
            </div>
            <div className="flex items-end justify-end text-base font-semibold">
              Net: <span className="ml-2 tabular-nums">{formatCurrency(netSalary)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save draft
          </Button>
        </div>
      </form>
    </div>
  )
}
