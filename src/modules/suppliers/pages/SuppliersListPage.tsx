import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { useAuth } from '@/hooks/useAuth'
import { useSuppliersQuery, SUPPLIERS_PAGE_SIZE } from '../hooks/useSuppliers'
import { SupplierFormDialog } from '../components/SupplierFormDialog'

interface SupplierRow {
  id: string
  code: string
  name: string
  trn: string | null
  payment_terms_days: number
  is_active: boolean
}

export default function SuppliersListPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('suppliers.manage')
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useSuppliersQuery({ search, pageIndex })

  const columns = useMemo<ColumnDef<SupplierRow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'trn', header: 'TRN', cell: ({ getValue }) => (getValue() as string) || '—' },
      {
        accessorKey: 'payment_terms_days',
        header: 'Payment Terms',
        cell: ({ getValue }) => `${getValue()} days`,
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ getValue }) => (
          <Badge variant={getValue() ? 'secondary' : 'outline'}>{getValue() ? 'Active' : 'Inactive'}</Badge>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage supplier records, contacts and payment terms."
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New Supplier
            </Button>
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
        emptyMessage="No suppliers yet."
        onRowClick={canManage ? (row) => setEditingId(row.id) : undefined}
        pagination={{
          pageIndex,
          pageSize: SUPPLIERS_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />

      <SupplierFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SupplierFormDialog
        supplierId={editingId}
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
      />
    </div>
  )
}
