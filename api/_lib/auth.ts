import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

/**
 * Verifies the caller's bearer token is a real, current session and that
 * they hold `permission`. Uses the anon key (not the service role) so this
 * check goes through the same RLS-backed RPC the frontend uses — the
 * service-role client in this function has no authorization logic of its
 * own, so every handler must call this before doing anything with it.
 */
export async function requireUserWithPermission(
  authHeader: string | undefined,
  permission: string,
): Promise<{ userId: string }> {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY server environment variables.')
  }
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    throw new AuthError(401, 'Missing Authorization header')
  }

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)
  if (userError || !user) {
    throw new AuthError(401, 'Invalid or expired session')
  }

  const { data: context, error: contextError } = await supabase.rpc('get_my_context')
  if (contextError) throw new AuthError(500, contextError.message)
  const permissions = context?.[0]?.permission_keys ?? []
  if (!permissions.includes(permission)) {
    throw new AuthError(403, `Missing permission: ${permission}`)
  }

  return { userId: user.id }
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
