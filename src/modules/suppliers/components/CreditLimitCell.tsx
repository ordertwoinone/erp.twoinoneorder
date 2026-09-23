import { useAedEquivalent } from '@/hooks/useExchangeRates'
import { formatCurrency } from '@/lib/utils/format'

export function CreditLimitCell({ amount, currency }: { amount: number | null; currency: string | null }) {
  const aedEquivalent = useAedEquivalent(amount, currency)

  if (amount == null || !currency) return <span className="text-muted-foreground">—</span>

  return (
    <div className="text-right tabular-nums">
      <div>
        {amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })} {currency}
      </div>
      {currency !== 'AED' && (
        <div className="text-xs text-muted-foreground">
          {aedEquivalent !== null ? `≈ ${formatCurrency(aedEquivalent)}` : 'rate not set'}
        </div>
      )}
    </div>
  )
}
