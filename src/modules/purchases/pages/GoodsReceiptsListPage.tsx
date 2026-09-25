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
import { useGoodsReceiptsQuery, GOODS_RECEIPTS_PAGE_SIZE } from '../hooks/useGoodsReceipts'

interface ReceiptRow {
  id: string
  receipt_number: string
  status: string
  received_date: string
  restaurants: { name: string } | null
  purchase_orders: { order_number: string } | null
  purchases: { invoice_number: string } | null
}

export default function GoodsReceiptsListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = useGoodsReceiptsQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<ReceiptRow>[]>(
    () => [
      { accessorKey: 'receipt_number', header: 'Receipt #' },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      {
        accessorKey: 'purchase_orders.order_number',
        header: 'Purchase Order',
        cell: ({ row }) => row.original.purchase_orders?.order_number ?? '—',
      },
      {
        accessorKey: 'purchases.invoice_number',
        header: 'Invoice',
        cell: ({ row }) => row.original.purchases?.invoice_number ?? '—',
      },
      { accessorKey: 'received_date', header: 'Received', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipts"
        description="What physically arrived at each restaurant, against orders and invoices."
        actions={
          hasPermission('purchases.create') && (
            <Button asChild>
              <Link to="/purchases/receipts/new">
                <Plus /> New Goods Receipt
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No goods receipts yet."
        onRowClick={(row) => navigate(`/purchases/receipts/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: GOODS_RECEIPTS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
