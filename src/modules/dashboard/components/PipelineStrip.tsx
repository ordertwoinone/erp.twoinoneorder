import { ChevronRight, ClipboardList, PackageCheck, Receipt, RefreshCw, ShoppingCart, UserCheck, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { Database } from '@/types/database'

type PipelineCounts = Database['public']['Functions']['get_dashboard_pipeline_counts']['Returns'][number]

interface Stage {
  key: keyof PipelineCounts
  label: string
  icon: LucideIcon
  to: string
  permission?: string
  highlightWhenPositive?: boolean
}

const STAGES: Stage[] = [
  { key: 'request_count', label: 'Request', icon: ClipboardList, to: '/purchases/requests' },
  { key: 'order_count', label: 'Order', icon: ShoppingCart, to: '/purchases/orders', permission: 'purchase_orders.manage' },
  { key: 'receive_count', label: 'Receive', icon: PackageCheck, to: '/purchases/receipts' },
  { key: 'invoice_count', label: 'Invoice', icon: Receipt, to: '/purchases' },
  {
    key: 'approve_awaiting_count',
    label: 'Approve',
    icon: UserCheck,
    to: '/purchases?status=pending_approval',
    permission: 'purchases.approve',
    highlightWhenPositive: true,
  },
  { key: 'pay_awaiting_count', label: 'Pay', icon: Wallet, to: '/purchases?payment=unpaid', permission: 'payments.create' },
  { key: 'reconcile_count', label: 'Reconcile', icon: RefreshCw, to: '/accounting', permission: 'banking.view' },
]

export function PipelineStrip({ counts, isLoading }: { counts: PipelineCounts | null | undefined; isLoading: boolean }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const visibleStages = STAGES.filter((stage) => !stage.permission || hasPermission(stage.permission))

  return (
    <Card className="flex flex-row flex-wrap gap-0 divide-x overflow-hidden p-0">
      {visibleStages.map((stage, index) => {
        const value = counts ? counts[stage.key] : null
        const isAwaiting = stage.highlightWhenPositive && typeof value === 'number' && value > 0
        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => navigate(stage.to)}
            className={cn(
              'group flex min-w-32 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
              isAwaiting && 'bg-warning/10',
            )}
          >
            <stage.icon className={cn('size-5 text-muted-foreground', isAwaiting && 'text-warning-foreground')} />
            <div className="flex-1">
              {isLoading || value === undefined ? (
                <Skeleton className="h-6 w-10" />
              ) : (
                <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {stage.label}
                {isAwaiting && <span className="ml-1 text-warning-foreground">· Awaiting</span>}
              </div>
            </div>
            {index < visibleStages.length - 1 && (
              <ChevronRight className="hidden size-4 text-muted-foreground/40 sm:block" />
            )}
          </button>
        )
      })}
    </Card>
  )
}
