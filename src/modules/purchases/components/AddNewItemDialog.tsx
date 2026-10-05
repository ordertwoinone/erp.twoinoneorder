import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadProductImage, validateProductImage } from '@/lib/productImages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBrandsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useQuickCreateProduct } from '@/modules/suppliers/hooks/usePriceLocks'
import { BrandPicker } from './BrandPicker'

interface AddNewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onCreated: (product: {
    id: string
    name: string
    baseUnitId: string
    baseUnitCode: string
    brandName: string | null
    sku: string | null
    barcode: string | null
    quantity: number
    unitPrice: number
    imagePath: string | null
  }) => void
}

export function AddNewItemDialog({ open, onOpenChange, initialName, onCreated }: AddNewItemDialogProps) {
  const [name, setName] = useState(initialName)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [brandId, setBrandId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => void (photoPreview && URL.revokeObjectURL(photoPreview)), [photoPreview])

  const { data: units } = useUnitsOptions()
  const { data: brands } = useBrandsOptions()
  const quickCreate = useQuickCreateProduct()

  useEffect(() => {
    if (open) {
      setName(initialName)
      setSku('')
      setBarcode('')
      setBrandId('')
      setUnitId('')
      setQuantity('1')
      setUnitPrice('')
      setPhoto(null)
    }
  }, [open, initialName])

  const qty = Number(quantity)
  const price = unitPrice === '' ? 0 : Number(unitPrice)
  const qtyValid = Number.isFinite(qty) && qty > 0
  const priceValid = Number.isFinite(price) && price >= 0
  const canCreate = !!name.trim() && !!unitId && qtyValid && priceValid

  async function handleCreate() {
    if (!canCreate) return
    let imagePath: string | null = null
    if (photo) {
      setUploading(true)
      try {
        imagePath = await uploadProductImage(photo)
      } catch (error) {
        // The item is still useful without a photo; say so rather than block it.
        toast.error('Photo not saved', { description: (error as Error).message })
      } finally {
        setUploading(false)
      }
    }
    const productId = await quickCreate.mutateAsync({ name: name.trim(), baseUnitId: unitId, sku, brandId, barcode, imagePath })
    const unit = units?.find((u) => u.id === unitId)
    const brand = brands?.find((b) => b.id === brandId)
    onCreated({ id: productId, name: name.trim(), baseUnitId: unitId, baseUnitCode: unit?.code ?? '', brandName: brand?.name ?? null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      quantity: qty,
      unitPrice: price,
      imagePath,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new item</DialogTitle>
          <DialogDescription>Not in the catalogue yet — create it, then add it to this purchase.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="shrink-0 space-y-2">
              <Label>Photo</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex size-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-primary/50 bg-muted/30 text-primary hover:bg-primary/5"
                  aria-label={photo ? 'Change photo' : 'Add photo'}
                >
                  {photoPreview ? <img src={photoPreview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6" />}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-destructive"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    const problem = validateProductImage(file)
                    if (problem) return void toast.error(problem)
                    setPhoto(file)
                  }}
                />
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="new-item-name">Item name</Label>
              <Input id="new-item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <p className="text-[11px] text-muted-foreground">Photo optional · JPG, PNG or WebP, up to 5 MB</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-item-sku">SKU</Label>
              <Input id="new-item-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-barcode">Barcode</Label>
              <Input id="new-item-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand</Label>
              <BrandPicker value={brandId} onChange={setBrandId} />
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-item-qty">Quantity *</Label>
              <Input
                id="new-item-qty"
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-invalid={!qtyValid}
              />
              {!qtyValid && <p className="text-xs text-destructive">Quantity must be greater than 0</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-price">Unit price (AED)</Label>
              <Input
                id="new-item-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                aria-invalid={!priceValid}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate || quickCreate.isPending || uploading}>
            {(quickCreate.isPending || uploading) && <Loader2 className="animate-spin" />}
            Create &amp; add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
