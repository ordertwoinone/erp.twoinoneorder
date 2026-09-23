import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useSalesEntriesQuery, SALES_PAGE_SIZE } from '../hooks/useSalesEntries'

interface SalesRow {
  id: string
  business_date: string
  shift: string
  gross_sales: number
  net_sales: number
  status: string
  restaurants: { name: string } | null
}

export default function SalesListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = useSalesEntriesQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<SalesRow>[]>(
    () => [
      { accessorKey: 'business_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'shift', header: 'Shift', cell: ({ getValue }) => (getValue() as string).replace('_', ' ') },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      {
        accessorKey: 'gross_sales',
        header: 'Gross Sales',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      {
        accessorKey: 'net_sales',
        header: 'Net Sales',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Entry"
        description="Daily/shift sales entry and reconciliation."
        actions={
          hasPermission('sales.create') && (
            <Button asChild>
              <Link to="/sales/new">
                <Plus /> New Sales Entry
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No sales entries yet."
        onRowClick={(row) => navigate(`/sales/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: SALES_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
