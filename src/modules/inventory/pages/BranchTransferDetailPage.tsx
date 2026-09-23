import { useParams } from 'react-router-dom'
import { PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { useAuth } from '@/hooks/useAuth'
import { useBranchTransferQuery, useReceiveBranchTransfer } from '../hooks/useInventory'

export default function BranchTransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = useBranchTransferQuery(id)
  const receive = useReceiveBranchTransfer(id!)

  if (isLoading || !data) return <FullScreenSpinner />

  const { transfer, items } = data
  const canManage = hasPermission('inventory.manage')

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Transfer ${transfer.transfer_number}`}
        description={`${transfer.from?.name ?? ''} → ${transfer.to?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={transfer.status} />
            {transfer.status === 'dispatched' && canManage && (
              <ConfirmActionDialog
                trigger={
                  <Button>
                    <PackageCheck /> Confirm receipt
                  </Button>
                }
                title="Confirm receipt of this transfer?"
                description="This adds the items to the destination restaurant's stock."
                confirmLabel="Confirm receipt"
                onConfirm={() => receive.mutateAsync()}
              />
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell>{item.units?.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.unit_cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {transfer.notes && <p className="mt-4 text-sm text-muted-foreground">Notes: {transfer.notes}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
