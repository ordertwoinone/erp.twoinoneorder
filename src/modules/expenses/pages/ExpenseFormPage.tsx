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
import { useExpenseCategoriesOptions } from '@/hooks/useAccountOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { expenseFormSchema, type ExpenseFormInput } from '@/schemas/expense'
import { useExpenseQuery } from '../hooks/useExpenses'
import { useSaveExpenseDraft } from '../hooks/useExpenseMutations'

export default function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = useExpenseQuery(id)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: categories } = useExpenseCategoriesOptions()
  const saveDraft = useSaveExpenseDraft()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      expense_category_id: '',
      amount: 0,
      expense_date: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.expense.id,
      restaurant_id: existing.expense.restaurant_id,
      expense_category_id: existing.expense.expense_category_id,
      amount: existing.expense.amount,
      expense_date: existing.expense.expense_date,
      notes: existing.expense.notes ?? '',
    })
  }, [existing, reset])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  async function onSubmit(values: ExpenseFormInput) {
    await saveDraft.mutateAsync(values)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEditing ? 'Edit Expense' : 'New Expense'} />

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
              <Label>Category</Label>
              <Controller
                control={control}
                name="expense_category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
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
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_date">Date</Label>
              <Input id="expense_date" type="date" {...register('expense_date')} />
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
