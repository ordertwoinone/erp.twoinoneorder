import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-warning/15 text-warning-foreground border-warning/30',
  submitted: 'bg-warning/15 text-warning-foreground border-warning/30',
  returned: 'bg-warning/15 text-warning-foreground border-warning/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  approved: 'bg-chart-2/15 text-foreground border-chart-2/30',
  posted: 'bg-success/15 text-success border-success/30',
  paid: 'bg-success/15 text-success border-success/30',
  partially_paid: 'bg-warning/15 text-warning-foreground border-warning/30',
  unpaid: 'bg-muted text-muted-foreground',
  active: 'bg-success/15 text-success border-success/30',
  inactive: 'bg-muted text-muted-foreground',
  open: 'bg-chart-2/15 text-foreground border-chart-2/30',
  locked: 'bg-destructive/10 text-destructive border-destructive/30',
  matched: 'bg-success/15 text-success border-success/30',
  unmatched: 'bg-warning/15 text-warning-foreground border-warning/30',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground')}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}
