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
import { usePurchaseRequestsQuery, PURCHASE_REQUESTS_PAGE_SIZE } from '../hooks/usePurchaseRequests'

interface RequestRow {
  id: string
  request_number: string
  status: string
  requested_at: string
  restaurants: { name: string } | null
}

export default function PurchaseRequestsListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = usePurchaseRequestsQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<RequestRow>[]>(
    () => [
      { accessorKey: 'request_number', header: 'Request #' },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      { accessorKey: 'requested_at', header: 'Requested', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requests"
        description="Branch requests awaiting head office review."
        actions={
          hasPermission('purchases.create') && (
            <Button asChild>
              <Link to="/purchases/requests/new">
                <Plus /> New Request
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No purchase requests yet."
        onRowClick={(row) => navigate(`/purchases/requests/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: PURCHASE_REQUESTS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
