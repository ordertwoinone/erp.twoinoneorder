import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useCardSettlementsQuery, useDeliverySettlementsQuery, SETTLEMENTS_PAGE_SIZE } from '../hooks/useSettlements'
import { CardSettlementFormDialog } from '../components/CardSettlementFormDialog'
import { DeliverySettlementFormDialog } from '../components/DeliverySettlementFormDialog'

interface CardRow {
  id: string
  credit_date: string
  amount: number
  status: string
  card_machines: { machine_name: string } | null
}

interface DeliveryRow {
  id: string
  credit_date: string
  amount: number
  status: string
  restaurants: { name: string } | null
  delivery_platforms: { name: string } | null
}

export default function SettlementsListPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('settlements.manage')
  const [cardPage, setCardPage] = useState(0)
  const [deliveryPage, setDeliveryPage] = useState(0)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false)

  const { data: cardData, isLoading: cardLoading } = useCardSettlementsQuery(cardPage)
  const { data: deliveryData, isLoading: deliveryLoading } = useDeliverySettlementsQuery(deliveryPage)

  const cardColumns = useMemo<ColumnDef<CardRow>[]>(
    () => [
      { accessorKey: 'card_machines.machine_name', header: 'Machine', cell: ({ row }) => row.original.card_machines?.machine_name ?? '—' },
      { accessorKey: 'credit_date', header: 'Credit Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  const deliveryColumns = useMemo<ColumnDef<DeliveryRow>[]>(
    () => [
      { accessorKey: 'delivery_platforms.name', header: 'Platform', cell: ({ row }) => row.original.delivery_platforms?.name ?? '—' },
      { accessorKey: 'restaurants.name', header: 'Restaurant', cell: ({ row }) => row.original.restaurants?.name ?? '—' },
      { accessorKey: 'credit_date', header: 'Credit Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Settlements" description="Reconcile card machine and delivery platform bank credits against collections." />

      <Tabs defaultValue="card">
        <TabsList>
          <TabsTrigger value="card">Card Machines</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Platforms</TabsTrigger>
        </TabsList>

        <TabsContent value="card" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setCardDialogOpen(true)}>
                <Plus /> Record Settlement
              </Button>
            </div>
          )}
          <DataTable
            columns={cardColumns}
            data={cardData?.rows ?? []}
            isLoading={cardLoading}
            emptyMessage="No card settlements recorded yet."
            pagination={{
              pageIndex: cardPage,
              pageSize: SETTLEMENTS_PAGE_SIZE,
              totalCount: cardData?.totalCount ?? 0,
              onPageChange: setCardPage,
            }}
          />
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setDeliveryDialogOpen(true)}>
                <Plus /> Record Settlement
              </Button>
            </div>
          )}
          <DataTable
            columns={deliveryColumns}
            data={deliveryData?.rows ?? []}
            isLoading={deliveryLoading}
            emptyMessage="No delivery settlements recorded yet."
            pagination={{
              pageIndex: deliveryPage,
              pageSize: SETTLEMENTS_PAGE_SIZE,
              totalCount: deliveryData?.totalCount ?? 0,
              onPageChange: setDeliveryPage,
            }}
          />
        </TabsContent>
      </Tabs>

      <CardSettlementFormDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} />
      <DeliverySettlementFormDialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen} />
    </div>
  )
}
