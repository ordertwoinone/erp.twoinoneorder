import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/format'
import type { BranchPnl } from '../hooks/useDashboardData'

export function BranchPnlChart({ branches, isLoading }: { branches: BranchPnl[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (branches.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No branch data for this period.</p>
  }

  const sorted = [...branches].sort((a, b) => (b.netProfit ?? 0) - (a.netProfit ?? 0))
  const anyProvisional = sorted.some((b) => b.isProvisional)

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(220, sorted.length * 36)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="restaurantName" width={120} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, _name, item) => {
              const amount = Number(value)
              const isProvisional = (item.payload as BranchPnl).isProvisional
              return [isProvisional ? `${formatCurrency(amount)} (provisional)` : formatCurrency(amount), 'Net profit']
            }}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <Bar dataKey="netProfit" radius={[0, 4, 4, 0]}>
            {sorted.map((branch) => (
              <Cell
                key={branch.restaurantId}
                fill={(branch.netProfit ?? 0) >= 0 ? 'var(--chart-2)' : 'var(--chart-4)'}
                fillOpacity={branch.isProvisional ? 0.5 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {anyProvisional && (
        <p className="mt-2 text-xs text-muted-foreground">
          Lighter bars are provisional — opening/closing stock hasn't been entered for that branch this period.
        </p>
      )}
    </div>
  )
}
