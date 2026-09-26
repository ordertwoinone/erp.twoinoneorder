import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Pencil, Send, ShieldCheck, Undo2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { usePurchaseQuery } from '../hooks/usePurchases'
import { usePostPurchase, useTransitionPurchase } from '../hooks/usePurchaseMutations'

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = usePurchaseQuery(id)
  const transition = useTransitionPurchase(id!)
  const post = usePostPurchase(id!)
  const [comment, setComment] = useState('')

  if (isLoading || !data) return <FullScreenSpinner />

  const { purchase, items, approvals } = data
  const canCreate = hasPermission('purchases.create')
  const canApprove = hasPermission('purchases.approve')
  const canPost = hasPermission('purchases.post')

  const itemsAboveAgreed = items.filter(
    (item) => item.agreed_price_at_entry !== null && item.unit_price > item.agreed_price_at_entry * 1.005,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase ${purchase.purchase_number}`}
        description={`${purchase.suppliers?.name ?? ''} · ${purchase.restaurants?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={purchase.status} />
            {(purchase.status === 'draft' || purchase.status === 'returned') && canCreate && (
              <Button variant="outline" asChild>
                <Link to={`/purchases/${purchase.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              {itemsAboveAgreed.length > 0 && (
                <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-warning-foreground">
                    <AlertTriangle className="size-4" />
                    Price alert: {itemsAboveAgreed.length} item{itemsAboveAgreed.length === 1 ? '' : 's'} billed above the
                    agreed supplier price
                  </p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Agreed Price</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const agreed = item.agreed_price_at_entry
                    const variancePct = agreed && agreed > 0 ? ((item.unit_price - agreed) / agreed) * 100 : null
                    const isAbove = variancePct !== null && variancePct > 0.5
                    return (
                      <TableRow key={item.id} className={isAbove ? 'bg-warning/5' : undefined}>
                        <TableCell>
                          {item.products?.name}
                          {item.products?.brands?.name && (
                            <span className="ml-1 text-xs text-muted-foreground">({item.products.brands.name})</span>
                          )}
                        </TableCell>
                        <TableCell>{item.units?.code}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {agreed !== null ? formatCurrency(agreed) : 'No contract'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">
                          {variancePct !== null ? (
                            <Badge variant={isAbove ? 'warning' : 'success'} className="tabular-nums">
                              {variancePct >= 0 ? '↑' : '↓'} {Math.abs(variancePct).toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.discount_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.tax_amount)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(item.line_total)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(purchase.subtotal_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums">-{formatCurrency(purchase.discount_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(purchase.tax_amount)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(purchase.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval history</CardTitle>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {approvals.map((a) => (
                    <li key={a.id} className="flex items-start justify-between text-sm">
                      <div>
                        <span className="font-medium capitalize">{a.action}</span>
                        <span className="text-muted-foreground"> by {a.profiles?.full_name ?? 'Unknown'}</span>
                        {a.comment && <p className="text-muted-foreground">"{a.comment}"</p>}
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Invoice #" value={purchase.invoice_number} />
              <Row label="Invoice date" value={formatDate(purchase.invoice_date)} />
              {purchase.payment_terms_days != null && (
                <Row label="Payment terms" value={purchase.payment_terms_days === 0 ? 'On receipt' : `${purchase.payment_terms_days} days`} />
              )}
              <Row label="Source" value={purchase.source === 'ai_scan' ? 'AI Scan' : 'Manual'} />
              <Row label="Payment status" value={<StatusBadge status={purchase.payment_status} />} />
              {purchase.notes && <Row label="Notes" value={purchase.notes} />}
            </CardContent>
          </Card>

          {(purchase.status === 'draft' ||
            purchase.status === 'returned' ||
            purchase.status === 'pending_approval' ||
            purchase.status === 'approved') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(purchase.status === 'draft' || purchase.status === 'returned') && canCreate && (
                  <Button
                    className="w-full"
                    onClick={() => transition.mutate({ action: 'submit' })}
                    disabled={transition.isPending}
                  >
                    <Send /> Submit for approval
                  </Button>
                )}

                {purchase.status === 'pending_approval' && canApprove && (
                  <>
                    <Textarea
                      placeholder="Optional comment…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="default"
                        onClick={() => transition.mutate({ action: 'approve', comment })}
                        disabled={transition.isPending}
                      >
                        <CheckCircle2 /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => transition.mutate({ action: 'return', comment })}
                        disabled={transition.isPending}
                      >
                        <Undo2 /> Return
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => transition.mutate({ action: 'reject', comment })}
                        disabled={transition.isPending}
                      >
                        <XCircle /> Reject
                      </Button>
                    </div>
                  </>
                )}

                {purchase.status === 'approved' && canPost && (
                  <ConfirmActionDialog
                    trigger={
                      <Button className="w-full">
                        <ShieldCheck /> Post purchase
                      </Button>
                    }
                    title="Post this purchase?"
                    description="This will update stock levels and create accounting entries. This action cannot be undone from the UI."
                    confirmLabel="Post"
                    onConfirm={() => post.mutateAsync()}
                  />
                )}

                {(purchase.status === 'draft' ||
                  purchase.status === 'pending_approval' ||
                  purchase.status === 'returned') &&
                  (canCreate || canApprove) && (
                    <ConfirmActionDialog
                      trigger={
                        <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
                          Cancel purchase
                        </Button>
                      }
                      title="Cancel this purchase?"
                      description="The purchase will be marked cancelled and excluded from all financial calculations."
                      confirmLabel="Cancel purchase"
                      destructive
                      onConfirm={() => transition.mutateAsync({ action: 'cancel' })}
                    />
                  )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
