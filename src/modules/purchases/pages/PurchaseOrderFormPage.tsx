import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { formatCurrency } from '@/lib/utils/format'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useSuppliersOptions, useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { purchaseOrderFormSchema, type PurchaseOrderFormInput } from '@/schemas/purchaseOrder'
import { usePurchaseRequestQuery } from '@/modules/purchase-requests/hooks/usePurchaseRequests'
import { usePurchaseOrderQuery, useSavePurchaseOrder } from '../hooks/usePurchaseOrders'

const emptyItem = { product_id: '', unit_id: '', pack_size: '' as const, quantity: 1, unit_price: 0 }

export default function PurchaseOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromRequestId = searchParams.get('fromRequest')
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = usePurchaseOrderQuery(id)
  const { data: sourceRequest } = usePurchaseRequestQuery(fromRequestId ?? undefined)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: suppliers } = useSuppliersOptions()
  const { data: products } = useProductsOptions()
  const { data: units } = useUnitsOptions()
  const saveOrder = useSavePurchaseOrder()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormInput>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      supplier_id: '',
      purchase_request_id: fromRequestId ?? '',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: '',
      notes: '',
      items: [emptyItem],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.order.id,
      restaurant_id: existing.order.restaurant_id,
      supplier_id: existing.order.supplier_id,
      purchase_request_id: existing.order.purchase_request_id ?? '',
      order_date: existing.order.order_date,
      expected_date: existing.order.expected_date ?? '',
      notes: existing.order.notes ?? '',
      items: existing.items.map((item: any) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        pack_size: item.pack_size ?? '',
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    })
  }, [existing, reset])

  useEffect(() => {
    if (!sourceRequest || isEditing) return
    reset((prev) => ({
      ...prev,
      restaurant_id: sourceRequest.request.restaurant_id,
      purchase_request_id: sourceRequest.request.id,
      items: sourceRequest.items.map((item: any) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        pack_size: '',
        quantity: item.quantity,
        unit_price: 0,
      })),
    }))
  }, [sourceRequest, isEditing, reset])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)

  async function onSubmit(values: PurchaseOrderFormInput) {
    await saveOrder.mutateAsync(values)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}
        description={
          sourceRequest
            ? `From purchase request ${sourceRequest.request.request_number}`
            : 'Commit a stock order to a supplier.'
        }
      />

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

            <div className="space-y-2">
              <Label htmlFor="order_date">Order date</Label>
              <Input id="order_date" type="date" {...register('order_date')} />
              {errors.order_date && <p className="text-sm text-destructive">{errors.order_date.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_date">Expected date</Label>
              <Input id="expected_date" type="date" {...register('expected_date')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem)}>
              <Plus /> Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-start gap-2 rounded-md border p-3">
                <div className="col-span-12 sm:col-span-4">
                  <Label className="mb-1 text-xs text-muted-foreground">Product</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.product_id`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">Unit</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_id`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">Qty</Label>
                  <Input type="number" step="0.001" {...register(`items.${index}.quantity`)} />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">Unit price</Label>
                  <Input type="number" step="0.01" {...register(`items.${index}.unit_price`)} />
                </div>
                <div className="col-span-6 flex items-end justify-between gap-2 sm:col-span-2">
                  <div className="text-sm font-medium tabular-nums">
                    {formatCurrency((Number(items[index]?.quantity) || 0) * (Number(items[index]?.unit_price) || 0))}
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex justify-end border-t pt-3 text-base font-semibold">
              Total: <span className="ml-2 tabular-nums">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea placeholder="Optional notes for this order…" {...register('notes')} />
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
