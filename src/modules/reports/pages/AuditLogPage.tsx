import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { formatDateTime } from '@/lib/utils/format'
import { useAuditLogModulesQuery, useAuditLogQuery, AUDIT_LOG_PAGE_SIZE } from '../hooks/useAuditLog'

interface AuditLogRow {
  id: string
  action: string
  module: string
  entity_type: string
  entity_id: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
  profiles: { full_name: string } | null
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null)

  const { data: modules } = useAuditLogModulesQuery()
  const { data, isLoading } = useAuditLogQuery({ search, module, pageIndex })

  const columns = useMemo<ColumnDef<AuditLogRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'When', cell: ({ getValue }) => formatDateTime(getValue() as string) },
      { accessorKey: 'profiles.full_name', header: 'Who', cell: ({ row }) => row.original.profiles?.full_name ?? 'System' },
      {
        accessorKey: 'module',
        header: 'Module',
        cell: ({ getValue }) => <Badge variant="outline" className="capitalize">{(getValue() as string).replace(/_/g, ' ')}</Badge>,
      },
      { accessorKey: 'action', header: 'Action', cell: ({ getValue }) => (getValue() as string).replace(/_/g, ' ') },
      { accessorKey: 'entity_type', header: 'Entity', cell: ({ getValue }) => (getValue() as string).replace(/_/g, ' ') },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Every creation, edit, approval, posting, payment and reversal across the system." />

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by action or entity…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPageIndex(0)
            }}
          />
        </div>
        <Select
          value={module}
          onValueChange={(v) => {
            setModule(v)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules?.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {m.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No audit events yet."
        onRowClick={(row) => setSelectedRow(row)}
        pagination={{
          pageIndex,
          pageSize: AUDIT_LOG_PAGE_SIZE,
          totalCount: data?.totalCount ?? 0,
          onPageChange: setPageIndex,
        }}
      />

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.action.replace(/_/g, ' ')} — {selectedRow?.entity_type.replace(/_/g, ' ')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Before</p>
              <pre className="max-h-80 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                {selectedRow?.old_value ? JSON.stringify(selectedRow.old_value, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">After</p>
              <pre className="max-h-80 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                {selectedRow?.new_value ? JSON.stringify(selectedRow.new_value, null, 2) : '—'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
