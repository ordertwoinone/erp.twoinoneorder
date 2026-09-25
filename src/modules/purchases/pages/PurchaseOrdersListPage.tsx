import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { usePurchaseOrdersQuery, PURCHASE_ORDERS_PAGE_SIZE } from '../hooks/usePurchaseOrders'

interface OrderRow {
  id: string
  order_number: string
  status: string
  order_date: string
  expected_date: string | null
  restaurants: { name: string } | null
  suppliers: { name: string } | null
}

export default function PurchaseOrdersListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = usePurchaseOrdersQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      { accessorKey: 'order_number', header: 'Order #' },
      { accessorKey: 'suppliers.name', header: 'Supplier', cell: ({ row }) => row.original.suppliers?.name ?? '—' },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      { accessorKey: 'order_date', header: 'Ordered', cell: ({ getValue }) => formatDate(getValue() as string) },
      {
        accessorKey: 'expected_date',
        header: 'Expected',
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Commitments placed with suppliers, from request to receipt."
        actions={
          hasPermission('purchase_orders.manage') && (
            <Button asChild>
              <Link to="/purchases/orders/new">
                <Plus /> New Purchase Order
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No purchase orders yet."
        onRowClick={(row) => navigate(`/purchases/orders/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: PURCHASE_ORDERS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
