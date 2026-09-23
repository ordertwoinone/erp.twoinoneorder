import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Server-only client using the service role key — bypasses RLS entirely.
 * Never import this from src/. Every handler that uses it must do its own
 * authorization check first (see _lib/auth.ts) since RLS isn't there to
 * catch mistakes.
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY server environment variables.')
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
