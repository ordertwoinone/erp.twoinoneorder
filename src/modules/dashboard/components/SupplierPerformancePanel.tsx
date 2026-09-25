import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency } from '@/lib/utils/format'
import type { Database } from '@/types/database'

type SupplierPerf = Database['public']['Functions']['get_supplier_performance']['Returns'][number]

export function SupplierPerformancePanel({
  suppliers,
  isLoading,
  periodStart,
  periodEnd,
}: {
  suppliers: SupplierPerf[] | undefined
  isLoading: boolean
  periodStart: string
  periodEnd: string
}) {
  const navigate = useNavigate()
  const goToSupplierInvoices = (supplierId: string) =>
    navigate(`/purchases?supplier=${supplierId}&from=${periodStart}&to=${periodEnd}`)

  const volumeColumns = useMemo<ColumnDef<SupplierPerf>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        cell: ({ row }) => row.index + 1,
      },
      { accessorKey: 'supplier_name', header: 'Supplier' },
      {
        accessorKey: 'supplier_type',
        header: 'Type',
        cell: ({ getValue }) => {
          const value = getValue() as string | null
          return value ? <Badge variant="outline" className="capitalize">{value}</Badge> : '—'
        },
      },
      {
        accessorKey: 'purchase_volume',
        header: 'Purchase volume (AED)',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
    ],
    [],
  )

  const reliabilityColumns = useMemo<ColumnDef<SupplierPerf>[]>(
    () => [
      { accessorKey: 'supplier_name', header: 'Supplier' },
      {
        id: 'increases',
        header: 'Price hikes',
        cell: ({ row }) =>
          row.original.has_sufficient_data ? (
            <span className="text-destructive">
              {row.original.price_increase_count} · {formatCurrency(row.original.price_increase_value)}
            </span>
          ) : (
            <span className="text-muted-foreground">Insufficient data</span>
          ),
      },
      {
        id: 'decreases',
        header: 'Price decreases',
        cell: ({ row }) =>
          row.original.has_sufficient_data ? (
            <span className="text-success-foreground">
              {row.original.price_decrease_count} · {formatCurrency(row.original.price_decrease_value)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="volume">
          <TabsList>
            <TabsTrigger value="volume">Purchase volume</TabsTrigger>
            <TabsTrigger value="reliability">Price reliability</TabsTrigger>
          </TabsList>
          <TabsContent value="volume">
            <DataTable
              columns={volumeColumns}
              data={suppliers ?? []}
              isLoading={isLoading}
              emptyMessage="No purchases in this period."
              onRowClick={(row) => goToSupplierInvoices(row.supplier_id)}
            />
          </TabsContent>
          <TabsContent value="reliability">
            <DataTable
              columns={reliabilityColumns}
              data={suppliers ?? []}
              isLoading={isLoading}
              emptyMessage="No purchases in this period."
              onRowClick={(row) => goToSupplierInvoices(row.supplier_id)}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
