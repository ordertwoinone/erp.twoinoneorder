import { useMemo, useState } from 'react'
import { Lock, LockOpen, Save } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useExchangeRatesQuery, useSetExchangeRate } from '@/hooks/useExchangeRates'
import { CURRENCY_OPTIONS } from '@/schemas/supplier'
import {
  useAccountingAccountsQuery,
  useAccountingPeriodsQuery,
  useJournalEntriesQuery,
  useJournalEntryLinesQuery,
  useSetAccountingPeriodStatus,
  JOURNAL_PAGE_SIZE,
} from '../hooks/useAccounting'

interface JournalRow {
  id: string
  entry_number: string
  entry_date: string
  source_type: string
  description: string | null
  status: string
}

interface AccountRow {
  id: string
  code: string
  name: string
  account_type: string
}

export default function AccountingPage() {
  const { hasPermission } = useAuth()
  const { selectedRestaurantId } = useRestaurantScope()
  const [journalPage, setJournalPage] = useState(0)
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>(undefined)

  const { data: journalData, isLoading: journalLoading } = useJournalEntriesQuery({
    restaurantId: selectedRestaurantId,
    pageIndex: journalPage,
  })
  const { data: accounts, isLoading: accountsLoading } = useAccountingAccountsQuery()
  const { data: periods } = useAccountingPeriodsQuery(selectedRestaurantId)
  const setPeriodStatus = useSetAccountingPeriodStatus()
  const canManage = hasPermission('accounting.manage')

  const journalColumns = useMemo<ColumnDef<JournalRow>[]>(
    () => [
      { accessorKey: 'entry_number', header: 'Entry #' },
      { accessorKey: 'entry_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'source_type', header: 'Source', cell: ({ getValue }) => (getValue() as string).replace(/_/g, ' ') },
      { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => (getValue() as string) || '—' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  const accountColumns = useMemo<ColumnDef<AccountRow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'account_type', header: 'Type', cell: ({ getValue }) => <Badge variant="outline" className="capitalize">{getValue() as string}</Badge> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" description="Journal, chart of accounts and period locking." />

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="exchange-rates">Exchange Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <DataTable
            columns={journalColumns}
            data={journalData?.rows ?? []}
            isLoading={journalLoading}
            emptyMessage="No journal entries yet."
            onRowClick={(row) => setSelectedEntryId(row.id)}
            pagination={{
              pageIndex: journalPage,
              pageSize: JOURNAL_PAGE_SIZE,
              totalCount: journalData?.totalCount ?? 0,
              onPageChange: setJournalPage,
            }}
          />
        </TabsContent>

        <TabsContent value="accounts">
          <DataTable columns={accountColumns} data={accounts ?? []} isLoading={accountsLoading} emptyMessage="No accounts." />
        </TabsContent>

        <TabsContent value="periods" className="space-y-3">
          {!selectedRestaurantId ? (
            <p className="text-sm text-muted-foreground">Select a specific restaurant to manage its periods.</p>
          ) : (
            <div className="space-y-2">
              {periods?.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">
                      {new Date(p.period_month).toLocaleDateString('en-AE', { year: 'numeric', month: 'long' })}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                  {canManage && (
                    <ConfirmActionDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          {p.status === 'open' ? <><Lock /> Lock</> : <><LockOpen /> Unlock</>}
                        </Button>
                      }
                      title={p.status === 'open' ? 'Lock this period?' : 'Unlock this period?'}
                      description={
                        p.status === 'open'
                          ? 'Normal users will no longer be able to post transactions dated in this period.'
                          : 'This reopens the period for normal posting.'
                      }
                      confirmLabel={p.status === 'open' ? 'Lock period' : 'Unlock period'}
                      onConfirm={() =>
                        setPeriodStatus.mutateAsync({
                          restaurantId: selectedRestaurantId,
                          periodMonth: p.period_month,
                          status: p.status === 'open' ? 'locked' : 'open',
                        })
                      }
                    />
                  )}
                </div>
              ))}
              {(!periods || periods.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No periods yet — they're created automatically the first time you lock a month.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exchange-rates">
          <ExchangeRatesPanel canManage={canManage} />
        </TabsContent>
      </Tabs>

      <JournalEntryDialog entryId={selectedEntryId} onOpenChange={(open) => !open && setSelectedEntryId(undefined)} />
    </div>
  )
}

function ExchangeRatesPanel({ canManage }: { canManage: boolean }) {
  const { data: rates, isLoading } = useExchangeRatesQuery()
  const setRate = useSetExchangeRate()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (isLoading) return <FullScreenSpinner />

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground">
        AED is the base currency every accounting figure and report is shown in. Currencies with no rate set here
        show as "rate not set" wherever they'd otherwise need converting — never a guessed number.
      </p>
      {CURRENCY_OPTIONS.map((code) => {
        const existing = rates?.find((r) => r.currency_code === code)
        const isAed = code === 'AED'
        return (
          <div key={code} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="font-medium">{code}</p>
              {existing ? (
                <p className="text-xs text-muted-foreground">
                  1 {code} = {existing.rate_to_aed} AED · updated {formatDateTime(existing.updated_at)}
                </p>
              ) : (
                <p className="text-xs text-destructive">No rate set</p>
              )}
            </div>
            {canManage && !isAed && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.000001"
                  className="h-8 w-32"
                  placeholder={existing ? String(existing.rate_to_aed) : '1 unit = ? AED'}
                  value={drafts[code] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [code]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!drafts[code] || setRate.isPending}
                  onClick={() => {
                    const value = Number(drafts[code])
                    if (value > 0) setRate.mutate({ currencyCode: code, rateToAed: value })
                  }}
                >
                  <Save />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function JournalEntryDialog({ entryId, onOpenChange }: { entryId: string | undefined; onOpenChange: (open: boolean) => void }) {
  const { data: lines, isLoading } = useJournalEntryLinesQuery(entryId)

  return (
    <Dialog open={!!entryId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Journal Entry Lines</DialogTitle>
        </DialogHeader>
        {isLoading || !lines ? (
          <FullScreenSpinner />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.accounting_accounts?.code} — {line.accounting_accounts?.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
