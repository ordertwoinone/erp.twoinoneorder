import type { Control, UseFormWatch } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/format'
import type { PurchaseFormInput } from '@/schemas/purchase'

const VAT_RATE = 0.05

interface PurchaseLineItemRowProps {
  index: number
  control: Control<PurchaseFormInput>
  watch: UseFormWatch<PurchaseFormInput>
  onRemove: () => void
  canRemove: boolean
}

export function PurchaseLineItemRow({ index, control, watch, onRemove, canRemove }: PurchaseLineItemRowProps) {
  const item = watch(`items.${index}`)
  const quantity = Number(item?.quantity) || 0
  const unitPrice = Number(item?.unit_price) || 0
  const discount = Number(item?.discount_amount) || 0
  const agreedPrice = item?.agreed_price ?? null
  const lastPurchasePrice = item?.last_purchase_price ?? null

  const tax = Math.max(0, quantity * unitPrice - discount) * VAT_RATE
  const lineTotal = quantity * unitPrice - discount + tax
  const variancePct = agreedPrice && agreedPrice > 0 ? ((unitPrice - agreedPrice) / agreedPrice) * 100 : null
  const isAboveAgreed = variancePct !== null && variancePct > 0.5

  return (
    <TableRow className={isAboveAgreed ? 'bg-warning/5' : undefined}>
      <TableCell className="max-w-56">
        <div className="truncate font-medium">{item?.product_name || '—'}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[item?.brand_name, item?.pack_label].filter(Boolean).join(' · ') || item?.unit_code}
        </div>
      </TableCell>
      <TableCell className="w-20">
        <Controller
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => <Input type="number" step="0.001" className="h-8 w-20" {...field} />}
        />
      </TableCell>
      <TableCell className="w-16 text-sm text-muted-foreground">{item?.unit_code ?? '—'}</TableCell>
      <TableCell className="w-28 text-sm tabular-nums text-muted-foreground">
        {agreedPrice !== null ? formatCurrency(agreedPrice) : 'No contract'}
      </TableCell>
      <TableCell className="w-32">
        <Controller
          control={control}
          name={`items.${index}.unit_price`}
          render={({ field }) => <Input type="number" step="0.01" className="h-8 w-28" {...field} />}
        />
        {lastPurchasePrice !== null && Math.abs(lastPurchasePrice - unitPrice) > 0.005 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">Last: {formatCurrency(lastPurchasePrice)}</p>
        )}
      </TableCell>
      <TableCell className="w-28">
        {variancePct !== null ? (
          <Badge variant={isAboveAgreed ? 'warning' : 'success'} className="tabular-nums">
            {variancePct >= 0 ? '↑' : '↓'} {Math.abs(variancePct).toFixed(0)}%
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Matched</span>
        )}
      </TableCell>
      <TableCell className="w-20 text-sm tabular-nums text-muted-foreground">{formatCurrency(tax)}</TableCell>
      <TableCell className="w-28 text-right font-medium tabular-nums">{formatCurrency(lineTotal)}</TableCell>
      <TableCell className="w-10">
        <Button type="button" variant="ghost" size="icon" disabled={!canRemove} onClick={onRemove}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function PriceAlertIcon() {
  return <AlertTriangle className="size-4 text-warning-foreground" />
}

export { VAT_RATE }
