import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Send, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useBankAccountsOptions, useCashAccountsOptions } from '@/hooks/useAccountOptions'
import { useSalaryEntryQuery } from '../hooks/useSalaryEntries'
import { usePostSalaryPayment, useTransitionSalaryEntry } from '../hooks/useSalaryMutations'

export default function SalaryEntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { data, isLoading } = useSalaryEntryQuery(id)
  const transition = useTransitionSalaryEntry(id!)

  if (isLoading || !data) return <FullScreenSpinner />

  const { entry, payments } = data
  const canManage = hasPermission('payroll.manage')
  const canApprove = hasPermission('purchases.approve')
  const canPost = hasPermission('purchases.post')
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = entry.net_salary - totalPaid

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Salary — ${entry.employees?.full_name}`}
        description={new Date(entry.period_month).toLocaleDateString('en-AE', { year: 'numeric', month: 'long' })}
        actions={<StatusBadge status={entry.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Basic salary" value={formatCurrency(entry.basic_salary)} />
              <Row label="Allowances" value={formatCurrency(entry.allowances_total)} />
              <Row label="Overtime" value={formatCurrency(entry.overtime_amount)} />
              <Row label="Deductions" value={`-${formatCurrency(entry.deductions_total)}`} />
              <Row label="Advances deducted" value={`-${formatCurrency(entry.advances_deducted)}`} />
              <Row label="Net salary" value={<span className="text-base font-semibold">{formatCurrency(entry.net_salary)}</span>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span>{formatDate(p.payment_date)} — {p.payment_method}</span>
                      <span className="tabular-nums font-medium">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {entry.status === 'posted' && (
                <p className="mt-3 text-sm text-muted-foreground">Remaining: {formatCurrency(Math.max(0, remaining))}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(entry.status === 'draft' || entry.status === 'pending_approval' || entry.status === 'approved' || entry.status === 'posted') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.status === 'draft' && canManage && (
                  <Button className="w-full" onClick={() => transition.mutate('submit')} disabled={transition.isPending}>
                    <Send /> Submit for approval
                  </Button>
                )}
                {entry.status === 'pending_approval' && canApprove && (
                  <Button className="w-full" onClick={() => transition.mutate('approve')} disabled={transition.isPending}>
                    <CheckCircle2 /> Approve
                  </Button>
                )}
                {entry.status === 'approved' && canPost && (
                  <ConfirmActionDialog
                    trigger={
                      <Button className="w-full">
                        <ShieldCheck /> Post
                      </Button>
                    }
                    title="Post this salary entry?"
                    description="This creates the accounting entry. Payment can be recorded separately once posted."
                    confirmLabel="Post"
                    onConfirm={() => transition.mutateAsync('post')}
                  />
                )}
                {entry.status === 'posted' && remaining > 0 && canManage && (
                  <RecordPaymentDialog entryId={entry.id} restaurantId={entry.restaurant_id} maxAmount={remaining} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function RecordPaymentDialog({ entryId, restaurantId, maxAmount }: { entryId: string; restaurantId: string; maxAmount: number }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(maxAmount)
  const [method, setMethod] = useState<'bank' | 'cash'>('bank')
  const [accountId, setAccountId] = useState('')
  const { data: bankAccounts } = useBankAccountsOptions(restaurantId)
  const { data: cashAccounts } = useCashAccountsOptions(restaurantId)
  const postPayment = usePostSalaryPayment(entryId)

  async function handleSubmit() {
    await postPayment.mutateAsync({
      amount,
      paymentMethod: method,
      bankAccountId: method === 'bank' ? accountId : undefined,
      cashAccountId: method === 'cash' ? accountId : undefined,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Wallet /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record salary payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as 'bank' | 'cash')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(method === 'bank' ? bankAccounts : cashAccounts)?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {'bank_name' in a ? `${a.bank_name} — ${a.account_name}` : a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={postPayment.isPending || !accountId || amount <= 0}>
            Record payment
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
