import { useEffect, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { useAedEquivalent } from '@/hooks/useExchangeRates'
import { useCategoriesOptions } from '@/hooks/useCatalogOptions'
import { formatCurrency } from '@/lib/utils/format'
import { CURRENCY_OPTIONS, SUPPLIER_TYPE_OPTIONS, supplierSchema, type SupplierInput } from '@/schemas/supplier'
import { useSaveSupplier } from '../hooks/useSaveSupplier'
import { useSupplierQuery } from '../hooks/useSuppliers'

const emptyValues: SupplierInput = {
  code: '',
  name: '',
  trn: '',
  payment_terms_days: 30,
  supplier_type: '',
  category_ids: [],
  salesman_name: '',
  credit_limit_amount: '',
  credit_limit_currency: 'AED',
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
  const { data: categories } = useCategoriesOptions()

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema), defaultValues: emptyValues })

  const creditLimitAmount = watch('credit_limit_amount')
  const creditLimitCurrency = watch('credit_limit_currency')
  const aedEquivalent = useAedEquivalent(
    creditLimitAmount === '' ? null : Number(creditLimitAmount),
    creditLimitCurrency,
  )

  useEffect(() => {
    if (!open) return
    if (existing) {
      reset({
        id: existing.id,
        code: existing.code,
        name: existing.name,
        trn: existing.trn ?? '',
        payment_terms_days: existing.payment_terms_days,
        supplier_type: existing.supplier_type ?? '',
        category_ids: existing.category_ids ?? [],
        salesman_name: existing.salesman_name ?? '',
        credit_limit_amount: existing.credit_limit_amount ?? '',
        credit_limit_currency: existing.credit_limit_currency ?? 'AED',
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

          <div className="space-y-4 rounded-md border p-3">
            <p className="text-sm font-medium text-muted-foreground">Type &amp; categories</p>
            <div className="space-y-2">
              <Label>Supplier type</Label>
              <Controller
                control={control}
                name="supplier_type"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Categories supplied</Label>
              <Controller
                control={control}
                name="category_ids"
                render={({ field }) => (
                  <div className="flex max-h-28 flex-wrap gap-3 overflow-y-auto rounded-md border p-3">
                    {categories?.length ? (
                      categories.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value.includes(c.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? [...field.value, c.id] : field.value.filter((id) => id !== c.id))
                            }
                          />
                          {c.name}
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No product categories set up yet.</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-md border p-3">
            <p className="text-sm font-medium text-muted-foreground">Salesman &amp; credit</p>
            <div className="space-y-2">
              <Label htmlFor="salesman_name">Salesman name</Label>
              <Input id="salesman_name" {...register('salesman_name')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credit_limit_amount">Credit limit</Label>
                <Input id="credit_limit_amount" type="number" step="0.01" {...register('credit_limit_amount')} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Controller
                  control={control}
                  name="credit_limit_currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {creditLimitCurrency !== 'AED' && creditLimitAmount !== '' && (
              <p className="text-xs text-muted-foreground">
                {aedEquivalent !== null
                  ? `≈ ${formatCurrency(aedEquivalent)} (accounting/reports always show AED)`
                  : `No exchange rate set for ${creditLimitCurrency} yet — set one in Accounting → Exchange Rates.`}
              </p>
            )}
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
