import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils/format'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { usePnlReportQuery } from '../hooks/usePnlReport'

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const { data: restaurants } = useRestaurantsQuery()
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [periodStart, setPeriodStart] = useState(firstOfMonth())
  const [periodEnd, setPeriodEnd] = useState(today())

  const effectiveRestaurantId = useMemo(() => restaurantId || restaurants?.[0]?.id || null, [restaurantId, restaurants])
  const { data: pnl, isLoading } = usePnlReportQuery(effectiveRestaurantId, periodStart, periodEnd)

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Profit & Loss by restaurant and period." />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Restaurant</Label>
            <Select value={effectiveRestaurantId ?? ''} onValueChange={setRestaurantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pnl ? (
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pnl.is_provisional && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Provisional P&L</AlertTitle>
                <AlertDescription>
                  Opening and/or closing stock hasn't been entered for this period, so Cost of Goods Consumed, Gross
                  Profit and Net Profit cannot be calculated yet.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1 text-sm">
              <Line label="Net Sales" value={pnl.net_sales} />
              <div className="pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cost of Goods Consumed
              </div>
              <Line label="Opening Stock" value={pnl.opening_stock_value} indent />
              <Line label="+ Purchases" value={pnl.purchases_value} indent />
              <Line label="± Transfers" value={pnl.transfers_net} indent />
              <Line label="- Closing Stock" value={pnl.closing_stock_value} indent negative />
              <Line label="= Cost of Goods Consumed" value={pnl.cogs} bold />
              <Line label="Gross Profit" value={pnl.gross_profit} bold className="border-t pt-2" />
              <div className="pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Expenses</div>
              <Line label="Salaries & Manpower" value={pnl.salaries_total} indent negative />
              <Line label="Operating Expenses" value={pnl.opex_total} indent negative />
              <Line label="Card Fees" value={pnl.card_fees} indent negative />
              <Line label="Delivery Commissions" value={pnl.delivery_commissions} indent negative />
              <Line label="Net Profit" value={pnl.net_profit} bold className="border-t pt-2 text-base" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Line({
  label,
  value,
  indent,
  bold,
  negative,
  className,
}: {
  label: string
  value: number | null
  indent?: boolean
  bold?: boolean
  negative?: boolean
  className?: string
}) {
  return (
    <div className={`flex justify-between ${indent ? 'pl-4 text-muted-foreground' : ''} ${bold ? 'font-semibold' : ''} ${className ?? ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value === null ? '—' : negative ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}</span>
    </div>
  )
}
