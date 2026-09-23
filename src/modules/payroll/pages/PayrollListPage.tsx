import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useSalaryEntriesQuery, PAYROLL_PAGE_SIZE } from '../hooks/useSalaryEntries'

interface SalaryRow {
  id: string
  period_month: string
  net_salary: number
  status: string
  payment_status: string
  employees: { full_name: string } | null
}

export default function PayrollListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = useSalaryEntriesQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<SalaryRow>[]>(
    () => [
      {
        accessorKey: 'employees.full_name',
        header: 'Employee',
        cell: ({ row }) => row.original.employees?.full_name ?? '—',
      },
      {
        accessorKey: 'period_month',
        header: 'Period',
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-AE', { year: 'numeric', month: 'long' }),
      },
      {
        accessorKey: 'net_salary',
        header: 'Net Salary',
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
        title="Payroll"
        description="Monthly salary entries by employee and restaurant."
        actions={
          hasPermission('payroll.manage') && (
            <Button asChild>
              <Link to="/payroll/new">
                <Plus /> New Salary Entry
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No salary entries yet."
        onRowClick={(row) => navigate(`/payroll/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: PAYROLL_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
