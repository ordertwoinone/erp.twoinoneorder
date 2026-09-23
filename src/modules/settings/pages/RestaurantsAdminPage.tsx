import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { useAllRestaurantsQuery } from '../hooks/useRestaurantAdmin'
import { RestaurantFormDialog } from '../components/RestaurantFormDialog'

interface RestaurantRow {
  id: string
  code: string
  name: string
  city: string | null
  is_head_office: boolean
  is_active: boolean
}

export default function RestaurantsAdminPage() {
  const { data: restaurants, isLoading } = useAllRestaurantsQuery()
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const columns = useMemo<ColumnDef<RestaurantRow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'city', header: 'City', cell: ({ getValue }) => (getValue() as string) || '—' },
      {
        accessorKey: 'is_head_office',
        header: 'Type',
        cell: ({ getValue }) => (getValue() ? <Badge variant="secondary">Head Office</Badge> : 'Restaurant'),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ getValue }) => <Badge variant={getValue() ? 'secondary' : 'outline'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description="Manage the restaurants and head office in this organization."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New Restaurant
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={restaurants ?? []}
        isLoading={isLoading}
        emptyMessage="No restaurants yet."
        onRowClick={(row) => setEditingId(row.id)}
      />

      <RestaurantFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RestaurantFormDialog
        restaurantId={editingId}
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
      />
    </div>
  )
}
