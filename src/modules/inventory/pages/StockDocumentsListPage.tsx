import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { InventoryRibbon } from '../components/InventoryRibbon'
import { STOCK_DOCS_PAGE_SIZE, useStockDocumentsQuery } from '../hooks/useStockDocuments'
import { stockDocConfig, type StockDocKind } from '../stockDocs'

export default function StockDocumentsListPage({ kind }: { kind: StockDocKind }) {
  const config = stockDocConfig[kind]
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [unpostedOnly, setUnpostedOnly] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isLoading, isFetching } = useStockDocumentsQuery(kind, { restaurantId: selectedRestaurantId, search, unpostedOnly, pageIndex })
  const rows = data?.rows ?? []
  const total = Number(data?.totalCount ?? 0)
  const pages = Math.max(1, Math.ceil(total / STOCK_DOCS_PAGE_SIZE))

  const find = () => {
    setSearch(draftSearch.trim())
    setPageIndex(0)
  }

  return (
    <div className="space-y-4">
      <InventoryRibbon />

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold">{config.title}</h1>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={unpostedOnly}
                onCheckedChange={(v) => {
                  setUnpostedOnly(v === true)
                  setPageIndex(0)
                }}
              />
              Un Post
            </label>
          </div>
          <Button asChild size="sm">
            <Link to={`${config.path}/new`}>
              <Plus /> New {config.singular}
            </Link>
          </Button>
        </div>

        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            find()
          }}
        >
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Enter text to search…" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} />
          </div>
          <Button type="submit" variant="outline">
            Find
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraftSearch('')
              setSearch('')
              setPageIndex(0)
            }}
          >
            Clear
          </Button>
          {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </form>

        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ref No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>{config.twoLocations ? 'From' : 'Location Name'}</TableHead>
                {config.counterpartyLabel && <TableHead>{config.counterpartyLabel}</TableHead>}
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">{config.totalLabel}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No {config.title.toLowerCase()} {unpostedOnly ? 'waiting to be posted' : 'yet'}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`${config.path}/${r.id}`)}>
                    <TableCell className="font-medium">{r.doc_number}</TableCell>
                    <TableCell>{formatDate(r.doc_date)}</TableCell>
                    <TableCell>{r.location_name}</TableCell>
                    {config.counterpartyLabel && <TableCell>{r.counterparty ?? '—'}</TableCell>}
                    <TableCell className="max-w-64 truncate text-muted-foreground">{r.narration ?? ''}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.item_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.total_amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="icon" className="size-7" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            {config.title} {total === 0 ? 0 : pageIndex + 1} of {pages} · {total} records
          </span>
          <Button variant="ghost" size="icon" className="size-7" disabled={pageIndex + 1 >= pages} onClick={() => setPageIndex((p) => p + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
