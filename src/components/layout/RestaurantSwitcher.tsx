import { Building2, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'

export function RestaurantSwitcher() {
  const { appContext } = useAuth()
  const { data: restaurants, isLoading } = useRestaurantsQuery()
  const { selectedRestaurantId, setSelectedRestaurantId, canSwitchRestaurants } = useRestaurantScope()

  if (isLoading) return <Skeleton className="h-9 w-44" />
  if (!restaurants || restaurants.length === 0) return null

  const current = restaurants.find((r) => r.id === selectedRestaurantId)
  const label = current ? current.name : canSwitchRestaurants ? 'All Restaurants' : 'No restaurant assigned'

  if (!canSwitchRestaurants && restaurants.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-44 justify-between">
          <span className="flex items-center gap-2 truncate">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch restaurant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {appContext?.isAllRestaurants && (
          <DropdownMenuItem onSelect={() => setSelectedRestaurantId(null)}>
            All Restaurants (Consolidated)
          </DropdownMenuItem>
        )}
        {restaurants.map((restaurant) => (
          <DropdownMenuItem key={restaurant.id} onSelect={() => setSelectedRestaurantId(restaurant.id)}>
            {restaurant.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
