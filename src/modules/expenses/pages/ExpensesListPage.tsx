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
import { useExpensesQuery, EXPENSES_PAGE_SIZE } from '../hooks/useExpenses'

interface ExpenseRow {
  id: string
  expense_number: string
  amount: number
  expense_date: string
  status: string
  expense_categories: { name: string } | null
}

export default function ExpensesListPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isLoading } = useExpensesQuery({ restaurantId: selectedRestaurantId, pageIndex })

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      { accessorKey: 'expense_number', header: 'Expense #' },
      {
        accessorKey: 'expense_categories.name',
        header: 'Category',
        cell: ({ row }) => row.original.expense_categories?.name ?? '—',
      },
      { accessorKey: 'expense_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
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
        title="Expenses"
        description="Operating expenses by restaurant and category."
        actions={
          hasPermission('expenses.manage') && (
            <Button asChild>
              <Link to="/expenses/new">
                <Plus /> New Expense
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No expenses yet."
        onRowClick={(row) => navigate(`/expenses/${row.id}`)}
        pagination={{
          pageIndex,
          pageSize: EXPENSES_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />
    </div>
  )
}
