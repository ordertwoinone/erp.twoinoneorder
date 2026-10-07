import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useStockBalancesQuery } from '../hooks/useInventory'
import { InventoryRibbon } from '../components/InventoryRibbon'

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
    <div className="space-y-4">
      <InventoryRibbon />
      <PageHeader title="Stock Balances" description="Quantity on hand and average cost per item at the selected location." />

      {!selectedRestaurantId && canSwitchRestaurants ? (
        <p className="text-sm text-muted-foreground">Select a specific restaurant to view its stock balances.</p>
      ) : (
        <DataTable columns={columns} data={data ?? []} isLoading={isLoading} emptyMessage="No stock recorded yet." />
      )}
    </div>
  )
}
