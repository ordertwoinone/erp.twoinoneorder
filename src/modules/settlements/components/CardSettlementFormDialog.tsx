import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { useBankAccountsOptions } from '@/hooks/useAccountOptions'
import { cardSettlementFormSchema, type CardSettlementFormInput } from '@/schemas/settlement'
import { useCardMachinesOptions, useCreateCardSettlement } from '../hooks/useSettlements'

export function CardSettlementFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: machines } = useCardMachinesOptions()
  const { data: bankAccounts } = useBankAccountsOptions(null)
  const { data: restaurants } = useRestaurantsQuery()
  const createSettlement = useCreateCardSettlement()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CardSettlementFormInput>({
    resolver: zodResolver(cardSettlementFormSchema),
    defaultValues: {
      card_machine_id: '',
      bank_account_id: '',
      credit_date: new Date().toISOString().slice(0, 10),
      bank_reference: '',
      amount: 0,
      notes: '',
      allocations: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'allocations' })
  const amount = watch('amount')
  const allocations = watch('allocations')
  const allocatedTotal = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  async function onSubmit(values: CardSettlementFormInput) {
    await createSettlement.mutateAsync(values)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Card Settlement</DialogTitle>
          <DialogDescription>A settlement clears a receivable — it never creates a new sale.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Machine</Label>
              <Controller
                control={control}
                name="card_machine_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select machine" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.machine_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.card_machine_id && <p className="text-sm text-destructive">{errors.card_machine_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Bank account</Label>
              <Controller
                control={control}
                name="bank_account_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
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
              {errors.bank_account_id && <p className="text-sm text-destructive">{errors.bank_account_id.message}</p>}
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
            <div className="col-span-2 space-y-2">
              <Label htmlFor="bank_reference">Bank reference</Label>
              <Input id="bank_reference" {...register('bank_reference')} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Allocate to restaurant(s)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ restaurant_id: '', amount: 0, covers_from: '', covers_to: '' })}
              >
                <Plus /> Add
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-4">
                  <Controller
                    control={control}
                    name={`allocations.${index}.restaurant_id`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Restaurant" />
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
                </div>
                <div className="col-span-2">
                  <Input type="date" className="h-8" {...register(`allocations.${index}.covers_from`)} />
                </div>
                <div className="col-span-2">
                  <Input type="date" className="h-8" {...register(`allocations.${index}.covers_to`)} />
                </div>
                <div className="col-span-3">
                  <Input type="number" step="0.01" className="h-8" {...register(`allocations.${index}.amount`)} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Allocated {allocatedTotal.toFixed(2)} of {(Number(amount) || 0).toFixed(2)}. Leave unallocated for "unmatched".
            </p>
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
