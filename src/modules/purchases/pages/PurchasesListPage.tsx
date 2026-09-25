import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { usePurchasesQuery, PURCHASES_PAGE_SIZE, type PurchaseFilters } from '../hooks/usePurchases'

type PurchaseStatusFilter = PurchaseFilters['status']

interface PurchaseRow {
  id: string
  purchase_number: string
  invoice_number: string
  invoice_date: string
  status: string
  payment_status: string
  total_amount: number
  restaurants: { name: string } | null
  suppliers: { name: string } | null
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function PurchasesListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const supplierId = searchParams.get('supplier')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PurchaseStatusFilter>(
    (searchParams.get('status') as PurchaseStatusFilter) ?? 'all',
  )
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = usePurchasesQuery({
    search,
    status,
    paymentStatus: (searchParams.get('payment') as PurchaseFilters['paymentStatus']) ?? 'all',
    restaurantId: selectedRestaurantId,
    supplierId,
    invoiceDateFrom: searchParams.get('from'),
    invoiceDateTo: searchParams.get('to'),
    pageIndex,
  })

  const columns = useMemo<ColumnDef<PurchaseRow>[]>(
    () => [
      { accessorKey: 'purchase_number', header: 'Purchase #' },
      { accessorKey: 'invoice_number', header: 'Invoice #' },
      { accessorKey: 'suppliers.name', header: 'Supplier', cell: ({ row }) => row.original.suppliers?.name ?? '—' },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      {
        accessorKey: 'invoice_date',
        header: 'Invoice Date',
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
      {
        accessorKey: 'payment_status',
        header: 'Payment',
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Manual purchase entry and approval workflow."
        actions={
          hasPermission('purchases.create') && (
            <Button asChild>
              <Link to="/purchases/new">
                <Plus /> New Purchase
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice or purchase #…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPageIndex(0)
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as PurchaseStatusFilter)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No purchases yet."
        onRowClick={(row) => navigate(`/purchases/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: PURCHASES_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
