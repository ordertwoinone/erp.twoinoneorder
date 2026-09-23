import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRestaurantScopeStore } from '@/lib/auth/restaurant-scope-store'

/**
 * Resolves the restaurant currently in scope for queries/reports. A
 * single-restaurant user is pinned to their one restaurant. An
 * all-restaurants user can pick a restaurant or leave it unset for
 * "All restaurants" (consolidated view).
 *
 * This is a UI convenience only — it narrows which restaurant_id the
 * frontend requests. It is not the authorization boundary; RLS re-checks
 * restaurant access on every query regardless of what's selected here.
 */
export function useRestaurantScope() {
  const { appContext } = useAuth()
  const { selectedRestaurantId, setSelectedRestaurantId } = useRestaurantScopeStore()

  useEffect(() => {
    if (!appContext) return
    if (appContext.isAllRestaurants) {
      if (selectedRestaurantId && !appContext.restaurantIds.includes(selectedRestaurantId)) {
        // Previously-selected restaurant no longer valid for this user; fall back to "All".
        setSelectedRestaurantId(null)
      }
      return
    }
    const onlyRestaurant = appContext.restaurantIds[0] ?? null
    if (selectedRestaurantId !== onlyRestaurant) {
      setSelectedRestaurantId(onlyRestaurant)
    }
  }, [appContext, selectedRestaurantId, setSelectedRestaurantId])

  return {
    selectedRestaurantId,
    setSelectedRestaurantId,
    canSwitchRestaurants: appContext?.isAllRestaurants ?? false,
    accessibleRestaurantIds: appContext?.restaurantIds ?? [],
  }
}
