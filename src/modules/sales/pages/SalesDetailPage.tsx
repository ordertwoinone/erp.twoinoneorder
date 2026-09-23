import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Pencil, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useSalesEntryQuery } from '../hooks/useSalesEntries'
import { useTransitionSalesEntry } from '../hooks/useSalesMutations'

export default function SalesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = useSalesEntryQuery(id)
  const transition = useTransitionSalesEntry(id!)

  if (isLoading || !data) return <FullScreenSpinner />

  const { entry, breakdowns } = data
  const canCreate = hasPermission('sales.create')
  const canReview = hasPermission('sales.review')
  const breakdownTotal = breakdowns.reduce((sum, b) => sum + b.amount, 0)
  const discrepancy = Math.round((entry.net_sales - breakdownTotal) * 100) / 100

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Sales — ${formatDate(entry.business_date)}`}
        description={entry.shift.replace('_', ' ')}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            {(entry.status === 'draft' || entry.status === 'submitted') && canCreate && (
              <Button variant="outline" asChild>
                <Link to={`/sales/${entry.id}/edit`}>
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
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Gross" value={formatCurrency(entry.gross_sales)} />
              <Stat label="Discounts" value={formatCurrency(entry.discounts)} />
              <Stat label="Refunds" value={formatCurrency(entry.refunds)} />
              <Stat label="Net Sales" value={formatCurrency(entry.net_sales)} emphasize />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdowns.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.sales_channels?.name ?? '—'}</TableCell>
                      <TableCell>{b.payment_methods?.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(b.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {discrepancy !== 0 && (
                <p className="mt-3 text-sm text-destructive">
                  Breakdown doesn't match net sales — difference of {formatCurrency(Math.abs(discrepancy))}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(entry.status === 'draft' || entry.status === 'submitted' || entry.status === 'reviewed') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.status === 'draft' && canCreate && (
                  <Button className="w-full" onClick={() => transition.mutate('submit')} disabled={transition.isPending}>
                    <Send /> Submit
                  </Button>
                )}
                {entry.status === 'submitted' && canReview && (
                  <Button className="w-full" onClick={() => transition.mutate('review')} disabled={transition.isPending}>
                    <CheckCircle2 /> Mark reviewed
                  </Button>
                )}
                {entry.status === 'reviewed' && canReview && (
                  <ConfirmActionDialog
                    trigger={
                      <Button className="w-full">
                        <ShieldCheck /> Post
                      </Button>
                    }
                    title="Post this sales entry?"
                    description="This finalizes the entry for reporting. It should only be posted once reconciled."
                    confirmLabel="Post"
                    onConfirm={() => transition.mutateAsync('post')}
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

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={emphasize ? 'text-lg font-semibold tabular-nums' : 'font-medium tabular-nums'}>{value}</p>
    </div>
  )
}
