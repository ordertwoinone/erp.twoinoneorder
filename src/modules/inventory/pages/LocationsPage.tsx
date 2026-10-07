import { useState } from 'react'
import { Loader2, MapPin, Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useSuppliersOptions } from '@/hooks/useCatalogOptions'
import { formatCurrency } from '@/lib/utils/format'
import { InventoryRibbon } from '../components/InventoryRibbon'
import { useLocationsQuery, useSaveLocation, type LocationRow } from '../hooks/useStockDocuments'

const NONE = '__none__'

interface LocationForm {
  id?: string
  name: string
  linked_supplier_id: string | null
  linked_customer_name: string
}

export default function LocationsPage() {
  const { hasPermission } = useAuth()
  const { data: locations = [], isLoading } = useLocationsQuery()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<LocationForm | null>(null)
  const q = search.trim().toLowerCase()
  const rows = locations.filter((l) => !q || `${l.name} ${l.code} ${l.linked_supplier_name ?? ''} ${l.linked_customer_name ?? ''}`.toLowerCase().includes(q))
  const canCreate = hasPermission('restaurants.manage')

  const open = (l: LocationRow) =>
    setEditing({ id: l.id, name: l.name, linked_supplier_id: l.linked_supplier_id, linked_customer_name: l.linked_customer_name ?? '' })

  return (
    <div className="space-y-4">
      <InventoryRibbon />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <h1 className="text-base font-semibold">Locations</h1>
          {canCreate && (
            <Button size="sm" onClick={() => setEditing({ name: '', linked_supplier_id: null, linked_customer_name: '' })}>
              <Plus /> New Location
            </Button>
          )}
        </div>
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(draft)
          }}
        >
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Enter text to search…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <Button type="submit" variant="outline">
            Find
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft('')
              setSearch('')
            }}
          >
            Clear
          </Button>
        </form>
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Location Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Linked Customer</TableHead>
                <TableHead>Linked Vendor</TableHead>
                <TableHead className="text-right">Items in stock</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    No locations found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => open(l)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-red-500" />
                        {l.name}
                        {l.is_head_office && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">HEAD OFFICE</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.code}</TableCell>
                    <TableCell>{l.linked_customer_name ?? '—'}</TableCell>
                    <TableCell>{l.linked_supplier_name ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.item_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(l.stock_value)}</TableCell>
                    <TableCell>
                      <Pencil className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-4 py-2 text-sm text-muted-foreground">Locations 1 of 1 · {rows.length} records</p>
      </div>
      <LocationDialog value={editing} canRename={canCreate} onClose={() => setEditing(null)} />
    </div>
  )
}

function LocationDialog({ value, canRename, onClose }: { value: LocationForm | null; canRename: boolean; onClose: () => void }) {
  const { data: suppliers = [] } = useSuppliersOptions()
  const save = useSaveLocation()
  const [form, setForm] = useState<LocationForm>({ name: '', linked_supplier_id: null, linked_customer_name: '' })
  const [loadedFor, setLoadedFor] = useState<LocationForm | null>(null)
  if (value && value !== loadedFor) {
    setLoadedFor(value)
    setForm(value)
  }

  async function submit(mode: 'close' | 'new' | 'stay') {
    if (!form.name.trim()) return
    const id = await save.mutateAsync(form)
    if (mode === 'close') onClose()
    else if (mode === 'new') setForm({ name: '', linked_supplier_id: null, linked_customer_name: '' })
    else setForm((f) => ({ ...f, id }))
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit Location' : 'New Location'}</DialogTitle>
          <DialogDescription>Each location keeps its own stock. Link the vendor/customer used when goods move between companies.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit('close')
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Location Name</Label>
            <Input id="loc-name" autoFocus value={form.name} disabled={!!form.id && !canRename} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc-customer">Linked Customer</Label>
            <Input
              id="loc-customer"
              placeholder="[Enter a customer]"
              value={form.linked_customer_name}
              onChange={(e) => setForm((f) => ({ ...f, linked_customer_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Linked Vendor</Label>
            <Select value={form.linked_supplier_id ?? NONE} onValueChange={(v) => setForm((f) => ({ ...f, linked_supplier_id: v === NONE ? null : v }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="[Select a Vendor]" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No linked vendor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            {!form.id && (
              <Button type="button" variant="outline" disabled={save.isPending || !form.name.trim()} onClick={() => submit('new')}>
                Save &amp; New
              </Button>
            )}
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {save.isPending && <Loader2 className="animate-spin" />} Save &amp; Close
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
