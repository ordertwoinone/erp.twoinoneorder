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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { restaurantSchema, type RestaurantInput } from '@/schemas/restaurant'
import { useRestaurantAdminQuery, useSaveRestaurant } from '../hooks/useRestaurantAdmin'

const emptyValues: RestaurantInput = {
  code: '',
  name: '',
  legal_name: '',
  address: '',
  city: '',
  emirate: '',
  phone: '',
  email: '',
  trn: '',
  is_head_office: false,
  is_active: true,
}

export function RestaurantFormDialog({
  trigger,
  restaurantId,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode
  restaurantId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const saveRestaurant = useSaveRestaurant()
  const { data: existing } = useRestaurantAdminQuery(restaurantId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RestaurantInput>({ resolver: zodResolver(restaurantSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (!open) return
    if (existing) {
      reset({
        id: existing.id,
        code: existing.code,
        name: existing.name,
        legal_name: existing.legal_name ?? '',
        address: existing.address ?? '',
        city: existing.city ?? '',
        emirate: existing.emirate ?? '',
        phone: existing.phone ?? '',
        email: existing.email ?? '',
        trn: existing.trn ?? '',
        is_head_office: existing.is_head_office,
        is_active: existing.is_active,
      })
    } else if (!restaurantId) {
      reset(emptyValues)
    }
  }, [existing, restaurantId, open, reset])

  async function onSubmit(values: RestaurantInput) {
    await saveRestaurant.mutateAsync(values)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{restaurantId ? 'Edit Restaurant' : 'New Restaurant'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" aria-invalid={!!errors.code} {...register('code')} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input id="legal_name" {...register('legal_name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emirate">Emirate</Label>
              <Input id="emirate" {...register('emirate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trn">TRN</Label>
              <Input id="trn" {...register('trn')} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="is_head_office">Head office</Label>
            <Controller
              control={control}
              name="is_head_office"
              render={({ field }) => <Switch id="is_head_office" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="is_active">Active</Label>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save restaurant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
