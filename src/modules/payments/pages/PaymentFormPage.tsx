import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useSuppliersOptions } from '@/hooks/useCatalogOptions'
import { useBankAccountsOptions, useCashAccountsOptions, useExpenseCategoriesOptions } from '@/hooks/useAccountOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { paymentVoucherFormSchema, type PaymentVoucherFormInput } from '@/schemas/payment'
import { usePaymentVoucherQuery } from '../hooks/usePaymentVouchers'
import { useSavePaymentVoucherDraft } from '../hooks/usePaymentMutations'

export default function PaymentFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = usePaymentVoucherQuery(id)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: suppliers } = useSuppliersOptions()
  const { data: expenseCategories } = useExpenseCategoriesOptions()
  const saveDraft = useSavePaymentVoucherDraft()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentVoucherFormInput>({
    resolver: zodResolver(paymentVoucherFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      payee_type: 'supplier',
      supplier_id: '',
      expense_category_id: '',
      amount: 0,
      payment_method: 'bank',
      bank_account_id: '',
      cash_account_id: '',
      payment_reference: '',
      voucher_date: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const restaurantId = watch('restaurant_id')
  const payeeType = watch('payee_type')
  const paymentMethod = watch('payment_method')
  const { data: bankAccounts } = useBankAccountsOptions(restaurantId || null)
  const { data: cashAccounts } = useCashAccountsOptions(restaurantId || null)

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.voucher.id,
      restaurant_id: existing.voucher.restaurant_id,
      payee_type: existing.voucher.payee_type as 'supplier' | 'expense',
      supplier_id: existing.voucher.supplier_id ?? '',
      expense_category_id: existing.voucher.expense_category_id ?? '',
      amount: existing.voucher.amount,
      payment_method: existing.voucher.payment_method,
      bank_account_id: existing.voucher.bank_account_id ?? '',
      cash_account_id: existing.voucher.cash_account_id ?? '',
      payment_reference: existing.voucher.payment_reference ?? '',
      voucher_date: existing.voucher.voucher_date,
      notes: existing.voucher.notes ?? '',
    })
  }, [existing, reset])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  async function onSubmit(values: PaymentVoucherFormInput) {
    await saveDraft.mutateAsync(values)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEditing ? 'Edit Payment Voucher' : 'New Payment Voucher'} description="Creating a voucher does not move any money — it requires approval and posting first." />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
              <Label>Payee type</Label>
              <Controller
                control={control}
                name="payee_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {payeeType === 'supplier' ? (
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Controller
                  control={control}
                  name="supplier_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.supplier_id && <p className="text-sm text-destructive">{errors.supplier_id.message}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Expense category</Label>
                <Controller
                  control={control}
                  name="expense_category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.expense_category_id && (
                  <p className="text-sm text-destructive">{errors.expense_category_id.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="voucher_date">Date</Label>
              <Input id="voucher_date" type="date" {...register('voucher_date')} />
            </div>

            <div className="space-y-2">
              <Label>Payment method</Label>
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {paymentMethod === 'bank' ? (
              <div className="space-y-2">
                <Label>Bank account</Label>
                <Controller
                  control={control}
                  name="bank_account_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bank_name} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.bank_account_id && (
                  <p className="text-sm text-destructive">{errors.bank_account_id.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cash account</Label>
                <Controller
                  control={control}
                  name="cash_account_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select cash account" />
                      </SelectTrigger>
                      <SelectContent>
                        {cashAccounts?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.cash_account_id && (
                  <p className="text-sm text-destructive">{errors.cash_account_id.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="payment_reference">Reference</Label>
              <Input id="payment_reference" {...register('payment_reference')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea placeholder="Optional notes…" {...register('notes')} />
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
