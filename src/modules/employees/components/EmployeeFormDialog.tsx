import { useEffect, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { employeeSchema, type EmployeeInput } from '@/schemas/employee'
import { useEmployeeQuery } from '../hooks/useEmployees'
import { useSaveEmployee } from '../hooks/useEmployeeMutations'

const emptyValues: EmployeeInput = {
  employee_code: '',
  full_name: '',
  job_title: '',
  joining_date: '',
  current_restaurant_id: '',
  phone: '',
  email: '',
  employment_status: 'active',
  is_shared_employee: false,
}

export function EmployeeFormDialog({
  trigger,
  employeeId,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode
  employeeId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: restaurants } = useRestaurantsQuery()
  const { data: existing } = useEmployeeQuery(employeeId)
  const saveEmployee = useSaveEmployee()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput>({ resolver: zodResolver(employeeSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (!open) return
    if (existing) {
      reset({
        id: existing.id,
        employee_code: existing.employee_code,
        full_name: existing.full_name,
        job_title: existing.job_title ?? '',
        joining_date: existing.joining_date ?? '',
        current_restaurant_id: existing.current_restaurant_id ?? '',
        phone: existing.phone ?? '',
        email: existing.email ?? '',
        employment_status: existing.employment_status,
        is_shared_employee: existing.is_shared_employee,
      })
    } else if (!employeeId) {
      reset(emptyValues)
    }
  }, [existing, employeeId, open, reset])

  async function onSubmit(values: EmployeeInput) {
    await saveEmployee.mutateAsync(values)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employeeId ? 'Edit Employee' : 'New Employee'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">Employee code</Label>
              <Input id="employee_code" aria-invalid={!!errors.employee_code} {...register('employee_code')} />
              {errors.employee_code && <p className="text-sm text-destructive">{errors.employee_code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" aria-invalid={!!errors.full_name} {...register('full_name')} />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_title">Job title</Label>
              <Input id="job_title" {...register('job_title')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joining_date">Joining date</Label>
              <Input id="joining_date" type="date" {...register('joining_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Controller
                control={control}
                name="current_restaurant_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="employment_status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="resigned">Resigned</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_shared_employee">Shared employee</Label>
              <p className="text-xs text-muted-foreground">Costs can be allocated across multiple restaurants.</p>
            </div>
            <Controller
              control={control}
              name="is_shared_employee"
              render={({ field }) => (
                <Switch id="is_shared_employee" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
