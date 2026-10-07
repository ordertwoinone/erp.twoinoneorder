import { Fragment, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, History, Lock, MoreVertical, Package, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { VAT_RATES, type LineTotals, type PurchaseFormInput } from '@/schemas/purchase'
import type { PreviousPrice } from '../hooks/usePreviousPrices'
import { ItemThumb } from './ItemThumb'
import { PurchasePackagingPanel } from './PurchasePackagingPanel'
import { computePackaging, qty, type UnitLike } from '../packaging'

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
  sku?: string | null
  barcode?: string | null
  image_path?: string | null
}

/**
 * Free-text item description (as on the supplier's invoice). Typing suggests
 * catalogue items; picking one links the line to it and keeps the text.
 */
function DescriptionCell({
  index,
  form,
  products,
  onPickProduct,
}: {
  index: number
  form: UseFormReturn<PurchaseFormInput>
  products: ProductOption[]
  onPickProduct: (index: number, productId: string) => void
}) {
  const { register, watch, setValue, formState } = form
  const item = watch(`items.${index}`)
  const text = item?.description ?? ''
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const error = formState.errors.items?.[index]?.product_id

  const term = text.trim().toLowerCase()
  // Ranked by how many typed words appear in the item's name / code, so invoice
  // wording with extra pack details ("… 6x2kg") still finds the item.
  const suggestions = (() => {
    if (!term) return products.slice(0, 8)
    const words = term.split(/[^a-z0-9]+/).filter((w) => w.length > 1)
    return products
      .map((p) => {
        const hay = `${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase()
        return { p, score: words.filter((w) => hay.includes(w)).length }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
      .slice(0, 8)
      .map((x) => x.p)
  })()

  // Suggest while typing on an unlinked line, or when the text no longer matches the linked item.
  const linkedMatchesText = !!item?.product_id && term === (item.product_name ?? '').trim().toLowerCase()
  const open = focused && !dismissed && !linkedMatchesText && (term.length > 0 || !item?.product_id) && suggestions.length > 0

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div>
          <Input
            className="h-9"
            placeholder="Type item description…"
            autoComplete="off"
            aria-invalid={!!error}
            {...register(`items.${index}.description`, { onChange: () => setDismissed(false) })}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDismissed(true)
              if (e.key === 'Enter' && open) {
                e.preventDefault()
                onPickProduct(index, suggestions[0].id)
                setDismissed(true)
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-80 p-1" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <p className="px-2 py-1 text-[11px] text-muted-foreground">{item?.product_id ? 'Link to a different item' : 'Link to an item'} · Enter picks the first</p>
        {suggestions.map((p) => (
          <button
            key={p.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPickProduct(index, p.id)
              setDismissed(true)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <ItemThumb name={p.name} imagePath={p.image_path} className="size-7" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {p.sku && <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>}
          </button>
        ))}
      </PopoverContent>
      {item?.product_id ? (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ItemThumb name={item.product_name ?? ''} category={item.category_name} imagePath={item.image_path} className="size-5 rounded text-[8px]" />
          <span className="truncate">
            Item: <span className="font-medium text-foreground">{item.product_name}</span>
            {[item.brand_name, item.pack_label || item.size_label].filter(Boolean).length > 0 &&
              ` · ${[item.brand_name, item.pack_label || item.size_label].filter(Boolean).join(' · ')}`}
          </span>
          {text.trim() !== (item.product_name ?? '') && (
            <button
              type="button"
              className="shrink-0 text-primary hover:underline"
              onClick={() => setValue(`items.${index}.description`, item.product_name ?? '', { shouldDirty: true })}
            >
              Use item name
            </button>
          )}
        </div>
      ) : (
        <p className={cn('mt-1 text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ? 'Pick an item from the suggestions' : 'Not linked to an item yet'}
        </p>
      )}
    </Popover>
  )
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
  unitsById,
  stockUnit,
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
  unitsById: Map<string, UnitLike>
  /** The item's stock unit (what stock is counted in, e.g. kg). */
  stockUnit: UnitLike | undefined
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
  const basis = item?.price_basis ?? 'unit'
  const pack = item ? computePackaging(item, unitsById.get(item.unit_id), stockUnit, unitsById) : null
  const converted = !!pack && !!stockUnit && pack.stockFactor !== 1
  const [expanded, setExpanded] = useState(() => !!item && (Number(item.pack_size) > 1 || Number(item.piece_weight) > 0 || basis !== 'unit'))
  const setPrice = (value: number) => {
    setValue(`items.${index}.price_basis`, 'unit')
    setValue(`items.${index}.unit_price`, value, { shouldDirty: true })
    if (foreign && exchangeRate > 0) setValue(`items.${index}.foreign_unit_price`, Math.round((value / exchangeRate) * 10000) / 10000)
  }

  return (
    <Fragment>
      <TableRow className={cn('align-top', isAbove && 'bg-warning/5', expanded && 'border-b-0')}>
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
        <TableCell className="min-w-64">
          <DescriptionCell index={index} form={form} products={products} onPickProduct={onPickProduct} />
          {item?.product_id && pack && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                'mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] hover:bg-muted',
                converted ? 'border-primary/30 bg-primary/5 text-primary' : 'text-muted-foreground',
              )}
              title="Packaging and stock conversion"
            >
              <Package className="size-3" />
              {converted
                ? `${qty(pack.unitsReceived)} ${item.unit_code ?? ''} → ${qty(pack.stockQuantity)} ${stockUnit?.code ?? ''} in stock`
                : 'Packaging'}
            </button>
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
                readOnly={foreign || basis !== 'unit'}
                title={
                  basis !== 'unit'
                    ? `Calculated from the rate per ${basis === 'piece' ? 'piece' : 'kg'} — change it in the packaging panel`
                    : foreign
                      ? `Calculated from the ${currencyCode} price × rate`
                      : undefined
                }
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
        <TableCell className="w-20">
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={expanded ? 'Hide packaging' : 'Show packaging'}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
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
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className={cn('hover:bg-transparent', isAbove && 'bg-warning/5')}>
          <TableCell colSpan={foreign ? 17 : 16} className="bg-muted/30 px-3 pt-1 pb-4 whitespace-normal">
            <PurchasePackagingPanel
              index={index}
              form={form}
              line={line}
              units={units}
              unitsById={unitsById}
              stockUnit={stockUnit}
              previous={previous}
              currencyCode={currencyCode}
              exchangeRate={exchangeRate}
              taxDisabled={taxDisabled}
              onUnitChange={onUnitChange}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
