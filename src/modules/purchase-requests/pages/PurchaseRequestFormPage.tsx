import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Apple,
  CalendarDays,
  Carrot,
  CheckCircle2,
  CupSoda,
  Drumstick,
  Fish,
  Loader2,
  Milk,
  Minus,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShoppingCart,
  SprayCan,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { ItemThumb } from '@/modules/purchases/components/ItemThumb'
import {
  usePurchaseRequestQuery,
  useRequestCatalog,
  useRequestDashboard,
  useSavePurchaseRequest,
  useSetPurchaseTargets,
  type RequestCatalogItem,
} from '../hooks/usePurchaseRequests'

const VAT = 0.05
const round2 = (n: number) => Math.round(n * 100) / 100

interface CartLine {
  productId: string
  name: string
  unitId: string
  unitCode: string
  imagePath: string | null
  price: number | null
  quantity: number
}

/** A friendly icon for common restaurant purchasing categories. */
function categoryIcon(name: string | null): LucideIcon {
  const n = (name ?? '').toLowerCase()
  if (/veg|produce|salad/.test(n)) return Carrot
  if (/fruit/.test(n)) return Apple
  if (/meat|poultry|chicken|beef|mutton/.test(n)) return Drumstick
  if (/fish|sea/.test(n)) return Fish
  if (/dairy|milk|cheese/.test(n)) return Milk
  if (/dry|grain|rice|flour|spice|grocery/.test(n)) return Wheat
  if (/bev|drink|juice|water/.test(n)) return CupSoda
  if (/clean|chemical|hygiene/.test(n)) return SprayCan
  return Package
}

function Kpi({ icon: Icon, label, value, tone, onEdit }: { icon: LucideIcon; label: string; value: ReactNode; tone?: 'danger' | 'warning' | 'success'; onEdit?: () => void }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3 shadow-sm', tone === 'danger' && 'border-destructive/40 bg-destructive/5')}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn('size-4 text-primary', tone === 'danger' && 'text-destructive')} />
        {label}
        {onEdit && (
          <button type="button" onClick={onEdit} className="ml-auto text-muted-foreground hover:text-primary" aria-label={`Edit ${label}`}>
            <Pencil className="size-3.5" />
          </button>
        )}
      </p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums sm:text-xl', tone === 'danger' && 'text-destructive', tone === 'success' && 'text-success', tone === 'warning' && 'text-warning-foreground')}>
        {value}
      </p>
    </div>
  )
}

export default function PurchaseRequestFormPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedRestaurantId } = useRestaurantScope()
  const { hasPermission } = useAuth()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data: existing, isLoading: loadingExisting } = usePurchaseRequestQuery(id)
  const [restaurantId, setRestaurantId] = useState<string>(selectedRestaurantId ?? '')
  const effectiveRestaurantId = existing?.request.restaurant_id ?? (restaurantId || null)
  const { data: catalog = [], isLoading: loadingCatalog } = useRequestCatalog(effectiveRestaurantId)
  const { data: dashboard } = useRequestDashboard(effectiveRestaurantId, id)
  const saveRequest = useSavePurchaseRequest()
  const setTargets = useSetPurchaseTargets()

  const [cart, setCart] = useState<CartLine[]>([])
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [targetDraft, setTargetDraft] = useState({ target: '', allowance: '' })

  // Load an existing (draft or not-yet-reviewed) request into the cart once
  // (state adjusted during render rather than in an effect).
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (existing && loadedId !== existing.request.id) {
    setLoadedId(existing.request.id)
    setNotes(existing.request.notes ?? '')
    setCart(
      existing.items.map((i) => ({
        productId: i.product_id,
        name: i.products?.name ?? 'Item',
        unitId: i.unit_id,
        unitCode: i.units?.code ?? '',
        imagePath: i.products?.image_path ?? null,
        price: i.unit_price,
        quantity: Number(i.quantity),
      })),
    )
  }

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const item of catalog) {
      const key = item.category_id ?? 'none'
      const entry = map.get(key) ?? { id: key, name: item.category_name ?? 'Other', count: 0 }
      entry.count++
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [catalog])

  const term = search.trim().toLowerCase()
  const visible = catalog.filter(
    (i) =>
      (category === 'all' || (i.category_id ?? 'none') === category) &&
      (!term || `${i.name} ${i.sku ?? ''}`.toLowerCase().includes(term)),
  )

  const qtyOf = (productId: string) => cart.find((c) => c.productId === productId)?.quantity ?? 0

  function setQty(item: Pick<RequestCatalogItem, 'product_id' | 'name' | 'base_unit_id' | 'unit_code' | 'image_path' | 'price'>, qty: number) {
    const quantity = Math.max(0, Math.round(qty * 1000) / 1000)
    setCart((prev) => {
      const i = prev.findIndex((c) => c.productId === item.product_id)
      if (quantity === 0) return i >= 0 ? prev.filter((_, idx) => idx !== i) : prev
      if (i >= 0) return prev.map((c, idx) => (idx === i ? { ...c, quantity } : c))
      return [
        ...prev,
        { productId: item.product_id, name: item.name, unitId: item.base_unit_id, unitCode: item.unit_code, imagePath: item.image_path, price: item.price, quantity },
      ]
    })
  }

  const subtotal = round2(cart.reduce((s, c) => s + round2(c.quantity * (c.price ?? 0)), 0))
  const vat = round2(subtotal * VAT)
  const total = round2(subtotal + vat)
  const unpriced = cart.filter((c) => c.price === null).length

  const target = dashboard?.target ?? null
  const allowance = dashboard?.allowance ?? null
  const todays = round2((dashboard?.sentToday ?? 0) + total)
  const variance = target !== null ? round2(todays - target) : null
  const pct = target ? Math.round((todays / target) * 100) : null
  const overAllowance = target !== null && todays > target + (allowance ?? 0)
  const aboveTarget = variance !== null && variance > 0
  const canEditTargets = hasPermission('restaurants.manage') && !!effectiveRestaurantId
  const readOnly = existing && !['draft', 'requested'].includes(existing.request.status)

  function save(submit: boolean) {
    if (!effectiveRestaurantId || cart.length === 0) return
    saveRequest.mutate({
      submit,
      values: {
        id: existing?.request.id,
        restaurant_id: effectiveRestaurantId,
        notes,
        items: cart.map((c) => ({ product_id: c.productId, unit_id: c.unitId, quantity: c.quantity, notes: '', unit_price: c.price, vat_rate: VAT })),
      },
    })
  }

  if (id && loadingExisting) return <FullScreenSpinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {existing ? `Purchase Request ${existing.request.request_number}` : 'New Purchase Request'}
            {existing?.request.status === 'draft' && <span className="ml-2 rounded-md bg-muted px-2 py-0.5 align-middle text-xs font-semibold">Draft</span>}
          </h1>
          <p className="text-sm text-muted-foreground">My purchase performance — today</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!existing && (
            <Select value={restaurantId || undefined} onValueChange={(v) => { setRestaurantId(v); setCart([]) }}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Select restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> {format(new Date(), 'EEEE, d MMM yyyy')}
          </span>
        </div>
      </div>

      {!effectiveRestaurantId ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Select a restaurant to start ordering.</p>
      ) : (
        <>
          {/* Today's performance */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Wallet} label="Allowance purchase" value={allowance !== null ? formatCurrency(allowance) : 'Not set'} onEdit={canEditTargets ? () => { setTargetDraft({ target: target?.toString() ?? '', allowance: allowance?.toString() ?? '' }); setTargetsOpen(true) } : undefined} />
            <Kpi icon={Target} label="Purchase target" value={target !== null ? formatCurrency(target) : 'Not set'} onEdit={canEditTargets ? () => { setTargetDraft({ target: target?.toString() ?? '', allowance: allowance?.toString() ?? '' }); setTargetsOpen(true) } : undefined} />
            <Kpi icon={ShoppingCart} label="Today's purchase" value={formatCurrency(todays)} />
            <Kpi
              icon={TrendingUp}
              label="Variance"
              value={variance === null ? '—' : `${variance > 0 ? '+' : ''}${formatCurrency(variance)}`}
              tone={variance === null ? undefined : overAllowance ? 'danger' : aboveTarget ? 'warning' : 'success'}
            />
          </div>

          {target !== null && target > 0 && (
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium">Purchase vs target</span>
                <span className={cn('font-bold tabular-nums', overAllowance ? 'text-destructive' : aboveTarget ? 'text-warning-foreground' : 'text-success')}>{pct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', overAllowance ? 'bg-destructive' : aboveTarget ? 'bg-warning' : 'bg-success')}
                  style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                />
              </div>
              <div
                className={cn(
                  'mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
                  overAllowance ? 'bg-destructive/10 text-destructive' : aboveTarget ? 'bg-warning/15 text-warning-foreground' : 'bg-success/10 text-success',
                )}
              >
                {aboveTarget ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {overAllowance
                  ? `Over allowance — ${formatCurrency(variance!)} above target (allowance ${formatCurrency(allowance ?? 0)})`
                  : aboveTarget
                    ? `Above target — your purchase is ${formatCurrency(variance!)} above the target`
                    : `Within target — ${formatCurrency(Math.abs(variance ?? 0))} left today`}
                {dashboard && dashboard.sentTodayCount > 0 && (
                  <span className="ml-auto text-xs font-normal opacity-80">
                    Includes {dashboard.sentTodayCount} request{dashboard.sentTodayCount === 1 ? '' : 's'} sent today
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            {/* Item cards */}
            <section className="min-w-0 space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <CategoryTab active={category === 'all'} onClick={() => setCategory('all')} icon={Package} label="All" count={catalog.length} />
                {categories.map((c) => (
                  <CategoryTab key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} icon={categoryIcon(c.name)} label={c.name} count={c.count} />
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-10 pl-9" placeholder="Search items or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              {loadingCatalog ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No items found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visible.map((item) => {
                    const qty = qtyOf(item.product_id)
                    return (
                      <div key={item.product_id} className={cn('overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow', qty > 0 && 'ring-2 ring-primary')}>
                        <button type="button" className="block w-full" onClick={() => !readOnly && setQty(item, qty + 1)} disabled={!!readOnly} aria-label={`Add ${item.name}`}>
                          <ItemThumb name={item.name} category={item.category_name} imagePath={item.image_path} className="h-24 w-full rounded-none border-0 text-2xl sm:h-28" />
                        </button>
                        <div className="space-y-2 p-2.5">
                          <div>
                            <p className="line-clamp-2 min-h-10 text-sm leading-tight font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.price !== null ? `${formatCurrency(item.price)} / ${item.unit_code}` : `No price yet · ${item.unit_code}`}
                            </p>
                          </div>
                          {qty > 0 ? (
                            <div className="flex items-center justify-between rounded-lg border">
                              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setQty(item, qty - 1)} disabled={!!readOnly} aria-label="Decrease">
                                <Minus />
                              </Button>
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={qty}
                                onChange={(e) => setQty(item, Number(e.target.value) || 0)}
                                disabled={!!readOnly}
                                className="h-8 w-14 border-0 text-center tabular-nums shadow-none focus-visible:ring-0"
                                aria-label={`${item.name} quantity`}
                              />
                              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setQty(item, qty + 1)} disabled={!!readOnly} aria-label="Increase">
                                <Plus />
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" size="sm" className="w-full border-primary text-primary" onClick={() => setQty(item, 1)} disabled={!!readOnly}>
                              <Plus /> Add
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Current order */}
            <aside id="current-order" className="scroll-mt-4 xl:sticky xl:top-0 xl:self-start">
              <section className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="font-semibold">
                    Current purchase order <span className="text-sm font-normal text-muted-foreground">({cart.length} item{cart.length === 1 ? '' : 's'})</span>
                  </h2>
                  {cart.length > 0 && !readOnly && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCart([])}>
                      <Trash2 /> Clear all
                    </Button>
                  )}
                </div>
                {cart.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">Tap items to add them to the order.</p>
                ) : (
                  <ul className="max-h-[45vh] divide-y overflow-y-auto">
                    {cart.map((c, i) => (
                      <li key={c.productId} className="flex items-center gap-2.5 px-4 py-2">
                        <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                        <ItemThumb name={c.name} imagePath={c.imagePath} className="size-8" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.quantity} {c.unitCode} × {c.price !== null ? formatCurrency(c.price) : 'price TBC'}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{c.price !== null ? formatCurrency(round2(c.quantity * c.price)) : '—'}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setCart((prev) => prev.filter((x) => x.productId !== c.productId))}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${c.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-1.5 border-t px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (5%)</span>
                    <span className="tabular-nums">{formatCurrency(vat)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  {unpriced > 0 && <p className="text-xs text-warning-foreground">{unpriced} item{unpriced === 1 ? ' has' : 's have'} no price yet — not included in the total.</p>}
                </div>
                <div className="space-y-3 border-t px-4 py-3">
                  <Textarea placeholder="Notes for head office (optional)…" className="min-h-14" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!!readOnly} />
                  {readOnly ? (
                    <p className="text-center text-sm text-muted-foreground">This request has been reviewed and can no longer be changed.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {existing?.request.status !== 'requested' ? (
                        <Button type="button" variant="outline" size="lg" onClick={() => save(false)} disabled={cart.length === 0 || saveRequest.isPending}>
                          {saveRequest.isPending && !saveRequest.variables?.submit ? <Loader2 className="animate-spin" /> : <Save />} Save PO
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button type="button" size="lg" onClick={() => save(true)} disabled={cart.length === 0 || saveRequest.isPending}>
                        {saveRequest.isPending && saveRequest.variables?.submit ? <Loader2 className="animate-spin" /> : <Send />}
                        {existing?.request.status === 'requested' ? 'Update order' : 'Send order'}
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>

          {/* Below xl the order sits under the item grid — keep its total in reach. */}
          {cart.length > 0 && (
            <div className="sticky bottom-0 z-20 flex items-center gap-3 rounded-xl border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur xl:hidden">
              <ShoppingCart className="size-5 text-primary" />
              <span className="text-sm">
                {cart.length} item{cart.length === 1 ? '' : 's'} · <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
              </span>
              <Button type="button" size="sm" className="ml-auto" onClick={() => document.getElementById('current-order')?.scrollIntoView({ behavior: 'smooth' })}>
                View order
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={targetsOpen} onOpenChange={setTargetsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Daily purchase target</DialogTitle>
            <DialogDescription>For this restaurant. The allowance is how much above the target is still acceptable before it's flagged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-target">Purchase target (AED / day)</Label>
              <Input id="pr-target" type="number" min="0" step="0.01" value={targetDraft.target} onChange={(e) => setTargetDraft((d) => ({ ...d, target: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-allowance">Allowance above target (AED)</Label>
              <Input id="pr-allowance" type="number" min="0" step="0.01" value={targetDraft.allowance} onChange={(e) => setTargetDraft((d) => ({ ...d, allowance: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTargetsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={setTargets.isPending}
              onClick={async () => {
                await setTargets.mutateAsync({
                  restaurantId: effectiveRestaurantId!,
                  target: targetDraft.target === '' ? null : Number(targetDraft.target),
                  allowance: targetDraft.allowance === '' ? null : Number(targetDraft.allowance),
                })
                setTargetsOpen(false)
              }}
            >
              {setTargets.isPending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryTab({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      <Icon className="size-4" />
      {label}
      <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>{count}</span>
    </button>
  )
}
