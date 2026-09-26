import { Link, useParams } from 'react-router-dom'
import { PackageCheck, Pencil, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { usePurchaseOrderQuery, usePlacePurchaseOrder, useCancelPurchaseOrder } from '../hooks/usePurchaseOrders'

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('purchase_orders.manage')
  const { data, isLoading } = usePurchaseOrderQuery(id)
  const placeOrder = usePlacePurchaseOrder()
  const cancelOrder = useCancelPurchaseOrder()

  if (isLoading || !data) return <FullScreenSpinner />

  const { order, items } = data
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase Order ${order.order_number}`}
        description={`${order.suppliers?.name ?? ''} · ${order.restaurants?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            {order.status === 'draft' && canManage && (
              <Button variant="outline" asChild>
                <Link to={`/purchases/orders/${order.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.products?.name}</TableCell>
                    <TableCell>{item.units?.code}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${item.quantity_received >= item.quantity ? 'text-success' : item.quantity_received > 0 ? 'text-warning-foreground' : 'text-muted-foreground'}`}
                    >
                      {item.quantity_received}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end text-base font-semibold">
              Total: <span className="ml-2 tabular-nums">{formatCurrency(total)}</span>
            </div>
            {order.notes && <p className="mt-4 text-sm text-muted-foreground">Notes: {order.notes}</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order date</span>
                <span className="font-medium">{formatDate(order.order_date)}</span>
              </div>
              {order.expected_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium">{formatDate(order.expected_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && (order.status === 'draft' || order.status === 'ordered' || order.status === 'partially_received') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.status === 'draft' && (
                  <Button className="w-full" onClick={() => placeOrder.mutate(order.id)} disabled={placeOrder.isPending}>
                    <Send /> Place order with supplier
                  </Button>
                )}
                {(order.status === 'ordered' || order.status === 'partially_received') && (
                  <Button className="w-full" variant="outline" asChild>
                    <Link to={`/purchases/receipts/new?fromOrder=${order.id}`}>
                      <PackageCheck /> Record goods receipt
                    </Link>
                  </Button>
                )}
                <ConfirmActionDialog
                  trigger={
                    <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                      <XCircle /> Cancel order
                    </Button>
                  }
                  title="Cancel this purchase order?"
                  description="The order will be marked cancelled. This cannot be undone from the UI."
                  confirmLabel="Cancel order"
                  destructive
                  onConfirm={() => cancelOrder.mutateAsync(order.id)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
