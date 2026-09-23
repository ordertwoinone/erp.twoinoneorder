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
import { useBranchTransfersQuery, TRANSFERS_PAGE_SIZE } from '../hooks/useInventory'

interface TransferRow {
  id: string
  transfer_number: string
  status: string
  dispatch_date: string
  from: { name: string } | null
  to: { name: string } | null
}

export default function BranchTransfersListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = useBranchTransfersQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<TransferRow>[]>(
    () => [
      { accessorKey: 'transfer_number', header: 'Transfer #' },
      { accessorKey: 'from.name', header: 'From', cell: ({ row }) => row.original.from?.name ?? '—' },
      { accessorKey: 'to.name', header: 'To', cell: ({ row }) => row.original.to?.name ?? '—' },
      { accessorKey: 'dispatch_date', header: 'Dispatched', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Transfers"
        description="Move stock between restaurants."
        actions={
          hasPermission('inventory.manage') && (
            <Button asChild>
              <Link to="/inventory/transfers/new">
                <Plus /> New Transfer
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No branch transfers yet."
        onRowClick={(row) => navigate(`/inventory/transfers/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: TRANSFERS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
