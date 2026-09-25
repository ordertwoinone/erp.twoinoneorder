import { useRef, useState } from 'react'
import { AlertTriangle, Loader2, Plus, ScanLine, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useQuickCreateProduct } from '@/modules/suppliers/hooks/usePriceLocks'
import { useScanInvoice, type ExtractedInvoiceItem } from '../hooks/useInvoiceScan'

interface ReviewRow extends ExtractedInvoiceItem {
  productId: string
  unitId: string
  packSize: string
}

export interface ScannedInvoiceResult {
  scanResultId: string
  invoiceNumber: string
  invoiceDate: string
  items: { productId: string; unitId: string; packSize: string; quantity: number; unitPrice: number; taxAmount: number }[]
}

interface InvoiceScanDialogProps {
  restaurantId: string | null
  supplierId: string | null
  onConfirm: (result: ScannedInvoiceResult) => void
}

export function InvoiceScanDialog({ restaurantId, supplierId, onConfirm }: InvoiceScanDialogProps) {
  const [open, setOpen] = useState(false)
  const [scanResultId, setScanResultId] = useState<string | null>(null)
  const [supplierNameGuess, setSupplierNameGuess] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: units } = useUnitsOptions()
  const scanInvoice = useScanInvoice()

  function reset() {
    setScanResultId(null)
    setSupplierNameGuess(null)
    setInvoiceNumber('')
    setInvoiceDate('')
    setRows([])
  }

  async function handleFileSelected(file: File) {
    if (!restaurantId) return
    const result = await scanInvoice.mutateAsync({ restaurantId, supplierId, file })
    setScanResultId(result.scanResultId)
    setSupplierNameGuess(result.parsedData.supplier_name)
    setInvoiceNumber(result.parsedData.invoice_number ?? '')
    setInvoiceDate(result.parsedData.invoice_date ?? '')
    setRows(
      result.parsedData.items.map((item) => ({
        ...item,
        productId: '',
        unitId: '',
        packSize: item.pack_size != null ? String(item.pack_size) : '',
      })),
    )
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function handleConfirm() {
    const mapped = rows.filter((r) => r.productId && r.unitId)
    if (mapped.length === 0 || !scanResultId) return
    onConfirm({
      scanResultId,
      invoiceNumber,
      invoiceDate,
      items: mapped.map((r) => ({
        productId: r.productId,
        unitId: r.unitId,
        packSize: r.packSize,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        taxAmount: 0,
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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Scan invoice</DialogTitle>
          <DialogDescription>
            Upload a photo or PDF of the supplier invoice. Review and map every line below — nothing is added to the
            purchase until you confirm.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-12">
            {scanInvoice.isPending ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reading invoice…</p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={!restaurantId}>
                  Choose file
                </Button>
                <p className="text-xs text-muted-foreground">
                  {restaurantId ? 'PDF, JPG, PNG or WebP — up to 20 MB' : 'Select a restaurant first'}
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Supplier (read from invoice)</Label>
                <p className="text-sm font-medium">{supplierNameGuess ?? 'Not detected — confirm on the form'}</p>
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
            </div>

            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Extracted</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-24">Unit</TableHead>
                    <TableHead className="w-20">Pack</TableHead>
                    <TableHead className="w-16">Qty</TableHead>
                    <TableHead className="w-28">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-40">
                        <p className="truncate text-sm">{row.description}</p>
                        {row.is_uncertain && (
                          <Badge variant="outline" className="mt-1 gap-1 border-warning/40 text-warning-foreground">
                            <AlertTriangle className="size-3" /> {row.confidence}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ScannedProductPicker
                          value={row.productId}
                          suggestedName={row.description}
                          suggestedSku={row.sku}
                          onSelect={(id, baseUnitId) => updateRow(index, { productId: id, unitId: row.unitId || baseUnitId })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={row.unitId} onValueChange={(v) => updateRow(index, { unitId: v })}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units?.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-8" value={row.packSize} onChange={(e) => updateRow(index, { packSize: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.001"
                          value={row.quantity}
                          onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          value={row.unit_price}
                          onChange={(e) => updateRow(index, { unit_price: Number(e.target.value) })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset}>
              Start over
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Use this data
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScannedProductPicker({
  value,
  suggestedName,
  suggestedSku,
  onSelect,
}: {
  value: string
  suggestedName: string
  suggestedSku: string | null
  onSelect: (productId: string, baseUnitId: string) => void
}) {
  const { data: products } = useProductsOptions()
  const { data: units } = useUnitsOptions()
  const quickCreate = useQuickCreateProduct()
  const NEW_PRODUCT = '__new__'

  async function handleCreate() {
    const defaultUnit = units?.[0]
    if (!defaultUnit) return
    const productId = await quickCreate.mutateAsync({ name: suggestedName, baseUnitId: defaultUnit.id, sku: suggestedSku ?? undefined })
    onSelect(productId, defaultUnit.id)
  }

  return (
    <Select value={value} onValueChange={(v) => (v === NEW_PRODUCT ? handleCreate() : onSelect(v, products?.find((p) => p.id === v)?.base_unit_id ?? ''))}>
      <SelectTrigger className="h-8">
        <SelectValue placeholder="Map to product" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NEW_PRODUCT}>
          <Plus className="size-3.5" /> New: "{suggestedName}"
        </SelectItem>
        {products?.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
