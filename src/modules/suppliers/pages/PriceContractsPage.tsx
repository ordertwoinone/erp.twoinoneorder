import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useSuppliersOptions } from '@/hooks/useCatalogOptions'

interface ContractRow {
  id: string
  supplier_id: string
  supplier_name: string
  product_name: string
  sku: string | null
  unit_code: string
  pack_size: number | null
  agreed_price: number
  valid_from: string
  restaurant_names: string[]
}

function usePriceContractsQuery() {
  return useQuery({
    queryKey: ['price-contracts'],
    queryFn: async (): Promise<ContractRow[]> => {
      const { data, error } = await supabase
        .from('supplier_price_locks')
        .select('id, supplier_id, pack_size, agreed_price, valid_from, suppliers(name), products(name, sku), units(code)')
        .eq('is_current', true)
        .order('valid_from', { ascending: false })
      if (error) throw error

      const ids = data.map((d) => d.id)
      const { data: scopes, error: scopesError } = ids.length
        ? await supabase.from('supplier_price_lock_restaurants').select('price_lock_id, restaurants(name)').in('price_lock_id', ids)
        : { data: [] as { price_lock_id: string; restaurants: { name: string } | null }[], error: null }
      if (scopesError) throw scopesError

      return data.map((d) => ({
        id: d.id,
        supplier_id: d.supplier_id,
        supplier_name: d.suppliers?.name ?? '—',
        product_name: d.products?.name ?? '—',
        sku: d.products?.sku ?? null,
        unit_code: d.units?.code ?? '',
        pack_size: d.pack_size,
        agreed_price: d.agreed_price,
        valid_from: d.valid_from,
        restaurant_names: scopes.filter((s) => s.price_lock_id === d.id).map((s) => s.restaurants?.name ?? ''),
      }))
    },
  })
}

export default function PriceContractsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = usePriceContractsQuery()
  const { data: suppliers = [] } = useSuppliersOptions()
  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('all')

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data ?? []).filter(
      (r) =>
        (supplierId === 'all' || r.supplier_id === supplierId) &&
        (!term || r.product_name.toLowerCase().includes(term) || (r.sku ?? '').toLowerCase().includes(term) || r.supplier_name.toLowerCase().includes(term)),
    )
  }, [data, search, supplierId])

  const columns = useMemo<ColumnDef<ContractRow>[]>(
    () => [
      { accessorKey: 'supplier_name', header: 'Supplier' },
      {
        accessorKey: 'product_name',
        header: 'Item',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.product_name}</p>
            {row.original.sku && <p className="text-xs text-muted-foreground">SKU: {row.original.sku}</p>}
          </div>
        ),
      },
      { accessorKey: 'unit_code', header: 'Unit' },
      { accessorKey: 'pack_size', header: 'Pack', cell: ({ getValue }) => (getValue() as number | null) ?? '—' },
      {
        accessorKey: 'agreed_price',
        header: 'Agreed price',
        cell: ({ getValue }) => <span className="font-semibold tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      {
        accessorKey: 'restaurant_names',
        header: 'Applies to',
        cell: ({ getValue }) => {
          const names = getValue() as string[]
          return names.length === 0 ? <Badge variant="secondary">All restaurants</Badge> : <span className="text-sm">{names.join(', ')}</span>
        },
      },
      { accessorKey: 'valid_from', header: 'Since', cell: ({ getValue }) => formatDate(getValue() as string) },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Price Contracts" description="Current agreed prices across all suppliers — the contract prices New Purchase checks invoices against." />
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search item, SKU or supplier…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No agreed prices yet. Add them from a supplier's Purchase Lock tab."
        onRowClick={(row) => navigate(`/suppliers/${row.supplier_id}`)}
      />
    </div>
  )
}
