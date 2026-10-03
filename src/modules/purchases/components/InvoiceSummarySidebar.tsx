import { forwardRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import { AlertCircle, ArrowUp, BarChart3, NotebookPen, Percent, Plus, Receipt, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { InvoiceTotals, PurchaseFormInput } from '@/schemas/purchase'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function InvoiceSummaryCard({ form, totals }: { form: UseFormReturn<PurchaseFormInput>; totals: InvoiceTotals }) {
  const { register, watch, setValue, formState } = form
  const items = watch('items')
  const percent = watch('bill_discount_percent')
  const currency = watch('currency_code')
  const rate = Number(watch('exchange_rate')) || 1
  const taxDisabled = watch('tax_disabled')
  const usePercent = percent !== '' && percent !== undefined
  const allStandardRated = items.length > 0 && items.every((i) => Number(i.vat_rate) === 0.05)
  const discount = totals.lineDiscount + totals.billDiscount

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Invoice summary</h2>

      <div className="mb-4 rounded-lg border bg-muted/20 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Percent className="size-4 text-primary" /> Apply bill discount
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Discount (%)
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              className="h-8 text-right tabular-nums"
              {...register('bill_discount_percent')}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Discount amount
            {usePercent ? (
              <Input key="computed" className="h-8 text-right tabular-nums" value={totals.billDiscount.toFixed(2)} disabled readOnly />
            ) : (
              <Input key="amount" type="number" step="0.01" min="0" className="h-8 text-right tabular-nums" {...register('invoice_discount')} />
            )}
          </label>
        </div>
        {usePercent && (
          <button type="button" className="mt-1.5 text-xs text-primary hover:underline" onClick={() => setValue('bill_discount_percent', '', { shouldDirty: true })}>
            Use an amount instead
          </button>
        )}
        {(formState.errors.invoice_discount || formState.errors.bill_discount_percent) && (
          <p className="mt-1 text-xs text-destructive">{formState.errors.invoice_discount?.message ?? formState.errors.bill_discount_percent?.message}</p>
        )}
      </div>

      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="tabular-nums">{formatCurrency(totals.gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            Discount
            {totals.lineDiscount > 0 && totals.billDiscount > 0 && (
              <span className="block text-[11px]">
                items {money(totals.lineDiscount)} + bill {money(totals.billDiscount)}
              </span>
            )}
          </dt>
          <dd className="tabular-nums">{discount ? `−${formatCurrency(discount)}` : formatCurrency(0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Sub total</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(totals.net)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{taxDisabled ? 'Tax (disabled)' : `Tax${allStandardRated ? ' (5%)' : ''}`}</dt>
          <dd className="tabular-nums">{formatCurrency(totals.vat)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <dt className="text-base font-semibold">Net total</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatCurrency(totals.total)}</dd>
        </div>
        {currency !== 'AED' && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>In {currency} (rate {rate})</dt>
            <dd className="tabular-nums">
              {currency} {money(totals.total / rate)}
            </dd>
          </div>
        )}
        {totals.expenses > 0 && (
          <div className="flex justify-between rounded-md bg-muted/40 px-2 py-1.5 text-xs">
            <dt className="text-muted-foreground">+ Other expenses (landing cost only)</dt>
            <dd className="tabular-nums">{formatCurrency(totals.expenses)}</dd>
          </div>
        )}
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

/** Freight, customs, clearing… paid to others; spread into each item's landing cost by value. */
export function OtherExpensesCard({ form }: { form: UseFormReturn<PurchaseFormInput> }) {
  const { control, register, watch, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'expenses' })
  const expenses = watch('expenses')
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Receipt className="size-5 text-primary" /> Other related expenses
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', payee: '', amount: '' })}>
          <Plus /> Add
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Freight, customs, clearing or delivery charges paid to others. Added to the items' landing cost, not to the supplier's bill.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => {
            const err = formState.errors.expenses?.[i]
            return (
              <div key={f.id} className="grid grid-cols-[1fr_6rem_auto] items-start gap-2">
                <div className="space-y-1">
                  <Input className="h-8 text-sm" placeholder="e.g. Freight" aria-invalid={!!err?.description} {...register(`expenses.${i}.description`)} />
                  <Input className="h-7 text-xs" placeholder="Paid to (optional)" {...register(`expenses.${i}.payee`)} />
                </div>
                <Input type="number" step="0.01" min="0" className="h-8 text-right text-sm tabular-nums" placeholder="0.00" aria-invalid={!!err?.amount} {...register(`expenses.${i}.amount`)} />
                <button type="button" onClick={() => remove(i)} className="mt-2 text-muted-foreground hover:text-destructive" aria-label="Remove expense">
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">Expense total</span>
        <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
    </section>
  )
}

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
