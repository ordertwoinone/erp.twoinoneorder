import { useState } from 'react'
import { BookOpen, Building2, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { cn } from '@/lib/utils'
import {
  useCreateLedger,
  useDeleteExpenseHead,
  useExpenseHeadsQuery,
  useLedgers,
  useSaveExpenseHead,
  type ExpenseHead,
  type ExpenseHeadInput,
  type Ledger,
} from '../hooks/useExpenseHeads'

const SHARED = '__shared__'
const ALL = '__all__'

const emptyHead: ExpenseHeadInput = {
  name: '',
  description: '',
  restaurant_id: null,
  ledger_account_id: null,
  is_head_office_only: false,
  is_active: true,
}

/** Groups ledgers as "Shared ledgers" then one group per restaurant. */
function groupLedgers(ledgers: Ledger[]) {
  const groups = new Map<string, { label: string; items: Ledger[] }>()
  for (const l of ledgers) {
    const key = l.restaurant_id ?? SHARED
    const group = groups.get(key) ?? { label: l.restaurant_name ? `${l.restaurant_name} ledgers` : 'Shared ledgers (all restaurants)', items: [] }
    group.items.push(l)
    groups.set(key, group)
  }
  return [...groups.entries()].sort(([a], [b]) => (a === SHARED ? -1 : b === SHARED ? 1 : 0)).map(([, g]) => g)
}

export default function ExpenseHeadsPage() {
  const { data: heads = [], isLoading } = useExpenseHeadsQuery()
  const { data: restaurants = [] } = useRestaurantsQuery()
  const deleteHead = useDeleteExpenseHead()
  const [filter, setFilter] = useState(ALL)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ExpenseHeadInput | null>(null)

  const term = search.trim().toLowerCase()
  const visible = heads.filter(
    (h) =>
      (filter === ALL || (filter === SHARED ? h.restaurant_id === null : h.restaurant_id === filter)) &&
      (!term || `${h.name} ${h.description ?? ''} ${h.accounting_accounts?.name ?? ''} ${h.accounting_accounts?.code ?? ''}`.toLowerCase().includes(term)),
  )

  function openEdit(h: ExpenseHead) {
    setEditing({
      id: h.id,
      name: h.name,
      description: h.description ?? '',
      restaurant_id: h.restaurant_id,
      ledger_account_id: h.ledger_account_id,
      is_head_office_only: h.is_head_office_only,
      is_active: h.is_active,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Heads"
        description="Expense categories, the ledger each one posts to, and which restaurant can use it."
        actions={
          <Button onClick={() => setEditing({ ...emptyHead, restaurant_id: filter !== ALL && filter !== SHARED ? filter : null })}>
            <Plus /> Add expense head
          </Button>
        }
      />

      <Tabs defaultValue="heads">
        <TabsList>
          <TabsTrigger value="heads">Expense heads</TabsTrigger>
          <TabsTrigger value="ledgers">Ledgers by restaurant</TabsTrigger>
        </TabsList>

        <TabsContent value="heads" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-10 w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All heads</SelectItem>
                <SelectItem value={SHARED}>Shared (all restaurants)</SelectItem>
                {restaurants.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 pl-9" placeholder="Search heads, descriptions or ledgers…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Expense head</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Head office only</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      No expense heads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((h) => (
                    <TableRow key={h.id} className={cn(!h.is_active && 'opacity-60')}>
                      <TableCell className="max-w-80">
                        <p className="font-medium">{h.name}</p>
                        {h.description && <p className="truncate text-xs text-muted-foreground">{h.description}</p>}
                      </TableCell>
                      <TableCell>{h.restaurants?.name ?? <span className="text-muted-foreground">All restaurants</span>}</TableCell>
                      <TableCell>
                        {h.accounting_accounts ? (
                          <span>
                            <span className="text-muted-foreground tabular-nums">{h.accounting_accounts.code}</span> · {h.accounting_accounts.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Default (5200 Operating Expenses)</span>
                        )}
                      </TableCell>
                      <TableCell>{h.is_head_office_only ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            h.is_active ? 'border-success/30 bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {h.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(h)} aria-label={`Edit ${h.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmActionDialog
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Delete ${h.name}`}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            }
                            title={`Delete "${h.name}"?`}
                            description="Heads already used by expenses can't be deleted — mark them inactive instead to hide them."
                            confirmLabel="Delete head"
                            destructive
                            onConfirm={() => deleteHead.mutateAsync(h.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ledgers">
          <LedgersByRestaurant />
        </TabsContent>
      </Tabs>

      <ExpenseHeadDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ExpenseHeadDialog({ value, onClose }: { value: ExpenseHeadInput | null; onClose: () => void }) {
  const { data: restaurants = [] } = useRestaurantsQuery()
  const save = useSaveExpenseHead()
  const [form, setForm] = useState<ExpenseHeadInput>(emptyHead)
  const [loadedFor, setLoadedFor] = useState<ExpenseHeadInput | null>(null)
  // Reset the fields whenever a different head is opened (state adjusted during render).
  if (value && value !== loadedFor) {
    setLoadedFor(value)
    setForm(value)
  }
  const { data: ledgers = [], isLoading: loadingLedgers } = useLedgers(form.restaurant_id)
  const expenseLedgers = ledgers.filter((l) => l.account_type === 'expense' && (l.is_active || l.id === form.ledger_account_id))
  const groups = groupLedgers(expenseLedgers)
  const [newLedgerOpen, setNewLedgerOpen] = useState(false)

  const set = <K extends keyof ExpenseHeadInput>(key: K, v: ExpenseHeadInput[K]) => setForm((f) => ({ ...f, [key]: v }))
  const restaurantName = restaurants.find((r) => r.id === form.restaurant_id)?.name

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit expense head' : 'Add expense head'}</DialogTitle>
          <DialogDescription>Expenses under this head post to the ledger you choose.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!form.name.trim()) return
            await save.mutateAsync(form)
            onClose()
          }}
        >
          <div className="space-y-1.5">
            <Label>Restaurant</Label>
            <Select
              value={form.restaurant_id ?? SHARED}
              onValueChange={(v) => {
                const restaurantId = v === SHARED ? null : v
                // A ledger that belongs to another restaurant no longer fits.
                const ledger = ledgers.find((l) => l.id === form.ledger_account_id)
                setForm((f) => ({ ...f, restaurant_id: restaurantId, ledger_account_id: ledger && ledger.restaurant_id && ledger.restaurant_id !== restaurantId ? null : f.ledger_account_id }))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SHARED}>All restaurants (shared head)</SelectItem>
                {restaurants.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="head-name">Expense head *</Label>
            <Input id="head-name" autoFocus placeholder="e.g. Gas cylinder refill" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Ledger</Label>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setNewLedgerOpen(true)}>
                <Plus className="size-3.5" /> New ledger
              </button>
            </div>
            <Select value={form.ledger_account_id ?? ''} onValueChange={(v) => set('ledger_account_id', v || null)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingLedgers ? 'Loading ledgers…' : 'Default — 5200 Operating Expenses'} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groups.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel className="flex items-center gap-1.5">
                      {g.label.startsWith('Shared') ? <BookOpen className="size-3.5" /> : <Building2 className="size-3.5" />}
                      {g.label}
                    </SelectLabel>
                    {g.items.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="text-muted-foreground tabular-nums">{l.code}</span> · {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Showing shared ledgers{restaurantName ? ` and ${restaurantName}'s own ledgers` : ''}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="head-description">Expense description</Label>
            <Textarea
              id="head-description"
              className="min-h-20"
              placeholder="What this head is for, e.g. monthly gas refills for the kitchen"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Head office only
              <Switch checked={form.is_head_office_only} onCheckedChange={(v) => set('is_head_office_only', v)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Active
              <Switch checked={form.is_active} onCheckedChange={(v) => set('is_active', v)} />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} {form.id ? 'Save changes' : 'Add expense head'}
            </Button>
          </DialogFooter>
        </form>

        <NewLedgerDialog
          open={newLedgerOpen}
          onOpenChange={setNewLedgerOpen}
          restaurantId={form.restaurant_id}
          restaurantName={restaurantName ?? null}
          onCreated={(id) => set('ledger_account_id', id)}
        />
      </DialogContent>
    </Dialog>
  )
}

function NewLedgerDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string | null
  restaurantName: string | null
  onCreated?: (id: string) => void
}) {
  const create = useCreateLedger()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New expense ledger</DialogTitle>
          <DialogDescription>{restaurantName ? `Only for ${restaurantName}.` : 'Shared by all restaurants.'}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!name.trim()) return
            const id = await create.mutateAsync({ name: name.trim(), restaurantId, code: code.trim() })
            onCreated?.(id)
            setName('')
            setCode('')
            onOpenChange(false)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ledger-name">Ledger name *</Label>
            <Input id="ledger-name" autoFocus placeholder="e.g. Gas & Fuel – Dibba" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger-code">Code</Label>
            <Input id="ledger-code" placeholder="Auto (next 5xxx number)" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />} Add ledger
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Every ledger the user can see, grouped: shared first, then each restaurant's own. */
function LedgersByRestaurant() {
  const { data: ledgers = [], isLoading } = useLedgers(null)
  const { data: restaurants = [] } = useRestaurantsQuery()
  const [restaurantFilter, setRestaurantFilter] = useState(ALL)
  const [newFor, setNewFor] = useState<{ id: string | null; name: string | null } | null>(null)
  const shown = ledgers.filter((l) => restaurantFilter === ALL || (restaurantFilter === SHARED ? l.restaurant_id === null : l.restaurant_id === restaurantFilter || l.restaurant_id === null))
  const groups = groupLedgers(shown)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
          <SelectTrigger className="h-10 w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All restaurants</SelectItem>
            <SelectItem value={SHARED}>Shared ledgers only</SelectItem>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} (+ shared)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            const r = restaurants.find((x) => x.id === restaurantFilter)
            setNewFor({ id: r?.id ?? null, name: r?.name ?? null })
          }}
        >
          <Plus /> New ledger
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="rounded-xl border bg-card">
            <h3 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
              {g.label.startsWith('Shared') ? <BookOpen className="size-4 text-primary" /> : <Building2 className="size-4 text-primary" />}
              {g.label}
              <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
            </h3>
            <Table className="table-fixed">
              <TableBody>
                {g.items.map((l) => (
                  <TableRow key={l.id} className={cn(!l.is_active && 'opacity-60')}>
                    <TableCell className="w-24 text-muted-foreground tabular-nums">{l.code}</TableCell>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="w-28 text-xs text-muted-foreground capitalize">{l.account_type}</TableCell>
                    <TableCell className="w-24 text-xs text-muted-foreground">{l.is_active ? '' : 'Inactive'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ))
      )}

      <NewLedgerDialog open={!!newFor} onOpenChange={(open) => !open && setNewFor(null)} restaurantId={newFor?.id ?? null} restaurantName={newFor?.name ?? null} />
    </div>
  )
}
