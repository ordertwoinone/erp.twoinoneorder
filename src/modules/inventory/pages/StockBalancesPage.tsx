import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useStockBalancesQuery } from '../hooks/useInventory'

interface BalanceRow {
  product_id: string
  quantity_on_hand: number
  average_cost: number
  products: { name: string; sku: string | null } | null
}

export default function StockBalancesPage() {
  const { selectedRestaurantId, canSwitchRestaurants } = useRestaurantScope()
  const { data, isLoading } = useStockBalancesQuery(selectedRestaurantId)

  const columns = useMemo<ColumnDef<BalanceRow>[]>(
    () => [
      { accessorKey: 'products.name', header: 'Product', cell: ({ row }) => row.original.products?.name ?? '—' },
      { accessorKey: 'products.sku', header: 'SKU', cell: ({ row }) => row.original.products?.sku ?? '—' },
      {
        accessorKey: 'quantity_on_hand',
        header: 'Qty on Hand',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
      },
      {
        accessorKey: 'average_cost',
        header: 'Avg Cost',
        cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number).toFixed(2)}</span>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Current stock balances and branch transfers."
        actions={
          <Button asChild variant="outline">
            <Link to="/inventory/transfers">
              <ArrowLeftRight /> Branch Transfers
            </Link>
          </Button>
        }
      />

      {!selectedRestaurantId && canSwitchRestaurants ? (
        <p className="text-sm text-muted-foreground">Select a specific restaurant to view its stock balances.</p>
      ) : (
        <DataTable columns={columns} data={data ?? []} isLoading={isLoading} emptyMessage="No stock recorded yet." />
      )}
    </div>
  )
}
