import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { branchTransferFormSchema, type BranchTransferFormInput } from '@/schemas/branchTransfer'
import { useCreateBranchTransfer } from '../hooks/useInventory'

const emptyItem = { product_id: '', unit_id: '', quantity: 1 }

export default function BranchTransferFormPage() {
  const navigate = useNavigate()
  const { data: restaurants } = useRestaurantsQuery()
  const { data: products } = useProductsOptions()
  const { data: units } = useUnitsOptions()
  const createTransfer = useCreateBranchTransfer()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BranchTransferFormInput>({
    resolver: zodResolver(branchTransferFormSchema),
    defaultValues: { from_restaurant_id: '', to_restaurant_id: '', notes: '', items: [emptyItem] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  async function onSubmit(values: BranchTransferFormInput) {
    await createTransfer.mutateAsync(values)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Branch Transfer" description="Dispatching immediately deducts stock from the source restaurant." />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From restaurant</Label>
              <Controller
                control={control}
                name="from_restaurant_id"
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
              {errors.from_restaurant_id && <p className="text-sm text-destructive">{errors.from_restaurant_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>To restaurant</Label>
              <Controller
                control={control}
                name="to_restaurant_id"
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
              {errors.to_restaurant_id && <p className="text-sm text-destructive">{errors.to_restaurant_id.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem)}>
              <Plus /> Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
                <div className="col-span-6">
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
                <div className="col-span-3">
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
                <div className="col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground">Quantity</Label>
                  <Input type="number" step="0.001" {...register(`items.${index}.quantity`)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
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
            Dispatch transfer
          </Button>
        </div>
      </form>
    </div>
  )
}
