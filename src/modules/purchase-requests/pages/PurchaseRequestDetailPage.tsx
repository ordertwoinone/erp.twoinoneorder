import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ShoppingCart, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { useAuth } from '@/hooks/useAuth'
import { usePurchaseRequestQuery, useReviewPurchaseRequest } from '../hooks/usePurchaseRequests'

export default function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = usePurchaseRequestQuery(id)
  const review = useReviewPurchaseRequest(id!)

  if (isLoading || !data) return <FullScreenSpinner />

  const { request, items } = data
  const canReview = hasPermission('purchase_orders.manage')

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Request ${request.request_number}`}
        description={request.restaurants?.name}
        actions={<StatusBadge status={request.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.products?.name}</TableCell>
                    <TableCell>{item.units?.code}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {request.notes && <p className="mt-4 text-sm text-muted-foreground">Notes: {request.notes}</p>}
          </CardContent>
        </Card>

        {(request.status === 'requested' || request.status === 'under_review') && canReview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button onClick={() => review.mutate({ action: 'approve' })} disabled={review.isPending}>
                <CheckCircle2 /> Approve
              </Button>
              <Button variant="destructive" onClick={() => review.mutate({ action: 'reject' })} disabled={review.isPending}>
                <XCircle /> Reject
              </Button>
            </CardContent>
          </Card>
        )}

        {request.status === 'approved' && canReview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next step</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link to={`/purchases/orders/new?fromRequest=${request.id}`}>
                  <ShoppingCart /> Convert to purchase order
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
