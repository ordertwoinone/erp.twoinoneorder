import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, CheckCircle2, History, Lock, MoreVertical, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { VAT_RATES, type LineTotals, type PurchaseFormInput } from '@/schemas/purchase'
import type { PreviousPrice } from '../hooks/usePreviousPrices'
import { ItemThumb } from './ItemThumb'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortDate = (d: string | null) => (d ? format(parseISO(d), 'd MMM yy') : '')

export interface UnitOption {
  id: string
  code: string
  name: string
}
export interface ProductOption {
  id: string
  name: string
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) {
    return <span className="text-[11px] font-medium text-muted-foreground">Same</span>
  }
  const up = pct > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold', up ? 'bg-warning/20 text-warning-foreground' : 'bg-success/15 text-success')}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

/** Last price from this supplier, with a hint when another supplier was cheaper. */
function PreviousPriceCell({ previous, current, loading }: { previous: PreviousPrice | undefined; current: number; loading: boolean }) {
  if (loading && !previous) return <span className="text-xs text-muted-foreground">…</span>
  if (!previous || (previous.supplierPrice === null && previous.anyPrice === null)) {
    return <span className="text-xs text-muted-foreground">First purchase</span>
  }
  const cheaperElsewhere =
    previous.anyPrice !== null && previous.anySupplier && previous.anyPrice < (previous.supplierPrice ?? current) - 0.005 && previous.anyPrice < current - 0.005

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-default">
          {previous.supplierPrice !== null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-medium tabular-nums">{money(previous.supplierPrice)}</span>
                <ChangeBadge current={current} previous={previous.supplierPrice} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {previous.supplierUnit ? `per ${previous.supplierUnit} · ` : ''}
                {shortDate(previous.supplierDate)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Not from this supplier</p>
          )}
          {cheaperElsewhere && <p className="text-[11px] font-medium text-success">Cheaper: {money(previous.anyPrice!)}</p>}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">
        {previous.supplierPrice !== null ? (
          <p>
            This supplier: {money(previous.supplierPrice)} / {previous.supplierUnit} on {shortDate(previous.supplierDate)}
            {previous.supplierQuantity ? ` (qty ${previous.supplierQuantity})` : ''}
          </p>
        ) : (
          <p>Never bought from this supplier.</p>
        )}
        {previous.anyPrice !== null && (
          <p>
            Latest from any supplier: {money(previous.anyPrice)} / {previous.anyUnit} — {previous.anySupplier}, {shortDate(previous.anyDate)}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function PurchaseLineItemRow({
  index,
  form,
  line,
  units,
  products,
  previous,
  previousLoading,
  currencyCode,
  exchangeRate,
  taxDisabled,
  onPickProduct,
  onUnitChange,
  onRemove,
  onLockPrice,
}: {
  index: number
  form: UseFormReturn<PurchaseFormInput>
  line: LineTotals
  units: UnitOption[]
  products: ProductOption[]
  previous: PreviousPrice | undefined
  previousLoading: boolean
  currencyCode: string
  exchangeRate: number
  taxDisabled: boolean
  onPickProduct: (index: number, productId: string) => void
  onUnitChange: (index: number, unitId: string) => void
  onRemove: () => void
  /** Save the line's current price as the supplier's locked (agreed) price. Omit when the user can't manage supplier prices. */
  onLockPrice?: (scope: 'restaurant' | 'all') => void
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
  const foreign = currencyCode !== 'AED'
  const setPrice = (value: number) => {
    setValue(`items.${index}.unit_price`, value, { shouldDirty: true })
    if (foreign && exchangeRate > 0) setValue(`items.${index}.foreign_unit_price`, Math.round((value / exchangeRate) * 10000) / 10000)
  }

  return (
    <TableRow className={cn('align-top', isAbove && 'bg-warning/5')}>
      {/* Same order as a supplier tax invoice: code, description, UOM, qty, rate, discount, amounts, VAT. */}
      <TableCell className="pt-4 text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="min-w-24 pt-4 text-xs tabular-nums">
        {item?.sku || item?.barcode ? (
          <>
            <p className="font-medium">{item.sku || item.barcode}</p>
            {item.sku && item.barcode && <p className="text-muted-foreground">{item.barcode}</p>}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-56">
        {item?.product_id ? (
          <div className="flex items-center gap-3">
            <ItemThumb name={item.product_name ?? ''} category={item.category_name} />
            <div className="min-w-0">
              <p className="truncate font-medium">{item.product_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[item.brand_name, item.pack_label || item.size_label].filter(Boolean).join(' · ') || item.unit_code}
              </p>
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
      <TableCell className="w-28">
        <Select value={item?.unit_id || undefined} onValueChange={(v) => onUnitChange(index, v)}>
          <SelectTrigger className="h-9 w-24" title={units.find((u) => u.id === item?.unit_id)?.name}>
            <SelectValue placeholder="UOM" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-20">
        <Controller
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => <Input type="number" step="0.001" min="0" className="h-9 w-16" aria-invalid={!!errors?.quantity} {...field} />}
        />
      </TableCell>
      {foreign && (
        <TableCell className="w-28">
          <Controller
            control={control}
            name={`items.${index}.foreign_unit_price`}
            render={({ field }) => (
              <Input
                type="number"
                step="0.0001"
                min="0"
                className="h-9 w-24 text-right tabular-nums"
                {...field}
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value)
                  const v = Number(e.target.value)
                  setValue(`items.${index}.unit_price`, Number.isFinite(v) ? Math.round(v * exchangeRate * 100) / 100 : 0, { shouldDirty: true })
                }}
              />
            )}
          />
        </TableCell>
      )}
      <TableCell className="w-28">
        <Controller
          control={control}
          name={`items.${index}.unit_price`}
          render={({ field }) => (
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-9 w-24 text-right tabular-nums"
              aria-invalid={!!errors?.unit_price}
              readOnly={foreign}
              title={foreign ? `Calculated from the ${currencyCode} price × rate` : undefined}
              {...field}
            />
          )}
        />
      </TableCell>
      <TableCell className="min-w-32">
        <PreviousPriceCell previous={previous} current={unitPrice} loading={previousLoading} />
      </TableCell>
      <TableCell className="w-28">
        {agreed === null ? (
          <span className="text-xs text-muted-foreground">Not locked</span>
        ) : (
          <div>
            <p className="flex items-center gap-1 text-sm tabular-nums">
              <Lock className="size-3 text-muted-foreground" />
              {money(agreed)}
            </p>
            {isAbove || isBelow ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                  isAbove ? 'bg-warning/20 text-warning-foreground' : 'bg-success/15 text-success',
                )}
              >
                {isAbove ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(pct!).toFixed(0)}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                <CheckCircle2 className="size-3" /> Matched
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="w-24">
        <Controller
          control={control}
          name={`items.${index}.unit_discount`}
          render={({ field }) => (
            <Input type="number" step="0.01" min="0" placeholder="0.00" title="Discount per unit (AED)" className="h-9 w-20 text-right tabular-nums" {...field} value={field.value ?? ''} />
          )}
        />
        {line.billDiscount > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">+{money(line.billDiscount)} bill</p>}
      </TableCell>
      <TableCell className="w-28 pt-4 text-right tabular-nums">{money(line.net)}</TableCell>
      <TableCell className="w-24">
        {taxDisabled ? (
          <span className="flex h-9 items-center text-xs text-muted-foreground">Tax off</span>
        ) : (
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
        )}
      </TableCell>
      <TableCell className="w-24 pt-4 text-right tabular-nums">{money(line.vat)}</TableCell>
      <TableCell className="w-28 pt-4 text-right font-semibold tabular-nums">{money(line.total)}</TableCell>
      <TableCell className="w-20 border-l">
        <Controller
          control={control}
          name={`items.${index}.foc_quantity`}
          render={({ field }) => (
            <Input type="number" step="0.001" min="0" placeholder="0" title="Free of charge quantity" className="h-9 w-16" {...field} value={field.value ?? ''} />
          )}
        />
      </TableCell>
      <TableCell className="w-28 pt-4 text-right text-sm tabular-nums" title="Cost per unit received, incl. free qty and other expenses">
        {line.landingCost !== null ? money(line.landingCost) : '—'}
      </TableCell>
      <TableCell className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Line actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {previous?.supplierPrice != null && (
              <DropdownMenuItem onSelect={() => setPrice(previous.supplierPrice!)}>
                <History /> Use previous price ({money(previous.supplierPrice)})
              </DropdownMenuItem>
            )}
            {agreed !== null && (
              <DropdownMenuItem onSelect={() => setPrice(agreed)}>
                <RotateCcw /> Use locked price
              </DropdownMenuItem>
            )}
            {onLockPrice && item?.product_id && unitPrice > 0 && (
              <>
                <DropdownMenuItem onSelect={() => onLockPrice('restaurant')}>
                  <Lock /> Lock {money(unitPrice)} for this restaurant
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onLockPrice('all')}>
                  <Lock /> Lock {money(unitPrice)} for all restaurants
                </DropdownMenuItem>
              </>
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
