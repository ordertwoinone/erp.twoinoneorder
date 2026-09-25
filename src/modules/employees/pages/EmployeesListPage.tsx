import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ScanLine, Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/utils/format'
import { useEmployeesQuery, EMPLOYEES_PAGE_SIZE } from '../hooks/useEmployees'
import { EmployeeFormDialog } from '../components/EmployeeFormDialog'

interface EmployeeRow {
  id: string
  employee_code: string
  full_name: string
  job_title: string | null
  employment_status: string
  labour_person_number: string | null
  labour_fine_amount: number | null
  restaurants: { name: string } | null
}

export default function EmployeesListPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('employees.manage')
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useEmployeesQuery({ search, pageIndex })

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      { accessorKey: 'employee_code', header: 'Code' },
      { accessorKey: 'full_name', header: 'Name' },
      { accessorKey: 'job_title', header: 'Job Title', cell: ({ getValue }) => (getValue() as string) || '—' },
      {
        accessorKey: 'restaurants.name',
        header: 'Restaurant',
        cell: ({ row }) => row.original.restaurants?.name ?? '—',
      },
      {
        accessorKey: 'labour_person_number',
        header: 'Labour list no.',
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        accessorKey: 'labour_fine_amount',
        header: 'Labour fine',
        cell: ({ getValue }) => {
          const fine = getValue() as number | null
          return fine ? <span className="font-medium text-destructive tabular-nums">{formatCurrency(fine)}</span> : '—'
        },
      },
      {
        accessorKey: 'employment_status',
        header: 'Status',
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Central employee register across all restaurants."
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/employees/scan">
                  <ScanLine /> Scan Labour List
                </Link>
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New Employee
              </Button>
            </div>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or code…"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPageIndex(0)
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No employees yet."
        onRowClick={canManage ? (row) => setEditingId(row.id) : undefined}
        pagination={{
          pageIndex,
          pageSize: EMPLOYEES_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />

      <EmployeeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EmployeeFormDialog
        employeeId={editingId}
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
      />
    </div>
  )
}
