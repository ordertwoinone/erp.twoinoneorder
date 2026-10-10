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
import {
  useCompanyCategoriesQuery,
  useDeleteCompanyCategory,
  useSaveCompanyCategory,
  type CompanyCategory,
  type CompanyCategoryInput,
} from '../hooks/useCompanyCategories'

const emptyCategory = (): CompanyCategoryInput => ({ name: '', amount: '', description: '', is_active: true })

export default function CompanyCategoriesPage() {
  const { data: categories = [], isLoading } = useCompanyCategoriesQuery()
  const remove = useDeleteCompanyCategory()
  const [editing, setEditing] = useState<CompanyCategoryInput | null>(null)

  const openEdit = (c: CompanyCategory) =>
    setEditing({ id: c.id, name: c.name, amount: c.amount, description: c.description ?? '', is_active: c.is_active })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Categories"
        description="Each category has an amount. Picking it on a typing-centre visa step fills in the step amount."
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
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  No categories yet — add one, e.g. “Category 1” with its amount.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className={cn(!c.is_active && 'opacity-60')}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.amount)}</TableCell>
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
                  <TableCell>
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
                        description="Visa steps that used it keep their amount but lose the category."
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

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit company category' : 'Add company category'}</DialogTitle>
          <DialogDescription>The amount fills in the visa step when this category is picked.</DialogDescription>
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
          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category name *</Label>
              <Input id="cat-name" autoFocus placeholder="e.g. Category 1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-amount">Amount (AED)</Label>
              <Input
                id="cat-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="text-right tabular-nums"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea id="cat-desc" className="min-h-14" placeholder="Optional" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Active (shown on visa steps)
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
