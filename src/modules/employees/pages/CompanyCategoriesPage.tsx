import { useState } from 'react'
import { Layers, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

const emptyCategory = (): CompanyCategoryInput => ({
  name: '',
  description: '',
  is_active: true,
  values: [{ id: null, label: '', amount: '' }],
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
      values: c.company_category_values.map((v) => ({ id: v.id, label: v.label, amount: Number(v.amount) })),
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Categories"
        description="Categories and their amounts, picked on the typing-centre visa steps (e.g. work permit Category 1 / 2 / 3)."
        actions={
          <Button onClick={() => setEditing(emptyCategory())}>
            <Plus /> Add category
          </Button>
        }
      />

      {isLoading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Layers className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-medium">No company categories yet</p>
          <p className="text-sm text-muted-foreground">Add one, e.g. “Work permit category” with Category 1, 2 and 3 and their amounts.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className={cn('flex flex-col rounded-xl border bg-card', !c.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.description && <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                  {!c.is_active && <span className="text-[11px] font-medium text-muted-foreground">Inactive</span>}
                </div>
                <div className="flex shrink-0">
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
                    description="Visa steps that used one of its values keep their amount but lose the category link."
                    confirmLabel="Delete category"
                    destructive
                    onConfirm={() => remove.mutateAsync(c.id)}
                  />
                </div>
              </div>
              <ul className="divide-y text-sm">
                {c.company_category_values.length === 0 ? (
                  <li className="px-4 py-3 text-muted-foreground">No values</li>
                ) : (
                  c.company_category_values.map((v) => (
                    <li key={v.id} className="flex items-center justify-between px-4 py-2">
                      <span>{v.label}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(v.amount)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

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
  const setValue = (i: number, patch: Partial<CompanyCategoryInput['values'][number]>) =>
    setForm((f) => ({ ...f, values: f.values.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }))
  const filledValues = form.values.filter((v) => v.label.trim())

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit company category' : 'Add company category'}</DialogTitle>
          <DialogDescription>Each value has an amount that fills in the visa step when it’s picked.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!form.name.trim()) return
            await save.mutateAsync({ ...form, values: filledValues })
            onClose()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Category name *</Label>
            <Input id="cat-name" autoFocus placeholder="e.g. Work permit category" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea id="cat-desc" className="min-h-14" placeholder="Optional" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Values</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, values: [...f.values, { id: null, label: '', amount: '' }] }))}>
                <Plus /> Add value
              </Button>
            </div>
            <div className="space-y-2">
              {form.values.map((v, i) => (
                <div key={v.id ?? `new-${i}`} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2">
                  <Input placeholder={`e.g. Category ${i + 1}`} value={v.label} aria-label={`Value ${i + 1} name`} onChange={(e) => setValue(i, { label: e.target.value })} />
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pr-11 text-right tabular-nums"
                      aria-label={`Value ${i + 1} amount`}
                      value={v.amount}
                      onChange={(e) => setValue(i, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">AED</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove value ${i + 1}`}
                    onClick={() => setForm((f) => ({ ...f, values: f.values.filter((_, idx) => idx !== i) }))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
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
