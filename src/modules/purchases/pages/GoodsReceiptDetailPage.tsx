import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { formatDate } from '@/lib/utils/format'
import { useGoodsReceiptQuery } from '../hooks/useGoodsReceipts'

export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useGoodsReceiptQuery(id)

  if (isLoading || !data) return <FullScreenSpinner />

  const { receipt, items } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Goods Receipt ${receipt.receipt_number}`}
        description={[receipt.restaurants?.name, receipt.purchase_orders?.order_number].filter(Boolean).join(' · ')}
        actions={<StatusBadge status={receipt.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items received</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Shortage</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.products?.name}</TableCell>
                  <TableCell>{item.units?.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity_received}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${item.quantity_shortage > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
                  >
                    {item.quantity_shortage}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>Received {formatDate(receipt.received_date)}</span>
          </div>
          {receipt.notes && <p className="mt-2 text-sm text-muted-foreground">Notes: {receipt.notes}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
