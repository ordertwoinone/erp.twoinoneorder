import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface AppContextData {
  profileId: string
  fullName: string
  email: string
  isAllRestaurants: boolean
  restaurantIds: string[]
  roleKeys: string[]
  permissionKeys: string[]
}

interface AuthState {
  session: Session | null
  appContext: AppContextData | null
  /** True while the initial session + context is being resolved. */
  isLoading: boolean
  /** True while re-fetching app context after sign-in/permission changes. */
  isRefreshing: boolean
}

export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshContext: () => Promise<void>
  hasPermission: (permissionKey: string) => boolean
  hasRestaurantAccess: (restaurantId: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchAppContext(): Promise<AppContextData | null> {
  const { data, error } = await supabase.rpc('get_my_context')
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    profileId: row.profile_id,
    fullName: row.full_name,
    email: row.email,
    isAllRestaurants: row.is_all_restaurants,
    restaurantIds: row.restaurant_ids ?? [],
    roleKeys: row.role_keys ?? [],
    permissionKeys: row.permission_keys ?? [],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    appContext: null,
    isLoading: true,
    isRefreshing: false,
  })

  const refreshContext = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }))
    try {
      const appContext = await fetchAppContext()
      setState((prev) => ({ ...prev, appContext, isRefreshing: false }))
    } catch {
      setState((prev) => ({ ...prev, appContext: null, isRefreshing: false }))
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!isMounted) return

      if (session) {
        const appContext = await fetchAppContext().catch(() => null)
        if (!isMounted) return
        setState({ session, appContext, isLoading: false, isRefreshing: false })
      } else {
        setState({ session: null, appContext: null, isLoading: false, isRefreshing: false })
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      if (session) {
        setState((prev) => ({ ...prev, session, isLoading: false }))
        fetchAppContext()
          .then((appContext) => {
            if (isMounted) setState((prev) => ({ ...prev, appContext }))
          })
          .catch(() => {
            if (isMounted) setState((prev) => ({ ...prev, appContext: null }))
          })
      } else {
        setState({ session: null, appContext: null, isLoading: false, isRefreshing: false })
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ session: null, appContext: null, isLoading: false, isRefreshing: false })
  }, [])

  const hasPermission = useCallback(
    (permissionKey: string) => state.appContext?.permissionKeys.includes(permissionKey) ?? false,
    [state.appContext],
  )

  const hasRestaurantAccess = useCallback(
    (restaurantId: string) =>
      state.appContext?.isAllRestaurants || (state.appContext?.restaurantIds.includes(restaurantId) ?? false),
    [state.appContext],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signOut, refreshContext, hasPermission, hasRestaurantAccess }),
    [state, signOut, refreshContext, hasPermission, hasRestaurantAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
