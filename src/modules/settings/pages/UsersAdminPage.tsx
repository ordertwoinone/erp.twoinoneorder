import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/tables/DataTable'
import { useProfilesQuery } from '../hooks/useUserAdmin'
import { UserAccessDialog } from '../components/UserAccessDialog'

interface ProfileRow {
  id: string
  full_name: string
  email: string
  status: 'active' | 'inactive' | 'suspended'
}

export default function UsersAdminPage() {
  const { data: profiles, isLoading } = useProfilesQuery()
  const [editing, setEditing] = useState<ProfileRow | undefined>(undefined)

  const columns = useMemo<ColumnDef<ProfileRow>[]>(
    () => [
      { accessorKey: 'full_name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string
          return <Badge variant={status === 'active' ? 'secondary' : 'outline'}>{status}</Badge>
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Assign roles and restaurant access to existing accounts." />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          New accounts are created via Supabase Auth (Dashboard → Authentication → Add User), not from this page — see
          README.md §3.3. Once an account exists, manage its role and restaurant access here.
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={profiles ?? []}
        isLoading={isLoading}
        emptyMessage="No users yet."
        onRowClick={(row) => setEditing(row)}
      />

      <UserAccessDialog profile={editing} open={!!editing} onOpenChange={(open) => !open && setEditing(undefined)} />
    </div>
  )
}
