import { useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, ScanLine, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { cn } from '@/lib/utils'
import { useQuickCreateProduct } from '@/modules/suppliers/hooks/usePriceLocks'
import { useScanInvoice, type ExtractedInvoiceItem } from '../hooks/useInvoiceScan'
import { matchProduct, matchUnit, type MatchKind } from '../scanMatching'

const money = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (n: number) => Math.round(n * 100) / 100

interface ReviewRow extends ExtractedInvoiceItem {
  productId: string
  unitId: string
  packSize: string
  include: boolean
  match: MatchKind | null
  lineDiscount: number
  vatPercent: number
}

export interface ScannedInvoiceResult {
  scanResultId: string
  invoiceNumber: string
  invoiceDate: string
  lpoNumber: string | null
  supplierName: string | null
  supplierTrn: string | null
  items: {
    productId: string
    unitId: string
    packSize: string
    quantity: number
    unitPrice: number
    /** Discount for the whole line, as printed. */
    discount: number
    /** 0 or 0.05 */
    vatRate: number
  }[]
}

interface InvoiceScanDialogProps {
  restaurantId: string | null
  supplierId: string | null
  onConfirm: (result: ScannedInvoiceResult) => void
}

/** What a line comes to with the values on screen (same maths as the purchase page). */
function lineAmounts(r: Pick<ReviewRow, 'quantity' | 'unit_price' | 'lineDiscount' | 'vatPercent'>) {
  const before = round2(Math.max(round2((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)) - (Number(r.lineDiscount) || 0), 0))
  const vat = round2((before * (r.vatPercent === 5 ? 5 : 0)) / 100)
  return { before, vat, total: round2(before + vat) }
}

const MATCH_LABEL: Record<MatchKind, string> = { code: 'Matched by item code', name: 'Matched by name', similar: 'Similar name — check' }

export function InvoiceScanDialog({ restaurantId, supplierId, onConfirm }: InvoiceScanDialogProps) {
  const [open, setOpen] = useState(false)
  const [scanResultId, setScanResultId] = useState<string | null>(null)
  const [supplierNameGuess, setSupplierNameGuess] = useState<string | null>(null)
  const [supplierTrn, setSupplierTrn] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [lpoNumber, setLpoNumber] = useState<string | null>(null)
  const [printedTotal, setPrintedTotal] = useState<number | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: units = [] } = useUnitsOptions()
  const { data: products = [] } = useProductsOptions()
  const scanInvoice = useScanInvoice()

  function reset() {
    setScanResultId(null)
    setSupplierNameGuess(null)
    setSupplierTrn(null)
    setInvoiceNumber('')
    setInvoiceDate('')
    setLpoNumber(null)
    setPrintedTotal(null)
    setRows([])
  }

  async function handleFileSelected(file: File) {
    if (!restaurantId) return
    const result = await scanInvoice.mutateAsync({ restaurantId, supplierId, file })
    const parsed = result.parsedData
    setScanResultId(result.scanResultId)
    setSupplierNameGuess(parsed.supplier_name)
    setSupplierTrn(parsed.supplier_trn ?? null)
    setInvoiceNumber(parsed.invoice_number ?? '')
    setInvoiceDate(parsed.invoice_date ?? '')
    setLpoNumber(parsed.lpo_number ?? null)
    setPrintedTotal(parsed.grand_total ?? null)
    setRows(
      parsed.items.map((item) => {
        const match = matchProduct(products, item)
        const unit = matchUnit(units, item.uom)
        return {
          ...item,
          productId: match?.product.id ?? '',
          unitId: unit?.id ?? match?.product.base_unit_id ?? '',
          packSize: item.pack_size != null ? String(item.pack_size) : '',
          // Zero-value lines (e.g. a free delivery charge) are skipped by default.
          include: (Number(item.quantity) || 0) > 0 && (Number(item.unit_price) || 0) > 0,
          match: match?.kind ?? null,
          lineDiscount: Number(item.discount) || 0,
          // Older scans had no VAT column; UAE standard rate is the sensible default.
          vatPercent: item.vat_percent === 0 ? 0 : 5,
        }
      }),
    )
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const included = rows.filter((r) => r.include)
  const ready = included.filter((r) => r.productId && r.unitId && r.quantity > 0)
  const totals = included.reduce(
    (acc, r) => {
      const a = lineAmounts(r)
      return { before: acc.before + a.before, vat: acc.vat + a.vat, total: acc.total + a.total, discount: acc.discount + (Number(r.lineDiscount) || 0) }
    },
    { before: 0, vat: 0, total: 0, discount: 0 },
  )
  const totalMismatch = printedTotal !== null && Math.abs(round2(totals.total) - printedTotal) > 0.1

  function handleConfirm() {
    if (ready.length === 0 || !scanResultId) return
    onConfirm({
      scanResultId,
      invoiceNumber,
      invoiceDate,
      lpoNumber,
      supplierName: supplierNameGuess,
      supplierTrn,
      items: ready.map((r) => ({
        productId: r.productId,
        unitId: r.unitId,
        packSize: r.packSize,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        discount: Number(r.lineDiscount) || 0,
        vatRate: r.vatPercent === 0 ? 0 : 0.05,
      })),
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)} type="button">
        <ScanLine /> Scan invoice
      </Button>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[min(96vw,90rem)]">
        <DialogHeader>
          <DialogTitle>Scan invoice</DialogTitle>
          <DialogDescription>
            Upload a photo or PDF of the supplier's tax invoice. Lines are read in the invoice's own order and matched to your items — check
            every line below; nothing is added to the purchase until you confirm.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-12">
            {scanInvoice.isPending ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reading invoice… this can take up to a minute for a long bill.</p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={!restaurantId}>
                  Choose file or take photo
                </Button>
                <p className="text-xs text-muted-foreground">{restaurantId ? 'PDF, JPG, PNG or WebP — up to 20 MB' : 'Select a restaurant first'}</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Supplier (read from invoice)</Label>
                <p className="text-sm font-medium">{supplierNameGuess ?? 'Not detected'}</p>
                {supplierTrn && <p className="text-xs text-muted-foreground">TRN {supplierTrn}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="scan-invoice-number" className="text-xs text-muted-foreground">
                  Invoice number
                </Label>
                <Input id="scan-invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="scan-invoice-date" className="text-xs text-muted-foreground">
                  Invoice date
                </Label>
                <Input id="scan-invoice-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="scan-lpo" className="text-xs text-muted-foreground">
                  LPO / PO no.
                </Label>
                <Input id="scan-lpo" value={lpoNumber ?? ''} onChange={(e) => setLpoNumber(e.target.value || null)} />
              </div>
              <div className="flex items-end">
                <p className="text-sm">
                  <span className="font-semibold">{ready.length}</span> of {included.length} lines ready
                  {included.length > ready.length && <span className="block text-xs text-warning-foreground">Map the remaining items or untick them</span>}
                </p>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-md border">
              <Table className="text-[13px]">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Item code</TableHead>
                    <TableHead>Item description (invoice)</TableHead>
                    <TableHead className="min-w-56">Your item</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right leading-tight">Amount<br />before VAT</TableHead>
                    <TableHead>VAT %</TableHead>
                    <TableHead className="text-right leading-tight">VAT<br />amount</TableHead>
                    <TableHead className="text-right leading-tight">Amount<br />incl. VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const a = lineAmounts(row)
                    const printed = row.amount_including_vat
                    const differs = printed != null && Math.abs(a.total - printed) > 0.05
                    return (
                      <TableRow key={index} className={cn('align-top', !row.include && 'opacity-50', row.include && !row.productId && 'bg-warning/5')}>
                        <TableCell className="pt-3">
                          <Checkbox checked={row.include} onCheckedChange={(v) => updateRow(index, { include: v === true })} aria-label="Include line" />
                        </TableCell>
                        <TableCell className="pt-3 text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="pt-3 tabular-nums">{row.sku ?? '—'}</TableCell>
                        <TableCell className="max-w-56 pt-3">
                          <p>{row.description}</p>
                          {row.is_uncertain && (
                            <Badge variant="outline" className="mt-1 gap-1 border-warning/40 text-warning-foreground">
                              <AlertTriangle className="size-3" /> Unclear · {row.confidence}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ScannedProductPicker
                            value={row.productId}
                            suggestedName={row.description}
                            suggestedSku={row.sku}
                            unitId={row.unitId}
                            onSelect={(id, baseUnitId) => updateRow(index, { productId: id, unitId: row.unitId || baseUnitId, match: null, include: true })}
                          />
                          {row.productId && row.match && (
                            <p className={cn('mt-0.5 text-[11px]', row.match === 'similar' ? 'text-warning-foreground' : 'text-success')}>{MATCH_LABEL[row.match]}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={row.unitId || undefined} onValueChange={(v) => updateRow(index, { unitId: v })}>
                            <SelectTrigger className="h-8 w-24" title={row.uom ? `Invoice: ${row.uom}` : undefined}>
                              <SelectValue placeholder={row.uom ?? 'Unit'} />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.uom && <p className="mt-0.5 text-[11px] text-muted-foreground">Invoice: {row.uom}</p>}
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 w-16" type="number" step="0.001" value={row.quantity} onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 w-24 text-right" type="number" step="0.01" value={row.unit_price} onChange={(e) => updateRow(index, { unit_price: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 w-20 text-right" type="number" step="0.01" min="0" value={row.lineDiscount} onChange={(e) => updateRow(index, { lineDiscount: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell className="pt-3 text-right tabular-nums">{money(a.before)}</TableCell>
                        <TableCell>
                          <Select value={String(row.vatPercent)} onValueChange={(v) => updateRow(index, { vatPercent: Number(v) })}>
                            <SelectTrigger className="h-8 w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="0">0</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="pt-3 text-right tabular-nums">{money(a.vat)}</TableCell>
                        <TableCell className="pt-3 text-right font-medium tabular-nums">
                          {money(a.total)}
                          {differs && <p className="text-[11px] font-normal text-warning-foreground">Invoice: {money(printed!)}</p>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto grid w-full max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-right tabular-nums">{money(totals.discount)}</span>
              <span className="text-muted-foreground">Total before VAT</span>
              <span className="text-right tabular-nums">{money(totals.before)}</span>
              <span className="text-muted-foreground">VAT</span>
              <span className="text-right tabular-nums">{money(totals.vat)}</span>
              <span className="font-semibold">Grand total (AED)</span>
              <span className="text-right font-semibold tabular-nums">{money(totals.total)}</span>
              {printedTotal !== null && (
                <>
                  <span className="text-muted-foreground">Printed on invoice</span>
                  <span className={cn('text-right tabular-nums', totalMismatch ? 'text-warning-foreground' : 'text-success')}>
                    {money(printedTotal)} {totalMismatch ? '— check lines' : '✓'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset}>
              Start over
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={ready.length === 0}>
              Add {ready.length} line{ready.length === 1 ? '' : 's'} to purchase
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Searchable item picker, with "New item: …" to create the scanned item on the spot. */
function ScannedProductPicker({
  value,
  suggestedName,
  suggestedSku,
  unitId,
  onSelect,
}: {
  value: string
  suggestedName: string
  suggestedSku: string | null
  unitId: string
  onSelect: (productId: string, baseUnitId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: products = [] } = useProductsOptions()
  const { data: units = [] } = useUnitsOptions()
  const quickCreate = useQuickCreateProduct()
  const selected = products.find((p) => p.id === value)

  async function handleCreate() {
    const baseUnitId = unitId || units[0]?.id
    if (!baseUnitId) return
    const productId = await quickCreate.mutateAsync({ name: suggestedName, baseUnitId, sku: suggestedSku ?? undefined })
    onSelect(productId, baseUnitId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className={cn('h-8 w-full justify-between px-2 font-normal', !selected && 'border-warning/50 text-muted-foreground')}>
          <span className="truncate">{selected?.name ?? 'Map to item…'}</span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search your items…" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">No match.</CommandEmpty>
            <CommandGroup forceMount>
              <CommandItem forceMount value={`__new__${suggestedName}`} onSelect={() => void handleCreate()} disabled={quickCreate.isPending} className="text-primary">
                {quickCreate.isPending ? <Loader2 className="animate-spin" /> : <Plus className="text-primary" />}
                New item: “{suggestedName}”
              </CommandItem>
            </CommandGroup>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`}
                  onSelect={() => {
                    onSelect(p.id, p.base_unit_id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', p.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{p.name}</span>
                  {p.sku && <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
