import { useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { VISA_STEPS } from '../employeeOptions'
import {
  stepAmountsTotal,
  useCompanyCategoriesQuery,
  useDeleteCompanyCategory,
  useSaveCompanyCategory,
  type CompanyCategory,
  type CompanyCategoryInput,
} from '../hooks/useCompanyCategories'

/** A new category starts from the 10 typing-centre steps, all blank. */
const emptyCategory = (): CompanyCategoryInput => ({
  name: '',
  description: '',
  is_active: true,
  step_amounts: Object.fromEntries(VISA_STEPS.map((s) => [s.key, ''])),
})

export default function CompanyCategoriesPage() {
  const { data: categories = [], isLoading } = useCompanyCategoriesQuery()
  const remove = useDeleteCompanyCategory()
  const [editing, setEditing] = useState<CompanyCategoryInput | null>(null)

  const openEdit = (c: CompanyCategory) =>
    setEditing({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      is_active: c.is_active,
      step_amounts: Object.fromEntries(VISA_STEPS.map((s) => [s.key, c.step_amounts[s.key] ?? ''])),
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Categories"
        description="Templates of amounts for the 10 typing-centre visa steps. Pick a category on an employee to fill in the step amounts."
        actions={
          <Button onClick={() => setEditing(emptyCategory())}>
            <Plus /> Add category
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Steps with amount</TableHead>
              <TableHead className="text-right">Total (AED)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  No categories yet — add one and enter the amount for each typing-centre step.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className={cn('cursor-pointer', !c.is_active && 'opacity-60')} onClick={() => openEdit(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {VISA_STEPS.filter((s) => c.step_amounts[s.key] !== undefined).length} / {VISA_STEPS.length}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(stepAmountsTotal(c.step_amounts))}</TableCell>
                  <TableCell className="max-w-80 truncate text-muted-foreground">{c.description ?? ''}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        c.is_active ? 'border-success/30 bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmActionDialog
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                        title={`Delete "${c.name}"?`}
                        description="Employees that used it keep their step amounts; only the template is removed."
                        confirmLabel="Delete category"
                        destructive
                        onConfirm={() => remove.mutateAsync(c.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CategoryDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function CategoryDialog({ value, onClose }: { value: CompanyCategoryInput | null; onClose: () => void }) {
  const save = useSaveCompanyCategory()
  const [form, setForm] = useState<CompanyCategoryInput>(emptyCategory)
  const [loadedFor, setLoadedFor] = useState<CompanyCategoryInput | null>(null)
  if (value && value !== loadedFor) {
    setLoadedFor(value)
    setForm(value)
  }
  const setAmount = (key: string, v: string) =>
    setForm((f) => ({ ...f, step_amounts: { ...f.step_amounts, [key]: v === '' ? '' : Number(v) } }))

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit company category' : 'Add company category'}</DialogTitle>
          <DialogDescription>Enter the amount for each typing-centre step. Leave a step blank if it doesn’t apply.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!form.name.trim()) return
            await save.mutateAsync(form)
            onClose()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category name *</Label>
              <Input id="cat-name" autoFocus placeholder="e.g. Category 1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" className="min-h-9" placeholder="Optional" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="w-10 px-3 py-2 text-left text-xs font-semibold">Step</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Service</th>
                  <th className="w-40 px-3 py-2 text-right text-xs font-semibold">Amount (AED)</th>
                </tr>
              </thead>
              <tbody>
                {VISA_STEPS.map((step, i) => (
                  <tr key={step.key} className="border-t">
                    <td className="px-3 py-1.5">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <label htmlFor={`amount-${step.key}`} className="font-medium">
                        {step.label}
                      </label>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        id={`amount-${step.key}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="—"
                        className="h-8 text-right tabular-nums"
                        value={form.step_amounts[step.key] ?? ''}
                        onChange={(e) => setAmount(step.key, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td />
                  <td className="px-3 py-2 font-semibold">Total</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(stepAmountsTotal(form.step_amounts))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Active (shown on employees)
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} {form.id ? 'Save changes' : 'Add category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
