import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { format, isToday, parseISO } from 'date-fns'
import {
  Apple,
  BadgePercent,
  Building2,
  CalendarDays,
  Carrot,
  CheckCircle2,
  CupSoda,
  Drumstick,
  Eye,
  EyeOff,
  FilePlus2,
  Fish,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Milk,
  Minus,
  Package,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  ShoppingCart,
  SprayCan,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useAuth } from '@/hooks/useAuth'
import { useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { ItemThumb } from '@/modules/purchases/components/ItemThumb'
import {
  useEmployeeRequestAccess,
  usePurchaseRequestQuery,
  useRequestCatalog,
  useRequestDashboard,
  useRequestEmployees,
  useSavePurchaseRequest,
  useSetEmployeeRequestAccess,
  useSetPurchaseBudget,
  useToggleRequestPin,
  useVerifyRequestPin,
  type ChefSession,
  type RequestCatalogItem,
  type RequestDashboard,
} from '../hooks/usePurchaseRequests'

const VAT = 0.05
const NOTES_MAX = 300
const round2 = (n: number) => Math.round(n * 100) / 100
const todayIso = () => format(new Date(), 'yyyy-MM-dd')

interface CartLine {
  productId: string
  name: string
  sku: string | null
  imagePath: string | null
  unitId: string
  unitCode: string
  supplierId: string | null
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
  if (/clean|chemical|hygiene|pack/.test(n)) return SprayCan
  return Package
}

/** Price for an item from a supplier in a unit: that supplier's price, else any supplier's, else the usual price. */
function priceFor(item: RequestCatalogItem, supplierId: string | null, unitId: string): number | null {
  const exact = item.suppliers.find((s) => s.supplier_id === supplierId && s.unit_id === unitId)
  if (exact) return exact.price
  const sameUnit = item.suppliers.find((s) => s.unit_id === unitId)
  if (sameUnit) return sameUnit.price
  return unitId === item.base_unit_id ? item.price : null
}

function defaultSupplier(item: RequestCatalogItem): string | null {
  return (item.suppliers.find((s) => s.unit_id === item.base_unit_id) ?? item.suppliers[0])?.supplier_id ?? null
}

const uniqueSuppliers = (item: RequestCatalogItem) => [...new Map(item.suppliers.map((s) => [s.supplier_id, s])).values()]

// Budget bands: 0–60 good, 60–80 safe, 80–100 warning, over 100 danger.
function band(pct: number) {
  if (pct <= 60) return { text: 'text-success' }
  if (pct <= 80) return { text: 'text-lime-600 dark:text-lime-400' }
  if (pct <= 100) return { text: 'text-warning-foreground' }
  return { text: 'text-destructive' }
}

function GradientBar({ pct }: { pct: number }) {
  const pos = Math.min(Math.max(pct, 0), 120) / 120
  return (
    <div className="relative h-3 rounded-full bg-linear-to-r from-success via-lime-400 via-50% to-destructive">
      <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow" style={{ left: `${pos * 100}%` }} />
    </div>
  )
}

function Legend({ items }: { items: { dot: string; title: string; sub: string; subClass?: string }[] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.title} className="flex items-start gap-1.5">
          <span className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', i.dot)} />
          <span className="leading-tight">
            {i.title}
            <span className={cn('block text-muted-foreground', i.subClass)}>{i.sub}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function TopCard({ icon: Icon, title, value, valueClass, onEdit, children }: { icon: LucideIcon; title: string; value: ReactNode; valueClass?: string; onEdit?: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-start gap-3">
        <Icon className="mt-0.5 size-6 shrink-0 text-primary" />
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${title}`}>
            <Pencil className="size-4" />
          </button>
        )}
        <span className={cn('text-2xl leading-none font-bold tabular-nums', valueClass)}>{value}</span>
      </div>
      {children}
    </section>
  )
}

function InfoCard({ icon: Icon, label, children, action }: { icon: LucideIcon; label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <Icon className="size-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
      {action}
    </div>
  )
}

export default function PurchaseRequestFormPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedRestaurantId } = useRestaurantScope()
  const { hasPermission } = useAuth()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data: units = [] } = useUnitsOptions()
  const { data: existing, isLoading: loadingExisting } = usePurchaseRequestQuery(id)

  const [restaurantId, setRestaurantId] = useState<string>(selectedRestaurantId ?? '')
  const [date, setDate] = useState(todayIso())
  const effectiveRestaurantId = existing?.request.restaurant_id ?? (restaurantId || null)

  const { data: catalog = [], isLoading: loadingCatalog } = useRequestCatalog(effectiveRestaurantId)
  const { data: dashboard } = useRequestDashboard(effectiveRestaurantId, date, id)
  const { data: employees = [] } = useRequestEmployees(effectiveRestaurantId)
  const saveRequest = useSavePurchaseRequest()
  const togglePin = useToggleRequestPin(effectiveRestaurantId)
  const verifyPin = useVerifyRequestPin()

  const [cart, setCart] = useState<CartLine[]>([])
  const [picks, setPicks] = useState<Record<string, { supplierId: string | null; unitId: string }>>({})
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [chef, setChef] = useState<ChefSession | null>(null)
  const [chefPick, setChefPick] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)

  // Load a saved draft / unreviewed request into the order once (adjusting state during render).
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (existing && loadedId !== existing.request.id) {
    setLoadedId(existing.request.id)
    setNotes(existing.request.notes ?? '')
    if (existing.request.needed_date) setDate(existing.request.needed_date)
    setCart(
      existing.items.map((i) => ({
        productId: i.product_id,
        name: i.products?.name ?? 'Item',
        sku: i.products?.sku ?? null,
        imagePath: i.products?.image_path ?? null,
        unitId: i.unit_id,
        unitCode: i.units?.code ?? '',
        supplierId: i.supplier_id,
        price: i.unit_price,
        quantity: Number(i.quantity),
      })),
    )
  }

  const chefsConfigured = employees.some((e) => e.has_pin)
  // A logged-in chef only sees the categories they're allowed to order.
  const allowedCatalog = useMemo(
    () => (chef?.categoryIds ? catalog.filter((i) => i.category_id && chef.categoryIds!.includes(i.category_id)) : catalog),
    [catalog, chef],
  )

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const item of allowedCatalog) {
      const key = item.category_id ?? 'none'
      const entry = map.get(key) ?? { id: key, name: item.category_name ?? 'Other', count: 0 }
      entry.count++
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [allowedCatalog])

  const term = search.trim().toLowerCase()
  const visible = allowedCatalog.filter(
    (i) => (category === 'all' || (i.category_id ?? 'none') === category) && (!term || `${i.name} ${i.sku ?? ''}`.toLowerCase().includes(term)),
  )

  const pickFor = (item: RequestCatalogItem) => picks[item.product_id] ?? { supplierId: defaultSupplier(item), unitId: item.base_unit_id }
  const lineFor = (productId: string) => cart.find((c) => c.productId === productId)

  /** Puts the item in the order with the card's supplier/unit (or updates it); qty 0 removes it. */
  function upsertLine(item: RequestCatalogItem, changes: Partial<{ quantity: number; supplierId: string | null; unitId: string }>) {
    const current = lineFor(item.product_id)
    const pick = pickFor(item)
    const supplierId = changes.supplierId !== undefined ? changes.supplierId : (current?.supplierId ?? pick.supplierId)
    const unitId = changes.unitId ?? current?.unitId ?? pick.unitId
    const quantity = Math.max(0, Math.round((changes.quantity ?? current?.quantity ?? 0) * 1000) / 1000)
    setPicks((p) => ({ ...p, [item.product_id]: { supplierId, unitId } }))
    setCart((prev) => {
      if (quantity === 0) return prev.filter((c) => c.productId !== item.product_id)
      const line: CartLine = {
        productId: item.product_id,
        name: item.name,
        sku: item.sku,
        imagePath: item.image_path,
        unitId,
        unitCode: units.find((u) => u.id === unitId)?.code ?? item.unit_code,
        supplierId,
        price: priceFor(item, supplierId, unitId),
        quantity,
      }
      const index = prev.findIndex((c) => c.productId === item.product_id)
      if (index < 0) return [...prev, line]
      const copy = [...prev]
      copy[index] = line
      return copy
    })
  }

  // === Figures (one place; the server supplies everything already sent) ==========
  const subtotal = round2(cart.reduce((s, c) => s + round2(c.quantity * (c.price ?? 0)), 0))
  const vat = round2(subtotal * VAT)
  const total = round2(subtotal + vat)
  const unpriced = cart.filter((c) => c.price === null).length

  const selectedDate = parseISO(date)
  const dayTotal = round2((dashboard?.dayTotal ?? 0) + total)
  const monthTotal = round2((dashboard?.monthTotal ?? 0) + total)
  const monthlyBudget = dashboard?.monthlyBudget ?? null
  const budgetPct = monthlyBudget ? Math.round((monthTotal / monthlyBudget) * 100) : null
  const budgetBand = budgetPct !== null ? band(budgetPct) : null
  const bonus = budgetPct === null ? null : budgetPct <= 60 ? (dashboard?.bonusGood ?? 0) : budgetPct <= 80 ? (dashboard?.bonusSafe ?? 0) : 0
  const variancePct = dashboard?.priceVariancePct ?? null
  const dailyTarget = dashboard?.dailyTarget ?? null
  const canEditBudget = hasPermission('restaurants.manage') && !!effectiveRestaurantId
  const canManageAccess = hasPermission('employees.manage') && !!effectiveRestaurantId
  const readOnly = !!existing && !['draft', 'requested'].includes(existing.request.status)

  async function login() {
    if (!chefPick || !pin) return
    const session = await verifyPin.mutateAsync({ employeeId: chefPick, pin }).catch(() => null)
    if (!session) return
    setChef(session)
    setPin('')
    setCategory('all')
    // Drop anything this chef isn't allowed to order.
    if (session.categoryIds) {
      const allowed = new Set(catalog.filter((i) => i.category_id && session.categoryIds!.includes(i.category_id)).map((i) => i.product_id))
      const removed = cart.filter((c) => !allowed.has(c.productId)).length
      if (removed) {
        setCart((prev) => prev.filter((c) => allowed.has(c.productId)))
        toast.info(`${removed} item${removed === 1 ? '' : 's'} removed — outside ${session.fullName}'s categories`)
      }
    }
    toast.success(`Logged in as ${session.fullName}`)
  }

  function save(submit: boolean) {
    if (!effectiveRestaurantId || cart.length === 0) return
    if (submit && chefsConfigured && !chef) {
      toast.error('Log in with your employee PIN before submitting')
      return
    }
    saveRequest.mutate({
      submit,
      chef: chef ? { employeeId: chef.employeeId, pin: chef.pin } : null,
      values: {
        id: existing?.request.id,
        restaurant_id: effectiveRestaurantId,
        notes,
        needed_date: date,
        items: cart.map((c) => ({
          product_id: c.productId,
          unit_id: c.unitId,
          quantity: c.quantity,
          notes: '',
          unit_price: c.price,
          vat_rate: VAT,
          supplier_id: c.supplierId,
        })),
      },
    })
  }

  if (id && loadingExisting) return <FullScreenSpinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {existing ? `Purchase Request ${existing.request.request_number}` : 'New Purchase Request'}
            {existing?.request.status === 'draft' && <span className="ml-2 rounded-md bg-muted px-2 py-0.5 align-middle text-xs font-semibold">Draft</span>}
          </h1>
          <p className="text-muted-foreground">Add items, select supplier, quantities and submit for approval</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageAccess && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
              <KeyRound /> Employee access
            </Button>
          )}
          {canEditBudget && (
            <Button type="button" variant="outline" size="sm" onClick={() => setBudgetOpen(true)}>
              <Settings2 /> Budget & bonus
            </Button>
          )}
        </div>
      </div>

      {!effectiveRestaurantId ? (
        <div className="space-y-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Select a branch to start.</p>
          <Select value={restaurantId || undefined} onValueChange={setRestaurantId}>
            <SelectTrigger className="mx-auto h-10 w-64">
              <SelectValue placeholder="Select branch / restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          {/* Row 1 — budget, price variance, bonus */}
          <div className="grid gap-3 lg:grid-cols-3">
            <TopCard
              icon={Wallet}
              title="Monthly purchase budget used"
              value={budgetPct !== null ? `${budgetPct}%` : '—'}
              valueClass={budgetBand?.text}
              onEdit={canEditBudget ? () => setBudgetOpen(true) : undefined}
            >
              {budgetPct !== null ? (
                <>
                  <GradientBar pct={budgetPct} />
                  <Legend
                    items={[
                      { dot: 'bg-success', title: '0 – 60%', sub: 'Good', subClass: 'text-success' },
                      { dot: 'bg-lime-500', title: '60 – 80%', sub: 'Safe', subClass: 'text-lime-600 dark:text-lime-400' },
                      { dot: 'bg-warning', title: '80 – 100%', sub: 'Weak / Warning', subClass: 'text-warning-foreground' },
                      { dot: 'bg-destructive', title: '> 100%', sub: 'Danger', subClass: 'text-destructive' },
                    ]}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatCurrency(monthTotal)} of {formatCurrency(monthlyBudget!)} in {format(selectedDate, 'MMMM')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No monthly budget set{canEditBudget ? ' — use the pencil to set one.' : '.'}</p>
              )}
            </TopCard>

            <TopCard
              icon={TrendingUp}
              title="Average item price variance"
              value={variancePct === null ? '—' : `${variancePct > 0 ? '+' : ''}${variancePct}%`}
              valueClass={variancePct === null ? undefined : variancePct > 0 ? 'text-destructive' : 'text-success'}
            >
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                {variancePct !== null && (
                  <div className={cn('h-full rounded-full', variancePct > 0 ? 'bg-destructive/70' : 'bg-success/70')} style={{ width: `${Math.min(Math.abs(variancePct) * 5, 100)}%` }} />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {variancePct === null
                  ? 'Not enough invoices this month and last month to compare.'
                  : `% vs last month (${variancePct > 0 ? 'higher' : variancePct < 0 ? 'lower' : 'same as'} than previous month) — average over items bought in both months.`}
              </p>
            </TopCard>

            <TopCard icon={BadgePercent} title="Budget performance bonus" value={budgetPct !== null ? `${budgetPct}%` : '—'} valueClass={budgetBand?.text}>
              {budgetPct !== null ? (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="w-[50%] bg-success" />
                    <div className="w-[16.7%] bg-lime-500" />
                    <div className="w-[16.6%] bg-warning" />
                    <div className="w-[16.7%] bg-destructive" />
                  </div>
                  <Legend
                    items={[
                      { dot: 'bg-primary', title: '≤ 60%', sub: dashboard?.bonusGood != null ? `AED ${dashboard.bonusGood} bonus` : 'Bonus not set' },
                      { dot: 'bg-warning', title: '60 – 80%', sub: dashboard?.bonusSafe != null ? `AED ${dashboard.bonusSafe} bonus` : 'Bonus not set' },
                      { dot: 'bg-muted-foreground', title: '80 – 100%', sub: 'No bonus' },
                      { dot: 'bg-destructive', title: '> 100%', sub: 'No bonus' },
                    ]}
                  />
                  <p className={cn('mt-2 text-xs font-medium', bonus ? 'text-success' : 'text-muted-foreground')}>
                    {bonus ? `On track for an AED ${bonus} bonus this month` : 'No bonus at this level of spending'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Set a monthly budget to track the bonus.</p>
              )}
            </TopCard>
          </div>

          {/* Row 2 — branch, target, today's purchase, date */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard icon={Building2} label="Branch / Restaurant">
              {existing ? (
                <p className="font-semibold">{existing.request.restaurants?.name}</p>
              ) : (
                <Select
                  value={restaurantId || undefined}
                  onValueChange={(v) => {
                    setRestaurantId(v)
                    setCart([])
                    setChef(null)
                  }}
                >
                  <SelectTrigger className="mt-1 h-9 w-full">
                    <SelectValue placeholder="Select branch" />
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
            </InfoCard>
            <InfoCard
              icon={Target}
              label="Purchase target (daily)"
              action={
                canEditBudget ? (
                  <button type="button" onClick={() => setBudgetOpen(true)} className="text-muted-foreground hover:text-primary" aria-label="Edit target">
                    <Pencil className="size-4" />
                  </button>
                ) : undefined
              }
            >
              <p className="text-lg font-bold tabular-nums">{dailyTarget !== null ? formatCurrency(dailyTarget) : 'Not set'}</p>
            </InfoCard>
            <InfoCard icon={ShoppingCart} label={isToday(selectedDate) ? "Today's purchase" : `Purchase on ${format(selectedDate, 'd MMM')}`}>
              <p className={cn('text-lg font-bold tabular-nums', dailyTarget !== null && dayTotal > dailyTarget && 'text-destructive')}>{formatCurrency(dayTotal)}</p>
              {dailyTarget !== null && dayTotal > dailyTarget && <p className="text-[11px] text-destructive">{formatCurrency(dayTotal - dailyTarget)} above target</p>}
            </InfoCard>
            <InfoCard icon={CalendarDays} label="Date">
              <Input type="date" className="mt-1 h-9" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} disabled={readOnly} />
            </InfoCard>
          </div>

          {/* Row 3 — employee / chef login */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <UserRound className="size-7 text-primary" />
            {chef ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Logged in as {chef.jobTitle ? `${chef.jobTitle} ` : ''}
                  {chef.fullName}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setChef(null)}>
                  <LogOut /> Log out
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-48 flex-1 space-y-1 sm:flex-none">
                  <Label className="text-xs text-primary">Employee / Chef selection</Label>
                  <Select value={chefPick || undefined} onValueChange={setChefPick} disabled={employees.length === 0}>
                    <SelectTrigger className="h-9 w-full bg-background sm:w-56">
                      <SelectValue placeholder={employees.length ? 'Select employee' : 'No employees at this branch'} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.employee_id} value={e.employee_id} disabled={!e.has_pin}>
                          {e.full_name}
                          {!e.has_pin && ' (no PIN)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Lock className="hidden size-6 text-primary sm:block" />
                <div className="space-y-1">
                  <Label htmlFor="chef-pin" className="text-xs text-primary">
                    Employee PIN
                  </Label>
                  <div className="relative">
                    <Input
                      id="chef-pin"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      className="h-9 w-40 bg-background pr-9 tracking-widest"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && void login()}
                    />
                    <button type="button" className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPin((s) => !s)} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                      {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="button" className="self-end" onClick={() => void login()} disabled={!chefPick || pin.length < 4 || verifyPin.isPending}>
                  {verifyPin.isPending ? <Loader2 className="animate-spin" /> : <LogIn />} Login
                </Button>
              </>
            )}
            <p className="ml-auto flex max-w-xs items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {chefsConfigured ? 'Visible items depend on the logged-in employee permissions.' : 'No employee PINs set up for this branch yet — requests are submitted under your account.'}
            </p>
          </div>

          {/* Category tabs + search */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              <CategoryTab active={category === 'all'} onClick={() => setCategory('all')} icon={Package} label="All" count={allowedCatalog.length} />
              {categories.map((c) => (
                <CategoryTab key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} icon={categoryIcon(c.name)} label={c.name} count={c.count} />
              ))}
            </div>
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 rounded-full pl-9" placeholder="Search items or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_27rem]">
            {/* Item cards */}
            <section className="min-w-0">
              {loadingCatalog ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No items found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visible.map((item) => {
                    const line = lineFor(item.product_id)
                    const pick = line ? { supplierId: line.supplierId, unitId: line.unitId } : pickFor(item)
                    const price = priceFor(item, pick.supplierId, pick.unitId)
                    const unitCode = units.find((u) => u.id === pick.unitId)?.code ?? item.unit_code
                    const qty = line?.quantity ?? 0
                    const suppliers = uniqueSuppliers(item)
                    const change = item.price_change_pct
                    return (
                      <div key={item.product_id} className={cn('flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm', qty > 0 && 'ring-2 ring-primary')}>
                        <div className="relative">
                          <ItemThumb name={item.name} category={item.category_name} imagePath={item.image_path} className="h-28 w-full rounded-none border-0 text-2xl" />
                          <button
                            type="button"
                            onClick={() => togglePin.mutate({ productId: item.product_id, pinned: !item.pinned })}
                            className={cn('absolute top-2 right-2 rounded-full bg-background/90 p-1.5 shadow-sm', item.pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                            aria-label={item.pinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
                            title={item.pinned ? 'Pinned to the top — click to unpin' : 'Pin to the top'}
                          >
                            <Pin className={cn('size-4', item.pinned && 'fill-current')} />
                          </button>
                          {change !== null && Math.abs(change) >= 0.5 && (
                            <span
                              className={cn(
                                'absolute right-2 bottom-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-sm',
                                change > 0 ? 'bg-destructive/90 text-white' : 'bg-success/90 text-white',
                              )}
                            >
                              {change > 0 ? '+' : ''}
                              {Math.round(change)}% vs last month
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-2.5">
                          <div className="flex-1">
                            <p className="line-clamp-2 text-sm leading-tight font-semibold">{item.name}</p>
                            {item.sku && <p className="text-[11px] text-muted-foreground">{item.sku}</p>}
                            <p className="mt-0.5 text-sm font-bold tabular-nums">
                              {price !== null ? formatCurrency(price) : 'No price'} <span className="text-xs font-normal text-muted-foreground">/ {unitCode}</span>
                            </p>
                          </div>
                          <Select
                            value={pick.supplierId ?? undefined}
                            onValueChange={(v) => (qty > 0 ? upsertLine(item, { supplierId: v }) : setPicks((p) => ({ ...p, [item.product_id]: { ...pick, supplierId: v } })))}
                            disabled={readOnly || suppliers.length === 0}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue placeholder={suppliers.length ? 'Select supplier' : 'No supplier yet'} />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.supplier_id} value={s.supplier_id}>
                                  {s.supplier_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={pick.unitId}
                              onValueChange={(v) => (qty > 0 ? upsertLine(item, { unitId: v }) : setPicks((p) => ({ ...p, [item.product_id]: { ...pick, unitId: v } })))}
                              disabled={readOnly}
                            >
                              <SelectTrigger className="h-8 w-20 px-2 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {units.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex flex-1 items-center justify-between rounded-md border">
                              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => upsertLine(item, { quantity: qty - 1 })} disabled={readOnly || qty === 0} aria-label="Decrease">
                                <Minus />
                              </Button>
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={qty}
                                onChange={(e) => upsertLine(item, { quantity: Number(e.target.value) || 0 })}
                                disabled={readOnly}
                                className="h-8 w-12 border-0 px-0 text-center tabular-nums shadow-none focus-visible:ring-0"
                                aria-label={`${item.name} quantity`}
                              />
                              <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" onClick={() => upsertLine(item, { quantity: qty + 1 })} disabled={readOnly} aria-label="Increase">
                                <Plus />
                              </Button>
                            </div>
                          </div>
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
                <h2 className="border-b px-4 py-3 font-semibold">
                  Current purchase order <span className="text-sm font-normal text-muted-foreground">({cart.length} item{cart.length === 1 ? '' : 's'})</span>
                </h2>
                {cart.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">Use + on an item to add it to the order.</p>
                ) : (
                  <div className="max-h-[45vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/60 text-[11px] text-muted-foreground">
                        <tr>
                          <th className="w-6 py-2 pl-3 text-left font-medium">#</th>
                          <th className="py-2 text-left font-medium">Items</th>
                          <th className="py-2 text-left font-medium">Supplier</th>
                          <th className="py-2 text-center font-medium">Qty</th>
                          <th className="py-2 text-left font-medium">Unit</th>
                          <th className="py-2 pr-2 text-right font-medium">Amount</th>
                          <th className="w-8 pr-3">
                            {!readOnly && (
                              <button type="button" onClick={() => setCart([])} className="text-muted-foreground hover:text-destructive" aria-label="Clear all" title="Clear all">
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {cart.map((c, i) => {
                          const item = catalog.find((x) => x.product_id === c.productId)
                          const suppliers = item ? uniqueSuppliers(item) : []
                          return (
                            <tr key={c.productId} className="align-middle">
                              <td className="py-2 pl-3 text-muted-foreground">{i + 1}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <ItemThumb name={c.name} imagePath={c.imagePath} className="size-8" />
                                  <div className="min-w-0">
                                    <p className="max-w-24 truncate text-xs font-semibold">{c.name}</p>
                                    {c.sku && <p className="text-[10px] text-muted-foreground">{c.sku}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2">
                                {item && suppliers.length > 0 ? (
                                  <Select value={c.supplierId ?? undefined} onValueChange={(v) => upsertLine(item, { supplierId: v })} disabled={readOnly}>
                                    <SelectTrigger className="h-7 w-24 px-1.5 text-[11px]">
                                      <SelectValue placeholder="Supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {suppliers.map((s) => (
                                        <SelectItem key={s.supplier_id} value={s.supplier_id}>
                                          {s.supplier_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={c.quantity}
                                  onChange={(e) => item && upsertLine(item, { quantity: Number(e.target.value) || 0 })}
                                  disabled={readOnly || !item}
                                  className="mx-auto h-7 w-14 px-1 text-center text-xs tabular-nums"
                                  aria-label={`${c.name} quantity`}
                                />
                              </td>
                              <td className="py-2 text-xs">{c.unitCode}</td>
                              <td className="py-2 pr-2 text-right text-xs font-semibold whitespace-nowrap tabular-nums">
                                {c.price !== null ? formatCurrency(round2(c.quantity * c.price)) : 'TBC'}
                              </td>
                              <td className="py-2 pr-3">
                                {!readOnly && (
                                  <button type="button" onClick={() => setCart((prev) => prev.filter((x) => x.productId !== c.productId))} className="text-destructive/80 hover:text-destructive" aria-label={`Remove ${c.name}`}>
                                    <Trash2 className="size-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="space-y-1 border-t px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (5%)</span>
                    <span className="tabular-nums">{formatCurrency(vat)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between rounded-lg bg-primary/5 px-3 py-2">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  {unpriced > 0 && <p className="text-xs text-warning-foreground">{unpriced} item{unpriced === 1 ? ' has' : 's have'} no price yet — not included in the total.</p>}
                </div>
                <div className="space-y-3 border-t px-4 py-3">
                  <p className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {chef
                      ? `Submitted under ${chef.fullName}'s login. Item visibility depends on role permissions.`
                      : chefsConfigured
                        ? 'Log in with an employee PIN to submit. Item visibility depends on role permissions.'
                        : 'Submitted under your account.'}
                  </p>
                  <div className="relative">
                    <Textarea
                      placeholder="Notes for head office (optional)…"
                      className="min-h-16 pb-5"
                      maxLength={NOTES_MAX}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                      disabled={readOnly}
                    />
                    <span className="absolute right-2.5 bottom-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {notes.length}/{NOTES_MAX}
                    </span>
                  </div>
                  {readOnly ? (
                    <p className="text-center text-sm text-muted-foreground">This request has been reviewed and can no longer be changed.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {existing?.request.status !== 'requested' ? (
                        <Button type="button" variant="outline" size="lg" onClick={() => save(false)} disabled={cart.length === 0 || saveRequest.isPending}>
                          {saveRequest.isPending && !saveRequest.variables?.submit ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Save as Draft
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button type="button" size="lg" onClick={() => save(true)} disabled={cart.length === 0 || saveRequest.isPending}>
                        {saveRequest.isPending && saveRequest.variables?.submit ? <Loader2 className="animate-spin" /> : <Send />}
                        {existing?.request.status === 'requested' ? 'Update request' : 'Submit Purchase Request'}
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

      {effectiveRestaurantId && <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} restaurantId={effectiveRestaurantId} dashboard={dashboard} />}
      {effectiveRestaurantId && (
        <EmployeeAccessDialog
          open={accessOpen}
          onOpenChange={setAccessOpen}
          employees={employees}
          categories={[...new Map(catalog.filter((i) => i.category_id).map((i) => [i.category_id!, i.category_name ?? 'Other'])).entries()]}
        />
      )}
    </div>
  )
}

function CategoryTab({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      <Icon className="size-4" />
      {label}
      <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>{count}</span>
    </button>
  )
}

function BudgetDialog({
  open,
  onOpenChange,
  restaurantId,
  dashboard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  dashboard: RequestDashboard | undefined
}) {
  const setBudget = useSetPurchaseBudget()
  const [draft, setDraft] = useState({ daily: '', monthly: '', good: '', safe: '' })
  const [loaded, setLoaded] = useState(false)
  // Fill the fields each time the dialog opens (state adjusted during render).
  if (open && !loaded) {
    setLoaded(true)
    setDraft({
      daily: dashboard?.dailyTarget?.toString() ?? '',
      monthly: dashboard?.monthlyBudget?.toString() ?? '',
      good: dashboard?.bonusGood?.toString() ?? '',
      safe: dashboard?.bonusSafe?.toString() ?? '',
    })
  }
  if (!open && loaded) setLoaded(false)
  const num = (v: string) => (v === '' ? null : Number(v))
  const field = (key: keyof typeof draft, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`budget-${key}`}>{label}</Label>
      <Input id={`budget-${key}`} type="number" min="0" step="0.01" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </div>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase budget & bonus</DialogTitle>
          <DialogDescription>For this branch. The bonus depends on how much of the monthly budget is used.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field('daily', 'Daily purchase target (AED)')}
          {field('monthly', 'Monthly purchase budget (AED)')}
          {field('good', 'Bonus at ≤ 60% used (AED)')}
          {field('safe', 'Bonus at 60 – 80% used (AED)')}
        </div>
        <p className="text-xs text-muted-foreground">No bonus above 80% of the budget.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={setBudget.isPending}
            onClick={async () => {
              await setBudget.mutateAsync({ restaurantId, dailyTarget: num(draft.daily), monthlyBudget: num(draft.monthly), bonusGood: num(draft.good), bonusSafe: num(draft.safe) })
              onOpenChange(false)
            }}
          >
            {setBudget.isPending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmployeeAccessDialog({
  open,
  onOpenChange,
  employees,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: { employee_id: string; full_name: string; has_pin: boolean }[]
  categories: [string, string][]
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [pin, setPin] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const { data: access, isFetching } = useEmployeeRequestAccess(employeeId || null)
  const save = useSetEmployeeRequestAccess()
  if (access && employeeId && loadedFor !== employeeId && !isFetching) {
    setLoadedFor(employeeId)
    setSelected(access.category_ids ?? [])
  }
  const pinValid = pin === '' || /^\d{4,6}$/.test(pin)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employee access</DialogTitle>
          <DialogDescription>Set an employee's PIN for the ordering tablet and which categories they may order.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select
              value={employeeId || undefined}
              onValueChange={(v) => {
                setEmployeeId(v)
                setPin('')
                setLoadedFor(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.employee_id} value={e.employee_id}>
                    {e.full_name} {e.has_pin ? '· PIN set' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {employeeId && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="access-pin">{access?.has_pin ? 'New PIN (leave blank to keep)' : 'PIN (4 – 6 digits)'}</Label>
                <Input id="access-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-invalid={!pinValid} />
              </div>
              <div className="space-y-1.5">
                <Label>Categories they may order</Label>
                <p className="text-xs text-muted-foreground">None ticked = all categories.</p>
                <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-2">
                  {categories.map(([cid, name]) => (
                    <label key={cid} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selected.includes(cid)} onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, cid] : s.filter((x) => x !== cid)))} />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!employeeId || !pinValid || (!access?.has_pin && pin === '') || save.isPending}
            onClick={async () => {
              await save.mutateAsync({ employeeId, pin: pin || null, categoryIds: selected.length ? selected : null })
              setPin('')
            }}
          >
            {save.isPending && <Loader2 className="animate-spin" />} Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
