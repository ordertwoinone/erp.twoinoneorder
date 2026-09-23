import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Pencil, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useExpenseQuery } from '../hooks/useExpenses'
import { useTransitionExpense } from '../hooks/useExpenseMutations'

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = useExpenseQuery(id)
  const transition = useTransitionExpense(id!)
  const [comment, setComment] = useState('')

  if (isLoading || !data) return <FullScreenSpinner />

  const { expense, approvals } = data
  const canCreate = hasPermission('expenses.manage')
  const canApprove = hasPermission('purchases.approve')
  const canPost = hasPermission('purchases.post')

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Expense ${expense.expense_number}`}
        description={expense.expense_categories?.name}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={expense.status} />
            {(expense.status === 'draft' || expense.status === 'rejected') && canCreate && (
              <Button variant="outline" asChild>
                <Link to={`/expenses/${expense.id}/edit`}>
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
              <Row label="Amount" value={<span className="font-semibold tabular-nums">{formatCurrency(expense.amount)}</span>} />
              <Row label="Date" value={formatDate(expense.expense_date)} />
              <Row label="Restaurant" value={expense.restaurants?.name ?? '—'} />
              {expense.notes && <Row label="Notes" value={expense.notes} />}
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
          {(expense.status === 'draft' ||
            expense.status === 'rejected' ||
            expense.status === 'pending_approval' ||
            expense.status === 'approved') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(expense.status === 'draft' || expense.status === 'rejected') && canCreate && (
                  <Button className="w-full" onClick={() => transition.mutate({ action: 'submit' })} disabled={transition.isPending}>
                    <Send /> Submit for approval
                  </Button>
                )}

                {expense.status === 'pending_approval' && canApprove && (
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

                {expense.status === 'approved' && canPost && (
                  <ConfirmActionDialog
                    trigger={
                      <Button className="w-full">
                        <ShieldCheck /> Post expense
                      </Button>
                    }
                    title="Post this expense?"
                    description="This creates the accounting entry for this expense."
                    confirmLabel="Post"
                    onConfirm={() => transition.mutateAsync({ action: 'post' })}
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
