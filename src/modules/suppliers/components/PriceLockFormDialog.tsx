import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useSavePriceLock } from '../hooks/usePriceLocks'

const schema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  pack_size: z.coerce.number().min(0).optional().or(z.literal('')),
  agreed_price: z.coerce.number().gt(0, 'Price must be greater than 0'),
})
type FormInput = z.infer<typeof schema>

export function PriceLockFormDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false)
  const [restaurantIds, setRestaurantIds] = useState<string[]>([])
  const { data: products } = useProductsOptions()
  const { data: units } = useUnitsOptions()
  const { data: restaurants } = useRestaurantsQuery()
  const savePriceLock = useSavePriceLock()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema), defaultValues: { pack_size: '', agreed_price: 0 } })

  async function onSubmit(values: FormInput) {
    await savePriceLock.mutateAsync({
      supplierId,
      productId: values.product_id,
      unitId: values.unit_id,
      packSize: values.pack_size === '' ? undefined : values.pack_size,
      agreedPrice: values.agreed_price,
      restaurantIds,
    })
    reset()
    setRestaurantIds([])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add price lock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add price lock</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label>Product</Label>
            <Controller
              control={control}
              name="product_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
            {errors.product_id && <p className="text-sm text-destructive">{errors.product_id.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Controller
                control={control}
                name="unit_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
              {errors.unit_id && <p className="text-sm text-destructive">{errors.unit_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack_size">Pack size</Label>
              <Input id="pack_size" type="number" step="0.001" {...register('pack_size')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agreed_price">Agreed price</Label>
              <Input id="agreed_price" type="number" step="0.01" {...register('agreed_price')} />
              {errors.agreed_price && <p className="text-sm text-destructive">{errors.agreed_price.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applies to</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Leave all unchecked to apply to every restaurant.</p>
              {restaurants?.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={restaurantIds.includes(r.id)}
                    onCheckedChange={(checked) =>
                      setRestaurantIds((prev) => (checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save price lock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
