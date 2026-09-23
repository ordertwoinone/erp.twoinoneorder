import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RestaurantScopeState {
  /** null = "All restaurants" (only meaningful for is_all_restaurants users). */
  selectedRestaurantId: string | null
  setSelectedRestaurantId: (id: string | null) => void
}

export const useRestaurantScopeStore = create<RestaurantScopeState>()(
  persist(
    (set) => ({
      selectedRestaurantId: null,
      setSelectedRestaurantId: (id) => set({ selectedRestaurantId: id }),
    }),
    { name: 'erp-restaurant-scope' },
  ),
)
