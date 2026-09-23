import { Building2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'

export default function DashboardPage() {
  const { appContext } = useAuth()
  const { data: restaurants, isLoading } = useRestaurantsQuery()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{appContext ? `, ${appContext.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground">
          {appContext?.isAllRestaurants
            ? 'Head office view — all restaurants.'
            : 'Here is what needs your attention today.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Restaurants</CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{restaurants?.length ?? 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Roles</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {appContext?.roleKeys.length ? (
                appContext.roleKeys.map((key) => (
                  <Badge key={key} variant="secondary">
                    {key.replace(/_/g, ' ')}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No role assigned</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <ClipboardCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground">Purchasing module not yet built</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground">Employees module not yet built</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foundation phase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Authentication, RBAC, restaurant isolation and the application shell are live. Role-specific dashboard
            widgets (purchases, price alerts, settlements, P&L) come online as each module in
            <code className="mx-1 rounded bg-muted px-1 py-0.5">docs/architecture.md</code>
            is built.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
