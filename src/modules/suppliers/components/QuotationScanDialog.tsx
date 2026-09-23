import { useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Plus, ScanLine, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useProductsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { supabase } from '@/lib/supabase/client'
import { useScanQuotation } from '../hooks/useQuotationScan'
import { useQuickCreateProduct } from '../hooks/usePriceLocks'
import type { ExtractedQuotationItem } from '../hooks/quotationTypes'

interface ReviewRow extends ExtractedQuotationItem {
  productId: string
  unitId: string
  packSize: string
  price: number
}

export function QuotationScanDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false)
  const [scanResultId, setScanResultId] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [restaurantIds, setRestaurantIds] = useState<string[]>([])
  const [isConfirming, setIsConfirming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: units } = useUnitsOptions()
  const { data: restaurants } = useRestaurantsQuery()
  const scanQuotation = useScanQuotation()
  const quickCreateProduct = useQuickCreateProduct()

  function reset() {
    setScanResultId(null)
    setRows([])
    setRestaurantIds([])
  }

  async function handleFileSelected(file: File) {
    const result = await scanQuotation.mutateAsync({ supplierId, file })
    setScanResultId(result.scanResultId)
    setRows(
      result.parsedData.items.map((item) => ({
        ...item,
        productId: '',
        unitId: '',
        packSize: '',
        price: item.unit_price,
      })),
    )
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function handleQuickCreate(index: number, name: string) {
    const defaultUnit = units?.[0]
    if (!defaultUnit) return
    const productId = await quickCreateProduct.mutateAsync({ name, baseUnitId: defaultUnit.id })
    updateRow(index, { productId, unitId: defaultUnit.id })
  }

  async function handleConfirm() {
    const mapped = rows.filter((r) => r.productId && r.unitId)
    if (mapped.length === 0) {
      toast.error('Map at least one item to a product before confirming.')
      return
    }
    setIsConfirming(true)
    try {
      const { error } = await supabase.rpc('confirm_supplier_price_locks', {
        p_scan_result_id: scanResultId!,
        p_items: mapped.map((r) => ({
          product_id: r.productId,
          unit_id: r.unitId,
          pack_size: r.packSize || null,
          agreed_price: r.price,
          restaurant_ids: restaurantIds,
        })),
      })
      if (error) throw error
      toast.success(`Saved ${mapped.length} price lock${mapped.length === 1 ? '' : 's'}`)
      reset()
      setOpen(false)
    } catch (error) {
      toast.error('Unable to confirm price locks', { description: (error as Error).message })
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <ScanLine /> Scan quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Scan quotation / price list</DialogTitle>
          <DialogDescription>
            Upload a PDF, photo, or spreadsheet. Review every extracted line before it becomes a price lock — nothing
            is saved automatically.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-12">
            {scanQuotation.isPending ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reading document…</p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <Button onClick={() => fileInputRef.current?.click()}>Choose file</Button>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP, XLSX, XLS, or CSV — up to 20 MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Extracted</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-24">Unit</TableHead>
                    <TableHead className="w-24">Pack</TableHead>
                    <TableHead className="w-28">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-48">
                        <p className="truncate text-sm">{row.description}</p>
                        {row.is_uncertain && (
                          <Badge variant="outline" className="mt-1 gap-1 border-warning/40 text-warning-foreground">
                            <AlertTriangle className="size-3" /> {row.confidence}% confidence
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProductPicker
                          value={row.productId}
                          suggestedName={row.description}
                          onSelect={(id) => updateRow(index, { productId: id })}
                          onCreate={(name) => handleQuickCreate(index, name)}
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
                        <Input
                          className="h-8"
                          value={row.packSize}
                          onChange={(e) => updateRow(index, { packSize: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          type="number"
                          step="0.01"
                          value={row.price}
                          onChange={(e) => updateRow(index, { price: Number(e.target.value) })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label>Applies to</Label>
              <div className="flex max-h-28 flex-wrap gap-3 overflow-y-auto rounded-md border p-3">
                <p className="w-full text-xs text-muted-foreground">Leave all unchecked to apply to every restaurant.</p>
                {restaurants?.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={restaurantIds.includes(r.id)}
                      onCheckedChange={(checked) =>
                        setRestaurantIds((prev) => (checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              Start over
            </Button>
            <Button onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? <Loader2 className="animate-spin" /> : <Check />}
              Confirm & save price locks
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProductPicker({
  value,
  suggestedName,
  onSelect,
  onCreate,
}: {
  value: string
  suggestedName: string
  onSelect: (productId: string) => void
  onCreate: (name: string) => void
}) {
  const { data: products } = useProductsOptions()
  const NEW_PRODUCT = '__new__'

  return (
    <Select
      value={value}
      onValueChange={(v) => (v === NEW_PRODUCT ? onCreate(suggestedName) : onSelect(v))}
    >
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
