import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Copy, PackageX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Database } from '@/types/database'

type ExceptionRow = Database['public']['Functions']['get_dashboard_exceptions']['Returns'][number]

const EXCEPTION_META = {
  price_above_contract: { label: 'Price above contract', icon: AlertTriangle, className: 'text-warning-foreground' },
  missing_goods_receipt: { label: 'Missing goods receipt', icon: PackageX, className: 'text-warning-foreground' },
  duplicate_invoice: { label: 'Possible duplicate invoice', icon: Copy, className: 'text-destructive' },
} as const

export function ExceptionQueue({ exceptions, isLoading }: { exceptions: ExceptionRow[] | undefined; isLoading: boolean }) {
  const navigate = useNavigate()

  const columns = useMemo<ColumnDef<ExceptionRow>[]>(
    () => [
      { accessorKey: 'invoice_number', header: 'Invoice No.' },
      { accessorKey: 'invoice_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
      { accessorKey: 'restaurant_name', header: 'Restaurant' },
      { accessorKey: 'supplier_name', header: 'Supplier' },
      {
        accessorKey: 'exception_type',
        header: 'Exception',
        cell: ({ row }) => {
          const meta = EXCEPTION_META[row.original.exception_type]
          const Icon = meta.icon
          return (
            <span className={`inline-flex items-center gap-1.5 text-sm ${meta.className}`}>
              <Icon className="size-3.5" />
              {meta.label}
              {row.original.variance_pct !== null && (
                <Badge variant="warning" className="ml-1">
                  +{row.original.variance_pct}%
                </Badge>
              )}
            </span>
          )
        },
      },
      {
        accessorKey: 'total_amount',
        header: 'Amount (AED)',
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as number)}</span>,
      },
      { accessorKey: 'owner_name', header: 'Owner', cell: ({ getValue }) => (getValue() as string) ?? '—' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          Approval &amp; exception queue
          {exceptions && exceptions.length > 0 && <Badge variant="destructive">{exceptions.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={exceptions ?? []}
          isLoading={isLoading}
          emptyMessage="No exceptions in this period."
          onRowClick={(row) => navigate(`/purchases/${row.purchase_id}`)}
        />
      </CardContent>
    </Card>
  )
}
