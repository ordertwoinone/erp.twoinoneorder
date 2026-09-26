import { forwardRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { AlertCircle, ArrowUp, BarChart3, NotebookPen, Percent } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { LineTotals, PurchaseFormInput } from '@/schemas/purchase'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function InvoiceSummaryCard({ form, lines }: { form: UseFormReturn<PurchaseFormInput>; lines: LineTotals[] }) {
  const [editingDiscount, setEditingDiscount] = useState(false)
  const items = form.watch('items')
  const subtotal = lines.reduce((s, l) => s + l.gross, 0)
  const discount = lines.reduce((s, l) => s + l.discount, 0)
  const vat = lines.reduce((s, l) => s + l.vat, 0)
  const total = lines.reduce((s, l) => s + l.total, 0)
  const allStandardRated = items.length > 0 && items.every((i) => Number(i.vat_rate) === 0.05)

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Invoice summary</h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">VAT{allStandardRated ? ' (5%)' : ''}</dt>
          <dd className="tabular-nums">{formatCurrency(vat)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded border">
              <Percent className="size-3.5" />
            </span>
            Discount
          </dt>
          <dd>
            {editingDiscount ? (
              <Input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                className="h-8 w-28 text-right tabular-nums"
                {...form.register('invoice_discount', { onBlur: () => setEditingDiscount(false) })}
              />
            ) : (
              <button type="button" className="tabular-nums hover:text-primary hover:underline" onClick={() => setEditingDiscount(true)}>
                {formatCurrency(discount)}
              </button>
            )}
          </dd>
        </div>
        {form.formState.errors.invoice_discount && <p className="text-xs text-destructive">{form.formState.errors.invoice_discount.message}</p>}
        <div className="flex items-baseline justify-between border-t pt-4">
          <dt className="text-base font-semibold">Grand total</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <AlertCircle className="size-5 shrink-0 fill-warning text-warning-foreground" />
        <div>
          <p className="font-semibold text-warning-foreground">Approval required</p>
          <p className="mt-0.5 text-muted-foreground">
            This invoice will be sent for approval based on your company policy before it affects stock or accounting.
          </p>
        </div>
      </div>
    </section>
  )
}

export const SupplierQuoteComparison = forwardRef<HTMLElement, { form: UseFormReturn<PurchaseFormInput>; highlighted: boolean }>(
  function SupplierQuoteComparison({ form, highlighted }, ref) {
    const items = form.watch('items').filter((i) => i.product_id)

    return (
      <section ref={ref} className={cn('rounded-xl border bg-card p-5 shadow-sm transition-shadow', highlighted && 'ring-2 ring-warning')}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="size-5 text-primary" /> Supplier quote comparison
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add items to compare invoice prices with the supplier's contract prices.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-2 text-left font-medium">Item</th>
                <th className="py-2 text-right font-medium">Contract (AED)</th>
                <th className="py-2 text-right font-medium">Invoice (AED)</th>
                <th className="w-16 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const agreed = item.agreed_price ?? null
                const price = Number(item.unit_price) || 0
                const pct = agreed && agreed > 0 ? ((price - agreed) / agreed) * 100 : null
                const above = pct !== null && pct > 0.5
                return (
                  <tr key={`${item.product_id}-${i}`} className={cn('border-b last:border-0', above && 'bg-warning/10')}>
                    <td className="max-w-32 truncate py-2 pl-2 font-medium">{item.product_name}</td>
                    <td className="py-2 text-right tabular-nums">{agreed !== null ? money(agreed) : '—'}</td>
                    <td className="py-2 text-right tabular-nums">{money(price)}</td>
                    <td className="py-2 pr-1 text-right">
                      {above ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-warning/20 px-1 py-0.5 text-xs font-semibold text-warning-foreground">
                          <ArrowUp className="size-3" />+{pct!.toFixed(0)}%
                        </span>
                      ) : pct !== null && pct < -0.5 ? (
                        <span className="text-xs font-semibold text-success">−{Math.abs(pct).toFixed(0)}%</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    )
  },
)

export function NotesCard({ form }: { form: UseFormReturn<PurchaseFormInput> }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <NotebookPen className="size-5 text-primary" /> Notes
      </h2>
      <Textarea className="min-h-20" placeholder="Add notes (optional)…" {...form.register('notes')} />
      <p className="mt-2 text-xs text-muted-foreground">e.g. delivery notes, quality notes, or other comments.</p>
    </section>
  )
}
