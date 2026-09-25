import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils/format'
import type { PurchaseItemInput } from '@/schemas/purchase'
import { VAT_RATE } from './PurchaseLineItemRow'

interface InvoiceSummarySidebarProps {
  items: PurchaseItemInput[]
  notes: string
  onNotesChange: (value: string) => void
}

export function InvoiceSummarySidebar({ items, notes, onNotesChange }: InvoiceSummarySidebarProps) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  const discount = items.reduce((sum, item) => sum + (Number(item.discount_amount) || 0), 0)
  const vat = Math.max(0, subtotal - discount) * VAT_RATE
  const grandTotal = subtotal - discount + vat

  const itemsAboveAgreed = items.filter((item) => {
    const agreed = item.agreed_price ?? null
    const price = Number(item.unit_price) || 0
    return agreed !== null && agreed > 0 && price > agreed * 1.005
  })

  const comparisonRows = items.filter((item) => item.agreed_price !== null && item.agreed_price !== undefined && item.product_name)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT (5%)</span>
            <span className="tabular-nums">{formatCurrency(vat)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <span className="tabular-nums">{formatCurrency(discount)}</span>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Grand total</span>
            <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>

          {itemsAboveAgreed.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-warning-foreground">
                <AlertTriangle className="size-4" />
                Price alerts: {itemsAboveAgreed.length} item{itemsAboveAgreed.length === 1 ? '' : 's'} above agreed price
              </p>
            </div>
          )}

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Approval required</p>
            <p className="mt-0.5 text-muted-foreground">
              This invoice will be sent for approval based on your company policy before it affects stock or
              accounting.
            </p>
          </div>
        </CardContent>
      </Card>

      {comparisonRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier quote comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Contract (AED)</span>
                <span className="text-right">Invoice (AED)</span>
              </div>
              {comparisonRows.map((item, i) => {
                const agreed = item.agreed_price ?? 0
                const price = Number(item.unit_price) || 0
                const isAbove = agreed > 0 && price > agreed * 1.005
                return (
                  <div key={i} className="grid grid-cols-3 gap-2 border-t pt-2">
                    <span className="truncate">{item.product_name}</span>
                    <span className="text-right tabular-nums">{formatCurrency(agreed)}</span>
                    <span className={`text-right tabular-nums ${isAbove ? 'font-medium text-warning-foreground' : ''}`}>
                      {formatCurrency(price)}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. delivery notes, quality notes, or other comments…"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
