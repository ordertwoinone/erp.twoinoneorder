import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Pencil, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { usePaymentVoucherQuery, useUnpaidPurchasesQuery } from '../hooks/usePaymentVouchers'
import { usePostPaymentVoucher, useTransitionPaymentVoucher } from '../hooks/usePaymentMutations'

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = usePaymentVoucherQuery(id)
  const transition = useTransitionPaymentVoucher(id!)
  const [comment, setComment] = useState('')

  if (isLoading || !data) return <FullScreenSpinner />

  const { voucher, approvals } = data
  const canCreate = hasPermission('payments.create')
  const canApprove = hasPermission('payments.approve')
  const canPost = hasPermission('payments.post')

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payment ${voucher.voucher_number}`}
        description={voucher.payee_type === 'supplier' ? voucher.suppliers?.name ?? '' : 'Operating expense'}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={voucher.status} />
            {voucher.status === 'draft' && canCreate && (
              <Button variant="outline" asChild>
                <Link to={`/payments/${voucher.id}/edit`}>
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
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Amount" value={<span className="tabular-nums font-semibold">{formatCurrency(voucher.amount)}</span>} />
              <Row label="Payment method" value={voucher.payment_method === 'bank' ? 'Bank' : 'Cash'} />
              {voucher.payment_reference && <Row label="Reference" value={voucher.payment_reference} />}
              <Row label="Restaurant" value={voucher.restaurants?.name ?? '—'} />
              {voucher.notes && <Row label="Notes" value={voucher.notes} />}
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
          {(voucher.status === 'draft' || voucher.status === 'pending_approval' || voucher.status === 'approved') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {voucher.status === 'draft' && canCreate && (
                  <Button className="w-full" onClick={() => transition.mutate({ action: 'submit' })} disabled={transition.isPending}>
                    <Send /> Submit for approval
                  </Button>
                )}

                {voucher.status === 'pending_approval' && canApprove && (
                  <>
                    <Textarea placeholder="Optional comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => transition.mutate({ action: 'approve', comment })} disabled={transition.isPending}>
                        <CheckCircle2 /> Approve
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

                {voucher.status === 'approved' && canPost && <PostPaymentDialog voucherId={voucher.id} voucher={voucher} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function PostPaymentDialog({
  voucherId,
  voucher,
}: {
  voucherId: string
  voucher: { payee_type: string; supplier_id: string | null; restaurant_id: string; amount: number }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, number>>({})
  const { data: unpaidPurchases } = useUnpaidPurchasesQuery(voucher.supplier_id ?? undefined, voucher.restaurant_id)
  const post = usePostPaymentVoucher(voucherId)

  const allocatedTotal = useMemo(() => Object.values(selected).reduce((sum, v) => sum + (v || 0), 0), [selected])
  const remaining = voucher.amount - allocatedTotal

  async function handlePost() {
    const allocations = Object.entries(selected)
      .filter(([, amount]) => amount > 0)
      .map(([purchase_id, amount]) => ({ purchase_id, amount }))
    await post.mutateAsync(allocations)
    setOpen(false)
  }

  if (voucher.payee_type !== 'supplier') {
    return (
      <Button className="w-full" onClick={() => post.mutate([])} disabled={post.isPending}>
        <ShieldCheck /> Post payment
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <ShieldCheck /> Post payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate payment to invoices</DialogTitle>
          <DialogDescription>
            Voucher amount: {formatCurrency(voucher.amount)}. Leave invoices unselected to record this as an advance.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {!unpaidPurchases || unpaidPurchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unpaid posted invoices for this supplier.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="w-28 text-right">Allocate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidPurchases.map((p) => {
                  const outstanding = p.total_amount - p.paid_amount
                  const checked = selected[p.id] !== undefined
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = { ...prev }
                              if (v) next[p.id] = Math.min(outstanding, Math.max(0, remaining))
                              else delete next[p.id]
                              return next
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm">{p.invoice_number}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(outstanding)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8"
                          disabled={!checked}
                          value={selected[p.id] ?? 0}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [p.id]: Number(e.target.value) || 0 }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Allocated</span>
          <span className="tabular-nums">{formatCurrency(allocatedTotal)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium">
          <span>Unallocated (advance)</span>
          <span className="tabular-nums">{formatCurrency(Math.max(0, remaining))}</span>
        </div>

        <DialogFooter>
          <Button onClick={handlePost} disabled={post.isPending || allocatedTotal > voucher.amount}>
            Post payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
