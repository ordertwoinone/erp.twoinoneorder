import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { formatCurrency } from '@/lib/utils/format'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { salesEntryFormSchema, type SalesEntryFormInput } from '@/schemas/sales'
import { useSalesEntryQuery, useSalesLookupsQuery } from '../hooks/useSalesEntries'
import { useSaveSalesEntry } from '../hooks/useSalesMutations'

const emptyBreakdown = { sales_channel_id: '', payment_method_id: '', amount: 0 }

export default function SalesFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = useSalesEntryQuery(id)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: lookups } = useSalesLookupsQuery()
  const saveSalesEntry = useSaveSalesEntry()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SalesEntryFormInput>({
    resolver: zodResolver(salesEntryFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      business_date: new Date().toISOString().slice(0, 10),
      shift: 'full_day',
      gross_sales: 0,
      discounts: 0,
      refunds: 0,
      tax_amount: 0,
      notes: '',
      breakdowns: [emptyBreakdown],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'breakdowns' })
  const values = watch()

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.entry.id,
      restaurant_id: existing.entry.restaurant_id,
      business_date: existing.entry.business_date,
      shift: existing.entry.shift,
      gross_sales: existing.entry.gross_sales,
      discounts: existing.entry.discounts,
      refunds: existing.entry.refunds,
      tax_amount: existing.entry.tax_amount,
      notes: existing.entry.notes ?? '',
      breakdowns: existing.breakdowns.map((b) => ({
        sales_channel_id: b.sales_channel_id ?? '',
        payment_method_id: b.payment_method_id,
        amount: b.amount,
      })),
    })
  }, [existing, reset])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  const netSales = (Number(values.gross_sales) || 0) - (Number(values.discounts) || 0) - (Number(values.refunds) || 0)
  const breakdownTotal = values.breakdowns.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const discrepancy = Math.round((netSales - breakdownTotal) * 100) / 100

  async function onSubmit(formValues: SalesEntryFormInput) {
    await saveSalesEntry.mutateAsync(formValues)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEditing ? 'Edit Sales Entry' : 'New Sales Entry'} description="Enter daily/shift sales totals and their payment breakdown." />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Controller
                control={control}
                name="restaurant_id"
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
              {errors.restaurant_id && <p className="text-sm text-destructive">{errors.restaurant_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_date">Business date</Label>
              <Input id="business_date" type="date" {...register('business_date')} />
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Controller
                control={control}
                name="shift"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_day">Full Day</SelectItem>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales totals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="gross_sales">Gross sales</Label>
              <Input id="gross_sales" type="number" step="0.01" {...register('gross_sales')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discounts">Discounts</Label>
              <Input id="discounts" type="number" step="0.01" {...register('discounts')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refunds">Refunds</Label>
              <Input id="refunds" type="number" step="0.01" {...register('refunds')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_amount">Tax</Label>
              <Input id="tax_amount" type="number" step="0.01" {...register('tax_amount')} />
            </div>
            <div className="col-span-full text-right text-base font-semibold">
              Net Sales: <span className="tabular-nums">{formatCurrency(netSales)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payment breakdown</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyBreakdown)}>
              <Plus /> Add row
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.breakdowns?.message && <p className="text-sm text-destructive">{errors.breakdowns.message}</p>}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
                <div className="col-span-5">
                  <Label className="mb-1 text-xs text-muted-foreground">Channel</Label>
                  <Controller
                    control={control}
                    name={`breakdowns.${index}.sales_channel_id`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookups?.channels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-5">
                  <Label className="mb-1 text-xs text-muted-foreground">Payment method</Label>
                  <Controller
                    control={control}
                    name={`breakdowns.${index}.payment_method_id`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookups?.methods.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="mb-1 text-xs text-muted-foreground">Amount</Label>
                  <Input type="number" step="0.01" {...register(`breakdowns.${index}.amount`)} />
                </div>
                <div className="col-span-8 flex justify-end sm:col-span-1">
                  <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-6 border-t pt-3 text-sm">
              <span>
                Breakdown total: <span className="font-medium tabular-nums">{formatCurrency(breakdownTotal)}</span>
              </span>
            </div>

            {discrepancy !== 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Payment breakdown ({formatCurrency(breakdownTotal)}) doesn't match net sales (
                  {formatCurrency(netSales)}) — difference of {formatCurrency(Math.abs(discrepancy))}.
                </AlertDescription>
              </Alert>
            )}
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
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
