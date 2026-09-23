import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { deliverySettlementFormSchema, type DeliverySettlementFormInput } from '@/schemas/settlement'
import { useCreateDeliverySettlement, useDeliveryPlatformsOptions } from '../hooks/useSettlements'

export function DeliverySettlementFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: platforms } = useDeliveryPlatformsOptions()
  const { data: restaurants } = useRestaurantsQuery()
  const createSettlement = useCreateDeliverySettlement()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeliverySettlementFormInput>({
    resolver: zodResolver(deliverySettlementFormSchema),
    defaultValues: {
      delivery_platform_id: '',
      restaurant_id: '',
      bank_account_id: '',
      credit_date: new Date().toISOString().slice(0, 10),
      bank_reference: '',
      amount: 0,
      covers_from: '',
      covers_to: '',
      notes: '',
    },
  })

  async function onSubmit(values: DeliverySettlementFormInput) {
    await createSettlement.mutateAsync(values)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Delivery Settlement</DialogTitle>
          <DialogDescription>Clears the platform receivable — never recorded as additional sales.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Controller
                control={control}
                name="delivery_platform_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.delivery_platform_id && <p className="text-sm text-destructive">{errors.delivery_platform_id.message}</p>}
            </div>
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
              <Label htmlFor="credit_date">Credit date</Label>
              <Input id="credit_date" type="date" {...register('credit_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="covers_from">Covers from</Label>
              <Input id="covers_from" type="date" {...register('covers_from')} />
              {errors.covers_from && <p className="text-sm text-destructive">{errors.covers_from.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="covers_to">Covers to</Label>
              <Input id="covers_to" type="date" {...register('covers_to')} />
              {errors.covers_to && <p className="text-sm text-destructive">{errors.covers_to.message}</p>}
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="bank_reference">Bank reference</Label>
              <Input id="bank_reference" {...register('bank_reference')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Record settlement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
