import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { AlertTriangle, Boxes, Info, Package, ShoppingBag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { VAT_RATES, type LineTotals, type PurchaseFormInput } from '@/schemas/purchase'
import { computePackaging, isWeightUnit, qty, unitPriceFromBasis, type PriceBasis, type UnitLike } from '../packaging'
import type { PreviousPrice } from '../hooks/usePreviousPrices'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "carton" / "cartons" from the unit's name; codes like kg stay as they are. */
function unitWord(unit: UnitLike | null | undefined, count: number) {
  if (!unit) return count === 1 ? 'unit' : 'units'
  const word = (unit.name || unit.code).toLowerCase()
  if (measureLike(word)) return unit.code
  return count === 1 || word.endsWith('s') ? word : `${word}s`
}
const measureLike = (w: string) => ['kilogram', 'gram', 'litre', 'liter', 'millilitre', 'milliliter'].includes(w)

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Package; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Icon className="size-7 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function ReadOnly({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className={cn('flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm tabular-nums', className)}>{value}</p>
    </div>
  )
}

/**
 * Packaging, purchase entry and stock conversion for one purchase line:
 * 1 carton = 6 pieces x 2 kg = 12 kg; 5 cartons -> 60 kg added to stock.
 */
export function PurchasePackagingPanel({
  index,
  form,
  line,
  units,
  unitsById,
  stockUnit,
  previous,
  currencyCode,
  exchangeRate,
  taxDisabled,
  onUnitChange,
}: {
  index: number
  form: UseFormReturn<PurchaseFormInput>
  line: LineTotals
  units: UnitLike[]
  unitsById: Map<string, UnitLike>
  stockUnit: UnitLike | undefined
  previous: PreviousPrice | undefined
  currencyCode: string
  exchangeRate: number
  taxDisabled: boolean
  onUnitChange: (index: number, unitId: string) => void
}) {
  const { control, watch, setValue, getValues } = form
  const item = watch(`items.${index}`)
  if (!item) return null

  const purchaseUnit = unitsById.get(item.unit_id)
  const pack = computePackaging(item, purchaseUnit, stockUnit, unitsById)
  const basis: PriceBasis = item.price_basis ?? 'unit'
  const weightUnits = units.filter(isWeightUnit)
  const wCode = pack.weightUnit?.code ?? 'kg'
  const one = unitWord(purchaseUnit, 1)
  const many = unitWord(purchaseUnit, 2)
  const sCode = stockUnit?.code ?? ''
  const hasWeight = pack.pieceWeight > 0 && !!pack.weightUnit
  const foreign = currencyCode !== 'AED'
  const agreed = item.agreed_price ?? null

  /** Re-derive the per-unit price when the rate is quoted per piece or per kg. */
  function recalc() {
    const it = getValues(`items.${index}`)
    const b = it.price_basis ?? 'unit'
    if (b === 'unit') return
    const p = computePackaging(it, unitsById.get(it.unit_id), stockUnit, unitsById)
    const price = Math.round(unitPriceFromBasis(b, Number(it.basis_rate) || 0, p) * 100) / 100
    setValue(`items.${index}.unit_price`, price, { shouldDirty: true })
    if (foreign && exchangeRate > 0) setValue(`items.${index}.foreign_unit_price`, Math.round((price / exchangeRate) * 10000) / 10000)
  }

  function changeBasis(next: PriceBasis) {
    const it = getValues(`items.${index}`)
    const price = Number(it.unit_price) || 0
    // Keep the price the same when switching: derive the per-piece / per-kg rate from it.
    if (next === 'piece') setValue(`items.${index}.basis_rate`, Math.round((price / (pack.piecesPerUnit || 1)) * 10000) / 10000)
    if (next === 'weight') setValue(`items.${index}.basis_rate`, pack.weightPerUnit > 0 ? Math.round((price / pack.weightPerUnit) * 10000) / 10000 : '')
    setValue(`items.${index}.price_basis`, next, { shouldDirty: true })
    recalc()
  }

  const basisLabel = (b: PriceBasis) => (b === 'piece' ? 'piece' : b === 'weight' ? wCode : one)
  const costPerStock = pack.stockQuantity > 0 && line.landingCost !== null ? (line.landingCost * pack.unitsReceived) / pack.stockQuantity : null

  return (
    <div className="space-y-3">
      {/* Packaging details */}
      <section className="rounded-lg border bg-card p-3">
        <h4 className="mb-2 text-sm font-semibold">Packaging details</h4>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Purchase unit</Label>
            <Select value={item.unit_id || undefined} onValueChange={(v) => { onUnitChange(index, v); requestAnimationFrame(recalc) }}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.code} ({u.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pieces per {one}</Label>
            <Controller
              control={control}
              name={`items.${index}.pack_size`}
              render={({ field }) => (
                <Input type="number" step="0.001" min="0" placeholder="1" className="h-9" {...field} value={field.value ?? ''} onChange={(e) => { field.onChange(e.target.value); recalc() }} />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Weight per piece</Label>
            <div className="flex">
              <Controller
                control={control}
                name={`items.${index}.piece_weight`}
                render={({ field }) => (
                  <Input type="number" step="0.001" min="0" placeholder="e.g. 2" className="h-9 min-w-0 rounded-r-none" {...field} value={field.value ?? ''} onChange={(e) => {
                    field.onChange(e.target.value)
                    // Default the weight unit to the stock unit (or kg) the first time a weight is typed.
                    if (!getValues(`items.${index}.piece_weight_unit_id`)) {
                      const fallback = isWeightUnit(stockUnit) ? stockUnit : weightUnits.find((u) => u.code.toLowerCase() === 'kg')
                      if (fallback) setValue(`items.${index}.piece_weight_unit_id`, fallback.id)
                    }
                    recalc()
                  }} />
                )}
              />
              <Controller
                control={control}
                name={`items.${index}.piece_weight_unit_id`}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => { field.onChange(v); recalc() }}>
                    <SelectTrigger className="h-9 w-20 shrink-0 rounded-l-none border-l-0" aria-label="Weight unit">
                      <SelectValue placeholder="kg" />
                    </SelectTrigger>
                    <SelectContent>
                      {weightUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <ReadOnly label={`Weight per ${one}`} value={hasWeight ? `${qty(pack.weightPerUnit)} ${wCode}` : '—'} className="border-primary/30 bg-primary/10 font-semibold text-primary" />
          <div className="text-sm lg:border-l lg:pl-4">
            <p className="font-semibold">
              {hasWeight
                ? `1 ${one} = ${qty(pack.piecesPerUnit)} pieces × ${qty(pack.pieceWeight)} ${wCode} = ${qty(pack.weightPerUnit)} ${wCode}`
                : pack.piecesPerUnit > 1
                  ? `1 ${one} = ${qty(pack.piecesPerUnit)} pieces`
                  : `1 ${one}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {sCode ? `This packaging converts the purchase quantity to stock (${sCode}).` : 'Pick an item to see its stock unit.'}
            </p>
          </div>
        </div>
      </section>

      {/* Purchase entry */}
      <section className="space-y-3 rounded-lg border bg-card p-3">
        <h4 className="text-sm font-semibold">Purchase entry</h4>
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_8rem]">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quantity ({many})</Label>
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => <Input type="number" step="0.001" min="0" className="h-9" {...field} />}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Price basis</Label>
            <Select value={basis} onValueChange={(v) => changeBasis(v as PriceBasis)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unit">Per {one}</SelectItem>
                <SelectItem value="piece" disabled={pack.piecesPerUnit <= 1}>
                  Per piece
                </SelectItem>
                <SelectItem value="weight" disabled={!hasWeight}>
                  Per {wCode}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rate (AED / {basisLabel(basis)})</Label>
            {basis === 'unit' ? (
              <Controller
                control={control}
                name={`items.${index}.unit_price`}
                render={({ field }) => (
                  <Input type="number" step="0.01" min="0" placeholder="Enter rate" className="h-9" readOnly={foreign} {...field} onChange={(e) => {
                    field.onChange(e.target.value)
                    const v = Number(e.target.value)
                    if (foreign && exchangeRate > 0 && Number.isFinite(v)) setValue(`items.${index}.foreign_unit_price`, Math.round((v / exchangeRate) * 10000) / 10000)
                  }} />
                )}
              />
            ) : (
              <Controller
                control={control}
                name={`items.${index}.basis_rate`}
                render={({ field }) => (
                  <Input type="number" step="0.0001" min="0" placeholder="Enter rate" className="h-9" {...field} value={field.value ?? ''} onChange={(e) => { field.onChange(e.target.value); recalc() }} />
                )}
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              {basis === 'unit'
                ? `Amount = ${many} × rate per ${one}`
                : basis === 'piece'
                  ? `Rate per ${one} = ${qty(pack.piecesPerUnit)} pieces × rate = ${money(Number(item.unit_price) || 0)}`
                  : `Rate per ${one} = ${qty(pack.weightPerUnit)} ${wCode} × rate = ${money(Number(item.unit_price) || 0)}`}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">VAT %</Label>
            {taxDisabled ? (
              <p className="flex h-9 items-center text-xs text-muted-foreground">Tax off</p>
            ) : (
              <Controller
                control={control}
                name={`items.${index}.vat_rate`}
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="h-9 w-full">
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
          </div>
        </div>

        {/* Conversion summary */}
        <div className="grid items-center gap-3 rounded-lg bg-primary/5 p-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <p className="flex flex-wrap items-center gap-2 text-lg text-primary">
            <Package className="size-6 shrink-0" />
            <span>
              {qty(pack.unitsReceived)} {unitWord(purchaseUnit, pack.unitsReceived)}
              {pack.piecesPerUnit > 1 && ` × ${qty(pack.piecesPerUnit)} pieces`}
              {hasWeight && ` × ${qty(pack.pieceWeight)} ${wCode}`} ={' '}
              <span className="text-2xl font-bold">
                {hasWeight ? `${qty(pack.totalWeight)} ${wCode}` : pack.piecesPerUnit > 1 ? `${qty(pack.totalPieces)} pieces` : `${qty(pack.unitsReceived)} ${unitWord(purchaseUnit, pack.unitsReceived)}`}
              </span>
            </span>
          </p>
          <Stat
            icon={Package}
            label={`${many[0].toUpperCase()}${many.slice(1)} purchased`}
            value={qty(pack.unitsPurchased)}
            hint={Number(item.foc_quantity) > 0 ? `+ ${qty(Number(item.foc_quantity))} FOC` : undefined}
          />
          <Stat icon={Boxes} label="Total pieces" value={qty(pack.totalPieces)} />
          <Stat icon={ShoppingBag} label="Total weight" value={hasWeight ? `${qty(pack.totalWeight)} ${wCode}` : '—'} />
        </div>
      </section>

      {/* Additional purchase options */}
      <section className="rounded-lg border bg-card p-3">
        <h4 className="mb-2 text-sm font-semibold">Additional purchase options</h4>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <ReadOnly label="Previous price" value={previous?.supplierPrice != null ? `${money(previous.supplierPrice)} / ${previous.supplierUnit ?? one}` : 'First purchase'} />
          <ReadOnly label="Lock price" value={agreed !== null ? money(agreed) : 'Not locked'} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Discount / {one} (AED)</Label>
            <Controller
              control={control}
              name={`items.${index}.unit_discount`}
              render={({ field }) => <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-9" {...field} value={field.value ?? ''} />}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">FOC {many}</Label>
            <Controller
              control={control}
              name={`items.${index}.foc_quantity`}
              render={({ field }) => <Input type="number" step="0.001" min="0" placeholder="0" className="h-9" {...field} value={field.value ?? ''} />}
            />
          </div>
          <ReadOnly label="Amount before VAT (AED)" value={line.net > 0 ? money(line.net) : '—'} />
          <ReadOnly label="VAT amount (AED)" value={line.net > 0 ? money(line.vat) : '—'} />
          <ReadOnly label="Total incl. VAT (AED)" value={line.net > 0 ? money(line.total) : '—'} className="font-semibold" />
        </div>
      </section>

      {/* Stock result */}
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-sm', pack.converts ? 'bg-primary/5 text-primary' : 'bg-warning/15 text-warning-foreground')}>
        {pack.converts ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}
        <span>
          Stock unit: <span className="font-semibold">{sCode || '—'}</span>
        </span>
        <span>·</span>
        <span>
          Stock added: <span className="font-semibold">{qty(pack.stockQuantity)} {sCode}</span>
        </span>
        {costPerStock !== null && pack.stockFactor !== 1 && (
          <>
            <span>·</span>
            <span>
              Cost per {sCode}: <span className="font-semibold">{money(costPerStock)}</span>
            </span>
          </>
        )}
        {!pack.converts && (
          <span className="basis-full text-xs">
            Add the pieces per {one}
            {isWeightUnit(stockUnit) ? ' and weight per piece' : ''} so {many} convert to {sCode}. Until then 1 {one} counts as 1 {sCode}.
          </span>
        )}
      </div>
    </div>
  )
}
