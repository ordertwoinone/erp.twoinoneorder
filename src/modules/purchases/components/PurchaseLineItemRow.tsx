import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { ArrowDown, ArrowUp, CheckCircle2, MoreVertical, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { VAT_RATES, type LineTotals, type PurchaseFormInput } from '@/schemas/purchase'
import { ItemThumb } from './ItemThumb'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface UnitOption {
  id: string
  code: string
  name: string
}
export interface ProductOption {
  id: string
  name: string
}

export function PurchaseLineItemRow({
  index,
  form,
  line,
  units,
  products,
  onPickProduct,
  onUnitChange,
  onRemove,
}: {
  index: number
  form: UseFormReturn<PurchaseFormInput>
  line: LineTotals
  units: UnitOption[]
  products: ProductOption[]
  onPickProduct: (index: number, productId: string) => void
  onUnitChange: (index: number, unitId: string) => void
  onRemove: () => void
}) {
  const { control, watch, setValue, formState } = form
  const item = watch(`items.${index}`)
  const errors = formState.errors.items?.[index]
  const unitPrice = Number(item?.unit_price) || 0
  const agreed = item?.agreed_price ?? null
  const diff = agreed !== null ? unitPrice - agreed : null
  const pct = agreed && agreed > 0 && diff !== null ? (diff / agreed) * 100 : null
  const isAbove = pct !== null && pct > 0.5
  const isBelow = pct !== null && pct < -0.5

  return (
    <TableRow className={cn('align-top', isAbove && 'bg-warning/5')}>
      <TableCell className="pt-4 text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="min-w-52">
        {item?.product_id ? (
          <div className="flex items-center gap-3">
            <ItemThumb name={item.product_name ?? ''} category={item.category_name} />
            <div className="min-w-0">
              <p className="truncate font-medium">{item.product_name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.size_label || item.unit_code}</p>
            </div>
          </div>
        ) : (
          <div>
            <Select value="" onValueChange={(v) => onPickProduct(index, v)}>
              <SelectTrigger className="h-9 w-full" aria-invalid={!!errors?.product_id}>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors?.product_id && <p className="mt-1 text-xs text-destructive">{errors.product_id.message}</p>}
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-28 text-sm">
        <p>{item?.brand_name || '—'}</p>
        <p className="text-xs text-muted-foreground">{item?.pack_label || ''}</p>
      </TableCell>
      <TableCell className="w-20">
        <Controller
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => <Input type="number" step="0.001" min="0" className="h-9 w-16" aria-invalid={!!errors?.quantity} {...field} />}
        />
      </TableCell>
      <TableCell className="w-32">
        <Select value={item?.unit_id || undefined} onValueChange={(v) => onUnitChange(index, v)}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-28">
        <div className="flex h-9 items-center justify-end rounded-md border bg-muted/30 px-2.5 text-sm tabular-nums">
          {agreed !== null ? money(agreed) : <span className="text-xs text-muted-foreground">No contract</span>}
        </div>
      </TableCell>
      <TableCell className="w-28">
        <Controller
          control={control}
          name={`items.${index}.unit_price`}
          render={({ field }) => (
            <Input type="number" step="0.01" min="0" className="h-9 w-24 text-right tabular-nums" aria-invalid={!!errors?.unit_price} {...field} />
          )}
        />
        {item?.last_purchase_price != null && Math.abs(item.last_purchase_price - unitPrice) > 0.005 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">Last: {money(item.last_purchase_price)}</p>
        )}
      </TableCell>
      <TableCell className="w-28">
        {pct === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : isAbove || isBelow ? (
          <div>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                isAbove ? 'bg-warning/20 text-warning-foreground' : 'bg-success/15 text-success-foreground',
              )}
            >
              {isAbove ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {isAbove ? '+' : '−'}
              {Math.abs(pct).toFixed(0)}%
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {diff! > 0 ? '+' : '−'}
              {money(Math.abs(diff!))}
            </p>
          </div>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success-foreground">
              <CheckCircle2 className="size-3" /> Matched
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">0.00</p>
          </div>
        )}
      </TableCell>
      <TableCell className="w-24">
        <Controller
          control={control}
          name={`items.${index}.vat_rate`}
          render={({ field }) => (
            <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell className="w-28 pt-4 text-right font-semibold tabular-nums">{money(line.total)}</TableCell>
      <TableCell className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Line actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {agreed !== null && (
              <DropdownMenuItem onSelect={() => setValue(`items.${index}.unit_price`, agreed, { shouldDirty: true })}>
                <RotateCcw /> Use contract price
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 /> Remove item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
