import { useEffect, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { supplierSchema, type SupplierInput } from '@/schemas/supplier'
import { useSaveSupplier } from '../hooks/useSaveSupplier'
import { useSupplierQuery } from '../hooks/useSuppliers'

const emptyValues: SupplierInput = {
  code: '',
  name: '',
  trn: '',
  payment_terms_days: 30,
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_iban: '',
  bank_swift: '',
  is_active: true,
}

export function SupplierFormDialog({
  trigger,
  supplierId,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode
  supplierId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { hasPermission } = useAuth()
  const canViewBank = hasPermission('suppliers.view_bank_details')
  const saveSupplier = useSaveSupplier()
  const { data: existing } = useSupplierQuery(supplierId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (!open) return
    if (existing) {
      reset({
        id: existing.id,
        code: existing.code,
        name: existing.name,
        trn: existing.trn ?? '',
        payment_terms_days: existing.payment_terms_days,
        bank_name: existing.bank_name ?? '',
        bank_account_name: existing.bank_account_name ?? '',
        bank_account_number: existing.bank_account_number ?? '',
        bank_iban: existing.bank_iban ?? '',
        bank_swift: existing.bank_swift ?? '',
        is_active: existing.is_active,
      })
    } else if (!supplierId) {
      reset(emptyValues)
    }
  }, [existing, supplierId, open, reset])

  async function onSubmit(values: SupplierInput) {
    await saveSupplier.mutateAsync(values)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplierId ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
          <DialogDescription>Supplier details are shared across all restaurants.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Supplier code</Label>
              <Input id="code" aria-invalid={!!errors.code} {...register('code')} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
              <Input id="payment_terms_days" type="number" {...register('payment_terms_days')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="trn">TRN</Label>
            <Input id="trn" {...register('trn')} />
          </div>

          {canViewBank && (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm font-medium text-muted-foreground">Bank details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank name</Label>
                  <Input id="bank_name" {...register('bank_name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_name">Account name</Label>
                  <Input id="bank_account_name" {...register('bank_account_name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account number</Label>
                  <Input id="bank_account_number" {...register('bank_account_number')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_iban">IBAN</Label>
                  <Input id="bank_iban" {...register('bank_iban')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_swift">SWIFT</Label>
                  <Input id="bank_swift" {...register('bank_swift')} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="is_active">Active</Label>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save supplier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
