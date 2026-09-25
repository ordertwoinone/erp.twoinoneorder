import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBrandsOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useQuickCreateProduct } from '@/modules/suppliers/hooks/usePriceLocks'

interface AddNewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onCreated: (product: { id: string; name: string; baseUnitId: string; baseUnitCode: string; brandName: string | null }) => void
}

export function AddNewItemDialog({ open, onOpenChange, initialName, onCreated }: AddNewItemDialogProps) {
  const [name, setName] = useState(initialName)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [brandId, setBrandId] = useState('')
  const [unitId, setUnitId] = useState('')

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
    }
  }, [open, initialName])

  async function handleCreate() {
    if (!name.trim() || !unitId) return
    const productId = await quickCreate.mutateAsync({ name: name.trim(), baseUnitId: unitId, sku, brandId, barcode })
    const unit = units?.find((u) => u.id === unitId)
    const brand = brands?.find((b) => b.id === brandId)
    onCreated({ id: productId, name: name.trim(), baseUnitId: unitId, baseUnitCode: unit?.code ?? '', brandName: brand?.name ?? null })
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
          <div className="space-y-2">
            <Label htmlFor="new-item-name">Item name</Label>
            <Input id="new-item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {brands?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || !unitId || quickCreate.isPending}>
            {quickCreate.isPending && <Loader2 className="animate-spin" />}
            Create &amp; add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
