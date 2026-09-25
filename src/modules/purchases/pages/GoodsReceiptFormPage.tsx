import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { goodsReceiptFormSchema, type GoodsReceiptFormInput } from '@/schemas/goodsReceipt'
import { usePurchaseOrderOutstandingItemsQuery, useSaveGoodsReceipt } from '../hooks/useGoodsReceipts'
import { useOpenPurchaseOrdersQuery } from '../hooks/usePurchaseOrders'

const emptyItem = { product_id: '', unit_id: '', quantity_received: 1, quantity_shortage: 0, notes: '' }

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromOrderId = searchParams.get('fromOrder')
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: restaurants } = useRestaurantsQuery()
  const { data: products } = useProductsOptions()
  const { data: units } = useUnitsOptions()
  const saveReceipt = useSaveGoodsReceipt()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GoodsReceiptFormInput>({
    resolver: zodResolver(goodsReceiptFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      purchase_order_id: fromOrderId ?? '',
      received_date: new Date().toISOString().slice(0, 10),
      notes: '',
      items: fromOrderId ? [] : [emptyItem],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const restaurantId = watch('restaurant_id') || null
  const purchaseOrderId = watch('purchase_order_id') || undefined

  const { data: openOrders } = useOpenPurchaseOrdersQuery(restaurantId)
  const { data: outstandingItems, isLoading: isLoadingOutstanding } = usePurchaseOrderOutstandingItemsQuery(purchaseOrderId)

  useEffect(() => {
    if (!outstandingItems) return
    replace(
      outstandingItems.map((item: any) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        quantity_received: item.quantity - item.quantity_received,
        quantity_shortage: 0,
        notes: '',
        product_name: item.products?.name,
        ordered_quantity: item.quantity - item.quantity_received,
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstandingItems])

  async function onSubmit(values: GoodsReceiptFormInput) {
    await saveReceipt.mutateAsync(values)
  }

  const isFromOrder = !!purchaseOrderId

  return (
    <div className="space-y-6">
      <PageHeader title="New Goods Receipt" description="Record what physically arrived at the restaurant." />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Restaurant</Label>
              <Controller
                control={control}
                name="restaurant_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      setValue('purchase_order_id', '')
                    }}
                  >
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
              <Label>Purchase order (optional)</Label>
              <Controller
                control={control}
                name="purchase_order_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!restaurantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ad-hoc receipt (no order)" />
                    </SelectTrigger>
                    <SelectContent>
                      {openOrders?.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} — {o.suppliers?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="received_date">Received date</Label>
              <Input id="received_date" type="date" {...register('received_date')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items received</CardTitle>
            {!isFromOrder && (
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem)}>
                <Plus /> Add item
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingOutstanding && <p className="text-sm text-muted-foreground">Loading order items…</p>}
            {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
            {isFromOrder && fields.length === 0 && !isLoadingOutstanding && (
              <p className="text-sm text-muted-foreground">This order has nothing outstanding to receive.</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-start gap-2 rounded-md border p-3">
                {isFromOrder ? (
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="mb-1 text-xs text-muted-foreground">Product</Label>
                    <p className="flex h-9 items-center text-sm font-medium">{watch(`items.${index}.product_name`)}</p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">
                    {isFromOrder ? `Received (of ${watch(`items.${index}.ordered_quantity`)})` : 'Received'}
                  </Label>
                  <Input type="number" step="0.001" {...register(`items.${index}.quantity_received`)} />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">Shortage</Label>
                  <Input type="number" step="0.001" {...register(`items.${index}.quantity_shortage`)} />
                </div>
                {!isFromOrder && (
                  <div className="col-span-6 flex items-end justify-end sm:col-span-2">
                    <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(index)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea placeholder="Delivery notes, discrepancies, etc…" {...register('notes')} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || fields.length === 0}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save receipt
          </Button>
        </div>
      </form>
    </div>
  )
}
