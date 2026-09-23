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
import { usePaymentVouchersQuery, PAYMENTS_PAGE_SIZE } from '../hooks/usePaymentVouchers'

interface VoucherRow {
  id: string
  voucher_number: string
  payee_type: string
  amount: number
  status: string
  voucher_date: string
  suppliers: { name: string } | null
}

export default function PaymentsListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = usePaymentVouchersQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<VoucherRow>[]>(
    () => [
      { accessorKey: 'voucher_number', header: 'Voucher #' },
      {
        accessorKey: 'payee_type',
        header: 'Payee',
        cell: ({ row }) =>
          row.original.payee_type === 'supplier' ? row.original.suppliers?.name ?? '—' : 'Expense',
      },
      { accessorKey: 'voucher_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Payment vouchers for suppliers and operating expenses."
        actions={
          hasPermission('payments.create') && (
            <Button asChild>
              <Link to="/payments/new">
                <Plus /> New Payment
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No payment vouchers yet."
        onRowClick={(row) => navigate(`/payments/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: PAYMENTS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
