import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import {
  useBankAccountsQuery,
  useBankReconciliationsQuery,
  useCreateBankReconciliation,
  useLedgerBalanceQuery,
} from '../hooks/useBankReconciliation'

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export function BankReconciliationPanel({ restaurantId }: { restaurantId: string | null }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('banking.manage')
  const { data: accounts } = useBankAccountsQuery(restaurantId)
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) setSelectedAccountId(accounts[0].id)
  }, [accounts, selectedAccountId])

  const { data: reconciliations, isLoading } = useBankReconciliationsQuery(selectedAccountId)

  if (!hasPermission('banking.view')) {
    return <p className="text-sm text-muted-foreground">You don't have permission to view bank reconciliation.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-64 space-y-2">
          <Label>Bank account</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.bank_name} — {a.account_name} ({a.restaurants?.name ?? 'All restaurants'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && selectedAccountId && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus /> New reconciliation
          </Button>
        )}
      </div>

      {!selectedAccountId ? (
        <p className="text-sm text-muted-foreground">No bank accounts set up yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Statement balance</TableHead>
                <TableHead className="text-right">Ledger balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !reconciliations || reconciliations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No reconciliations recorded for this account yet.
                  </TableCell>
                </TableRow>
              ) : (
                reconciliations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.statement_closing_balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.ledger_closing_balance)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${Math.abs(r.difference) > 0.01 ? 'font-medium text-destructive' : ''}`}
                    >
                      {formatCurrency(r.difference)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedAccountId && (
        <NewReconciliationDialog open={dialogOpen} onOpenChange={setDialogOpen} bankAccountId={selectedAccountId} />
      )}
    </div>
  )
}

function NewReconciliationDialog({
  open,
  onOpenChange,
  bankAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankAccountId: string
}) {
  const [periodStart, setPeriodStart] = useState(firstOfMonth())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [statementBalance, setStatementBalance] = useState('')
  const [markCompleted, setMarkCompleted] = useState(false)

  const { data: ledgerBalance, isLoading: isLedgerLoading } = useLedgerBalanceQuery(bankAccountId, periodEnd)
  const createReconciliation = useCreateBankReconciliation()

  const difference = statementBalance !== '' && ledgerBalance !== undefined ? Number(statementBalance) - ledgerBalance : null

  async function handleSave() {
    if (statementBalance === '' || ledgerBalance === undefined) return
    await createReconciliation.mutateAsync({
      bankAccountId,
      periodStart,
      periodEnd,
      statementClosingBalance: Number(statementBalance),
      ledgerClosingBalance: ledgerBalance,
      markCompleted,
    })
    onOpenChange(false)
    setStatementBalance('')
    setMarkCompleted(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bank reconciliation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period end</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Statement closing balance (AED)</Label>
            <Input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              placeholder="From your bank statement"
            />
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ledger closing balance</span>
              <span className="tabular-nums">{isLedgerLoading ? '…' : formatCurrency(ledgerBalance ?? 0)}</span>
            </div>
            {difference !== null && (
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Difference</span>
                <span className={`tabular-nums ${Math.abs(difference) > 0.01 ? 'font-medium text-destructive' : 'text-success-foreground'}`}>
                  {formatCurrency(difference)}
                </span>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={markCompleted} onCheckedChange={(c) => setMarkCompleted(!!c)} />
            Mark as completed
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={statementBalance === '' || createReconciliation.isPending}>
            {createReconciliation.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
