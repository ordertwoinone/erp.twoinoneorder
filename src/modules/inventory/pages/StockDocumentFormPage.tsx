import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FilePlus2, Loader2, PackageCheck, Plus, Save, Trash2, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useSuppliersOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { InventoryRibbon } from '../components/InventoryRibbon'
import { StockItemSearch } from '../components/StockItemSearch'
import {
  useCreateTransferFromRequest,
  useDeleteStockDocument,
  usePostStockDocument,
  useReceiveTransfer,
  useRejectStockRequest,
  useSaveStockDocument,
  useStockDocumentQuery,
  type StockDocument,
  type StockItem,
} from '../hooks/useStockDocuments'
import {
  documentTotals,
  isEditableStatus,
  lineValues,
  stockDocConfig,
  type DocHeader,
  type DocLine,
  type StockDocKind,
} from '../stockDocs'

const today = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown, fallback = 0) => (v === null || v === undefined || v === '' ? fallback : Number(v))
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
let keySeq = 0
const nextKey = () => `l${++keySeq}`

const PAY_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
]

export default function StockDocumentFormPage({ kind }: { kind: StockDocKind }) {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { data: doc, isLoading } = useStockDocumentQuery(kind, id)
  if (id && isLoading) return <FullScreenSpinner />
  // location.key changes on every navigation, so "Save & New" gets a clean form.
  return <StockDocumentEditor key={`${id ?? 'new'}-${id ? '' : location.key}`} kind={kind} doc={id ? (doc ?? null) : null} />
}

function headerFromDoc(kind: StockDocKind, doc: StockDocument | null, defaultRestaurant: string): DocHeader {
  const h = (doc?.header ?? {}) as Record<string, unknown>
  return {
    id: doc?.header.id,
    doc_number: doc?.header.doc_number,
    status: doc?.header.status,
    restaurant_id: str(h.restaurant_id) || (kind === 'request' || kind === 'transfer' ? '' : defaultRestaurant),
    from_restaurant_id: str(h.from_restaurant_id) || (kind === 'transfer' ? defaultRestaurant : ''),
    to_restaurant_id: str(h.to_restaurant_id) || (kind === 'request' ? defaultRestaurant : ''),
    supplier_id: str(h.supplier_id),
    invoice_number: str(h.invoice_number),
    doc_date: str(h.doc_date) || today(),
    received_date: str(h.received_date) || (doc ? '' : today()),
    payment_mode: str(h.payment_mode) || 'cash',
    tax_disabled: h.tax_disabled === true,
    discount_percent: num(h.discount_percent),
    discount_amount: num(h.discount_amount),
    notes: str(h.notes),
    item_kind: h.item_kind === 'food_product' ? 'food_product' : 'material',
  }
}

function linesFromDoc(doc: StockDocument | null): DocLine[] {
  return (doc?.items ?? []).map((i) => ({
    key: nextKey(),
    product_id: str(i.product_id),
    unit_id: str(i.unit_id),
    product_name: str(i.product_name),
    sku: (i.sku as string | null) ?? null,
    barcode: (i.barcode as string | null) ?? null,
    unit_code: str(i.unit_code),
    pack_size: (i.pack_size as number | null) ?? null,
    current_stock: num(i.current_stock),
    quantity: num(i.quantity),
    foc_quantity: num(i.foc_quantity),
    unit_cost: num(i.unit_cost),
    current_cost: num(i.current_cost, num(i.unit_cost)),
    tax_percent: num(i.tax_percent, 5),
    discount_amount: num(i.discount_amount),
    new_stock: num(i.new_stock),
    remarks: str(i.remarks),
  }))
}

function StockDocumentEditor({ kind, doc }: { kind: StockDocKind; doc: StockDocument | null }) {
  const config = stockDocConfig[kind]
  const navigate = useNavigate()
  const { hasPermission, hasRestaurantAccess } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data: suppliers = [] } = useSuppliersOptions()

  const [header, setHeader] = useState<DocHeader>(() => headerFromDoc(kind, doc, selectedRestaurantId ?? ''))
  const [lines, setLines] = useState<DocLine[]>(() => linesFromDoc(doc))
  // The restaurant scope can resolve after the first render; default the
  // location once it does (new documents only, adjusted during render).
  const [scopeApplied, setScopeApplied] = useState(!!selectedRestaurantId || !!doc)
  if (!scopeApplied && selectedRestaurantId) {
    setScopeApplied(true)
    setHeader(headerFromDoc(kind, null, selectedRestaurantId))
  }
  const [pending, setPending] = useState<StockItem | null>(null)
  const [pendingQty, setPendingQty] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const save = useSaveStockDocument(kind)
  const post = usePostStockDocument(kind)
  const remove = useDeleteStockDocument(kind)
  const receive = useReceiveTransfer()
  const toTransfer = useCreateTransferFromRequest()
  const reject = useRejectStockRequest()

  const status = header.status
  const editable = isEditableStatus(status) && hasPermission(config.permission)
  const canPost = kind === 'purchase_return' ? hasPermission('purchases.post') : hasPermission('inventory.manage')
  const raw = (doc?.header ?? {}) as Record<string, unknown>
  const busy = save.isPending || post.isPending

  // Whose stock the item search shows.
  const stockRestaurant =
    kind === 'transfer' ? header.from_restaurant_id : kind === 'request' ? header.to_restaurant_id : header.restaurant_id
  const totals = documentTotals(kind, header, lines)
  const supplier = suppliers.find((s) => s.id === header.supplier_id)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setH = <K extends keyof DocHeader>(key: K, value: DocHeader[K]) => setHeader((h) => ({ ...h, [key]: value }))
  const setLine = (key: string, patch: Partial<DocLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  function choose(item: StockItem) {
    setPending(item)
    setPendingQty(kind === 'adjustment' ? String(Number(item.current_stock)) : '1')
    requestAnimationFrame(() => qtyRef.current?.select())
  }

  function addPending() {
    if (!pending) return
    const qty = Number(pendingQty)
    if (!Number.isFinite(qty) || (kind !== 'adjustment' && qty <= 0) || (kind === 'adjustment' && qty < 0)) return
    const cost = kind === 'purchase_return' ? Number(pending.last_cost || pending.average_cost) : Number(pending.average_cost || pending.last_cost)
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === pending.product_id)
      if (existing && kind !== 'adjustment') {
        return ls.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + qty } : l))
      }
      if (existing) return ls.map((l) => (l.key === existing.key ? { ...l, new_stock: qty } : l))
      return [
        ...ls,
        {
          key: nextKey(),
          product_id: pending.product_id,
          unit_id: pending.base_unit_id,
          product_name: pending.name,
          sku: pending.sku,
          barcode: pending.barcode,
          unit_code: pending.base_unit_code,
          pack_size: pending.pack_size,
          current_stock: Number(pending.current_stock),
          quantity: kind === 'adjustment' ? 0 : qty,
          foc_quantity: 0,
          unit_cost: cost,
          current_cost: Number(pending.average_cost),
          tax_percent: 5,
          discount_amount: 0,
          new_stock: kind === 'adjustment' ? qty : 0,
          remarks: '',
        },
      ]
    })
    setPending(null)
    setPendingQty('')
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  async function submit(mode: 'new' | 'close' | 'post' | 'stay') {
    try {
      const id = await save.mutateAsync({ header, lines, post: mode === 'post' })
      if (mode === 'new') navigate(`${config.path}/new`)
      else if (mode === 'close') navigate(config.path)
      else navigate(`${config.path}/${id}`, { replace: !!header.id })
    } catch (error) {
      const savedId = (error as { savedId?: string }).savedId
      if (savedId && !header.id) navigate(`${config.path}/${savedId}`, { replace: true })
    }
  }

  const locationSelect = (value: string, onChange: (v: string) => void, placeholder: string, exclude?: string) => (
    <Select value={value} onValueChange={onChange} disabled={!editable}>
      <SelectTrigger className="h-9 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {restaurants
          .filter((r) => r.id !== exclude)
          .map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <InventoryRibbon />

      <div className="overflow-hidden rounded-xl border bg-card">
        {/* Title + toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(config.path)} aria-label="Back to list">
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="mr-auto text-base font-semibold">
            {header.id ? config.singular : `New ${config.singular}`}
          </h1>
          {editable ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => submit('new')}>
                <FilePlus2 /> Save &amp; New
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => submit('close')}>
                <Save /> Save &amp; Close
              </Button>
              {canPost && (
                <Button size="sm" disabled={busy || lines.length === 0} onClick={() => submit('post')}>
                  {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Post
                </Button>
              )}
              {header.id && (
                <ConfirmActionDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 /> Delete
                    </Button>
                  }
                  title={`Delete ${header.doc_number}?`}
                  description="This unposted document will be removed. Stock is not affected."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    await remove.mutateAsync(header.id!)
                    navigate(config.path)
                  }}
                />
              )}
            </>
          ) : (
            <>
              {kind === 'transfer' && status === 'dispatched' && hasRestaurantAccess(header.to_restaurant_id) && (
                <ConfirmActionDialog
                  trigger={
                    <Button size="sm">
                      <PackageCheck /> Receive
                    </Button>
                  }
                  title="Receive this transfer?"
                  description={`All items will be added to ${str(raw.to_name)}'s stock at the transferred cost.`}
                  confirmLabel="Receive"
                  onConfirm={() => receive.mutateAsync(header.id!)}
                />
              )}
              {kind === 'request' && status === 'posted' && !raw.branch_transfer_id && hasRestaurantAccess(header.from_restaurant_id) && (
                <>
                  <Button
                    size="sm"
                    disabled={toTransfer.isPending}
                    onClick={async () => {
                      const transferId = await toTransfer.mutateAsync(header.id!)
                      navigate(`${stockDocConfig.transfer.path}/${transferId}`)
                    }}
                  >
                    {toTransfer.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />} Create Transfer
                  </Button>
                  <ConfirmActionDialog
                    trigger={
                      <Button size="sm" variant="outline" className="text-destructive">
                        <XCircle /> Reject
                      </Button>
                    }
                    title="Reject this request?"
                    description="The requesting location will see it as rejected."
                    confirmLabel="Reject"
                    destructive
                    onConfirm={() => reject.mutateAsync(header.id!)}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Header details */}
        <div className="space-y-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{config.singular} Details</span>
            <span className="text-muted-foreground">
              Ref# : <span className="font-medium text-foreground">{header.doc_number ?? 'New'}</span>
            </span>
            {status && <StatusBadge status={status} />}
            {!status && (kind === 'request' || kind === 'transfer') && <StatusBadge status="open" />}
            {kind === 'request' && !!raw.branch_transfer_id && (
              <Link className="text-xs font-medium text-primary hover:underline" to={`${stockDocConfig.transfer.path}/${str(raw.branch_transfer_id)}`}>
                Transfer {str(raw.transfer_number)}
              </Link>
            )}
            {kind === 'transfer' && !!raw.stock_request_id && (
              <Link className="text-xs font-medium text-primary hover:underline" to={`${stockDocConfig.request.path}/${str(raw.stock_request_id)}`}>
                From request {str(raw.request_number)}
              </Link>
            )}
          </div>

          {kind === 'purchase_return' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Vendor">
                <Select value={header.supplier_id} onValueChange={(v) => setH('supplier_id', v)} disabled={!editable}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="[Select a vendor]" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice No.">
                <Input className="h-9" value={header.invoice_number} disabled={!editable} onChange={(e) => setH('invoice_number', e.target.value)} />
              </Field>
              <Field label="Invoice Date">
                <Input className="h-9" type="date" value={header.doc_date} disabled={!editable} onChange={(e) => setH('doc_date', e.target.value)} />
              </Field>
              <Field label="Received Date">
                <Input className="h-9" type="date" value={header.received_date} disabled={!editable} onChange={(e) => setH('received_date', e.target.value)} />
              </Field>
              <Field label="Location">{locationSelect(header.restaurant_id, (v) => setH('restaurant_id', v), '[Select a Location]')}</Field>
              <Field label="Paymode">
                <Select value={header.payment_mode} onValueChange={(v) => setH('payment_mode', v)} disabled={!editable}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="TRN">
                <p className="flex h-9 items-center text-sm">{supplier?.trn || 'N/A'}</p>
              </Field>
              <Field label=" ">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <Checkbox checked={header.tax_disabled} disabled={!editable} onCheckedChange={(v) => setH('tax_disabled', v === true)} /> Disable Tax
                </label>
              </Field>
            </div>
          )}

          {(kind === 'wastage' || kind === 'adjustment') && (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date">
                  <Input className="h-9" type="date" value={header.doc_date} disabled={!editable} onChange={(e) => setH('doc_date', e.target.value)} />
                </Field>
                <Field label="Location">{locationSelect(header.restaurant_id, (v) => setH('restaurant_id', v), '[Select a Location]')}</Field>
                {kind === 'wastage' && (
                  <div className="flex items-center gap-5 text-sm sm:col-span-2">
                    {(['material', 'food_product'] as const).map((k) => (
                      <label key={k} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="item_kind"
                          className="accent-primary"
                          checked={header.item_kind === k}
                          disabled={!editable}
                          onChange={() => setH('item_kind', k)}
                        />
                        {k === 'material' ? 'Material' : 'Food Product'}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Field label="Notes">
                <Textarea className="min-h-20" value={header.notes} disabled={!editable} onChange={(e) => setH('notes', e.target.value)} />
              </Field>
            </div>
          )}

          {(kind === 'request' || kind === 'transfer') && (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_minmax(0,1fr)]">
              <Field label="From">
                {locationSelect(header.from_restaurant_id, (v) => setH('from_restaurant_id', v), '[Select a Location]', header.to_restaurant_id)}
              </Field>
              <Field label="To">
                {locationSelect(header.to_restaurant_id, (v) => setH('to_restaurant_id', v), '[Select a Location]', header.from_restaurant_id)}
              </Field>
              <Field label={kind === 'request' ? 'Transfer Date' : 'Transferring Date'}>
                <Input className="h-9" type="date" value={header.doc_date} disabled={!editable} onChange={(e) => setH('doc_date', e.target.value)} />
              </Field>
              <div className="flex flex-col justify-end text-sm">
                <span className="text-muted-foreground">{kind === 'request' ? 'Total Requested Cost' : 'Total Transferring Cost'}</span>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="lg:col-span-4">
                <Field label="Notes">
                  <Textarea className="min-h-14" value={header.notes} disabled={!editable} onChange={(e) => setH('notes', e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Product entry bar */}
        {editable && (
          <div className="border-b bg-muted/20 px-4 py-3">
            <p className="mb-2 text-sm font-semibold">Product Details</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Item Name</Label>
                {pending ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-sm">
                    <span className="truncate font-medium">{pending.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{[pending.sku, pending.barcode].filter(Boolean).join(' · ')}</span>
                    <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPending(null)} aria-label="Clear item">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <StockItemSearch
                    ref={searchRef}
                    restaurantId={stockRestaurant || null}
                    supplierId={kind === 'purchase_return' ? header.supplier_id || null : null}
                    disabledText={kind === 'transfer' ? 'Select the From location first…' : kind === 'request' ? 'Select the To location first…' : 'Select a location first…'}
                    onSelect={choose}
                  />
                )}
              </div>
              <MiniStat label="Unit" value={pending?.base_unit_code ?? '—'} />
              <MiniStat label="Curr. Stock" value={pending ? Number(pending.current_stock).toFixed(2) : '—'} />
              <MiniStat label="Curr. Cost" value={pending ? Number(pending.average_cost || pending.last_cost).toFixed(2) : '—'} />
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {kind === 'adjustment' ? 'New Stock' : kind === 'request' ? 'Req. Qty' : kind === 'transfer' ? 'Trnsf. Qty' : 'Qty'}
                </Label>
                <Input
                  ref={qtyRef}
                  className="h-9"
                  type="number"
                  step="0.001"
                  value={pendingQty}
                  disabled={!pending}
                  onChange={(e) => setPendingQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addPending()
                    }
                  }}
                />
              </div>
              <Button type="button" className="h-9" disabled={!pending} onClick={addPending}>
                <Plus /> Add
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Ctrl + L to focus the item search · Enter to add</p>
          </div>
        )}

        {/* Lines grid */}
        <div className="overflow-x-auto">
          <LinesTable kind={kind} lines={lines} editable={editable} taxDisabled={header.tax_disabled} setLine={setLine} removeLine={(key) => setLines((ls) => ls.filter((l) => l.key !== key))} />
        </div>

        {/* Footer totals */}
        <div className="flex flex-wrap items-start justify-end gap-4 border-t bg-muted/20 px-4 py-3">
          {kind === 'purchase_return' && (
            <div className="w-72 space-y-2 rounded-lg border bg-card p-3">
              <p className="text-sm font-semibold">Apply Bill Discount</p>
              <div className="grid grid-cols-[1fr_7rem] items-center gap-2 text-sm">
                <span>Discount (%)</span>
                <Input
                  className="h-8"
                  type="number"
                  step="0.01"
                  value={header.discount_percent || ''}
                  disabled={!editable}
                  onChange={(e) => setHeader((h) => ({ ...h, discount_percent: Number(e.target.value) || 0, discount_amount: 0 }))}
                />
                <span>Discount Amount</span>
                <Input
                  className="h-8"
                  type="number"
                  step="0.01"
                  value={header.discount_percent > 0 ? totals.discount : header.discount_amount || ''}
                  disabled={!editable || header.discount_percent > 0}
                  onChange={(e) => setH('discount_amount', Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
          <dl className="grid w-64 grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {kind === 'purchase_return' ? (
              <>
                <dt>Total</dt>
                <dd className="text-right tabular-nums">{totals.subtotal.toFixed(2)}</dd>
                <dt>Discount</dt>
                <dd className="text-right tabular-nums">{totals.discount.toFixed(2)}</dd>
                <dt>Sub Total</dt>
                <dd className="text-right tabular-nums">{(totals.subtotal - totals.discount).toFixed(2)}</dd>
                <dt>Tax</dt>
                <dd className="text-right tabular-nums">{totals.tax.toFixed(2)}</dd>
                <dt className="border-t pt-1 font-semibold">Net Total</dt>
                <dd className="border-t pt-1 text-right font-semibold tabular-nums">{totals.net.toFixed(2)}</dd>
              </>
            ) : (
              <>
                {kind !== 'adjustment' && (
                  <>
                    <dt>Total Qty</dt>
                    <dd className="text-right tabular-nums">{totals.quantity.toFixed(3)}</dd>
                  </>
                )}
                <dt className="font-semibold">{config.totalLabel}</dt>
                <dd className="text-right font-semibold tabular-nums">{formatCurrency(totals.subtotal)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-24 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="flex h-9 items-center rounded-md border bg-muted/40 px-2 text-sm tabular-nums">{value}</p>
    </div>
  )
}

function NumCell({ value, onChange, editable, step = '0.001', className }: { value: number; onChange: (v: number) => void; editable: boolean; step?: string; className?: string }) {
  if (!editable) return <span className={cn('block text-right tabular-nums', className)}>{Number(value).toFixed(step === '0.01' ? 2 : 3)}</span>
  return (
    <Input
      type="number"
      step={step}
      className={cn('h-8 w-24 text-right tabular-nums', className)}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  )
}

function LinesTable({
  kind,
  lines,
  editable,
  taxDisabled,
  setLine,
  removeLine,
}: {
  kind: StockDocKind
  lines: DocLine[]
  editable: boolean
  taxDisabled: boolean
  setLine: (key: string, patch: Partial<DocLine>) => void
  removeLine: (key: string) => void
}) {
  const head = (labels: string[]) =>
    labels.map((l, i) => (
      <th key={i} className={cn('px-2 py-2 text-left text-xs font-semibold whitespace-nowrap', i > 4 && 'text-right')}>
        {l}
      </th>
    ))

  const columns: Record<StockDocKind, string[]> = {
    purchase_return: ['Code', 'Barcode', 'Material Description', 'Unit', 'UOM', 'Qty', 'FOC', 'Tax %', 'Sup Cost', 'Amount', 'Tax', 'Current Cost', 'Amount Incl Tax'],
    wastage: ['Code', 'Barcode', 'Product', 'Unit', 'UOM', 'Stock', 'Qty', 'Cost', 'Amount', 'Remarks'],
    adjustment: ['Code', 'Barcode', 'Material Description', 'Unit', 'UOM', 'Cost', 'Current Stock', 'Adjustment', 'New Stock', 'Adj Value', 'Notes'],
    request: ['Code', 'Barcode', 'Product', 'Unit', 'UOM', 'Cost', 'Stock', 'Requested Qty', 'Total', 'Remarks'],
    transfer: ['Code', 'Barcode', 'Product', 'Unit', 'UOM', 'Cost', 'Stock', 'Transferring Qty', 'Total', 'Remarks'],
  }

  return (
    <table className="w-full min-w-[900px] border-collapse text-sm">
      <thead className="bg-muted/40">
        <tr className="border-b">
          <th className="w-8 px-2 py-2 text-left text-xs font-semibold">#</th>
          {head(columns[kind])}
          {editable && <th className="w-10" />}
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 ? (
          <tr>
            <td colSpan={columns[kind].length + 2} className="h-28 text-center text-muted-foreground">
              {editable ? 'Search an item above and press Enter to add it.' : 'No items.'}
            </td>
          </tr>
        ) : (
          lines.map((l, idx) => {
            const v = lineValues(kind, l, taxDisabled)
            const lowStock = (kind === 'wastage' || kind === 'transfer' || kind === 'purchase_return') && l.quantity + l.foc_quantity > l.current_stock
            const common = (
              <>
                <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.sku ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{l.barcode ?? '—'}</td>
                <td className="max-w-72 px-2 py-1.5">
                  <span className="line-clamp-2 font-medium">{l.product_name}</span>
                </td>
                <td className="px-2 py-1.5">{l.unit_code}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Number(l.pack_size ?? 1).toFixed(4)}</td>
              </>
            )
            const remarks = (
              <td className="px-2 py-1.5">
                {editable ? (
                  <Input className="h-8 min-w-32" value={l.remarks} onChange={(e) => setLine(l.key, { remarks: e.target.value })} />
                ) : (
                  <span className="text-muted-foreground">{l.remarks}</span>
                )}
              </td>
            )
            const stockCell = (
              <td className={cn('px-2 py-1.5 text-right tabular-nums', lowStock && 'font-semibold text-destructive')} title={lowStock ? 'More than the stock on hand' : undefined}>
                {l.current_stock.toFixed(3)}
              </td>
            )
            return (
              <tr key={l.key} className="border-b hover:bg-muted/20">
                {common}
                {kind === 'purchase_return' && (
                  <>
                    <td className="px-2 py-1.5"><NumCell value={l.quantity} editable={editable} onChange={(n) => setLine(l.key, { quantity: n })} className={lowStock ? 'text-destructive' : undefined} /></td>
                    <td className="px-2 py-1.5"><NumCell value={l.foc_quantity} editable={editable} onChange={(n) => setLine(l.key, { foc_quantity: n })} /></td>
                    <td className="px-2 py-1.5"><NumCell value={taxDisabled ? 0 : l.tax_percent} editable={editable && !taxDisabled} step="0.01" onChange={(n) => setLine(l.key, { tax_percent: n })} className="w-16" /></td>
                    <td className="px-2 py-1.5"><NumCell value={l.unit_cost} editable={editable} step="0.01" onChange={(n) => setLine(l.key, { unit_cost: n })} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{v.amount.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{v.tax.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{l.current_cost.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">{v.total.toFixed(2)}</td>
                  </>
                )}
                {kind === 'wastage' && (
                  <>
                    {stockCell}
                    <td className="px-2 py-1.5"><NumCell value={l.quantity} editable={editable} onChange={(n) => setLine(l.key, { quantity: n })} /></td>
                    <td className="px-2 py-1.5"><NumCell value={l.unit_cost} editable={editable} step="0.01" onChange={(n) => setLine(l.key, { unit_cost: n })} /></td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">{v.amount.toFixed(2)}</td>
                    {remarks}
                  </>
                )}
                {kind === 'adjustment' && (
                  <>
                    <td className="px-2 py-1.5"><NumCell value={l.unit_cost} editable={editable} step="0.01" onChange={(n) => setLine(l.key, { unit_cost: n })} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.current_stock.toFixed(3)}</td>
                    <td className="px-2 py-1.5">
                      <NumCell
                        value={Math.round((l.new_stock - l.current_stock) * 1000) / 1000}
                        editable={editable}
                        onChange={(n) => setLine(l.key, { new_stock: l.current_stock + n })}
                        className={l.new_stock - l.current_stock < 0 ? 'text-destructive' : 'text-emerald-600'}
                      />
                    </td>
                    <td className="px-2 py-1.5"><NumCell value={l.new_stock} editable={editable} onChange={(n) => setLine(l.key, { new_stock: n })} /></td>
                    <td className={cn('px-2 py-1.5 text-right font-medium tabular-nums', v.amount < 0 && 'text-destructive')}>{v.amount.toFixed(2)}</td>
                    {remarks}
                  </>
                )}
                {(kind === 'request' || kind === 'transfer') && (
                  <>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.unit_cost.toFixed(2)}</td>
                    {stockCell}
                    <td className="px-2 py-1.5"><NumCell value={l.quantity} editable={editable} onChange={(n) => setLine(l.key, { quantity: n })} /></td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">{v.amount.toFixed(2)}</td>
                    {remarks}
                  </>
                )}
                {editable && (
                  <td className="px-1 py-1.5">
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeLine(l.key)} aria-label={`Remove ${l.product_name}`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )
}
