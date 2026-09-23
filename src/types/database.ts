/**
 * Hand-written Supabase types for the tables/RPCs the app shell uses so far
 * (organization, RBAC). As each module is built out, regenerate the full
 * set instead of hand-extending this file:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * (requires `npx supabase login` and the project linked — see README.md
 * §Database migrations).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          code: string
          name: string
          legal_name: string | null
          address: string | null
          city: string | null
          emirate: string | null
          phone: string | null
          email: string | null
          trn: string | null
          is_head_office: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['restaurants']['Row']> & {
          code: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['restaurants']['Row']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          status: 'active' | 'inactive' | 'suspended'
          avatar_url: string | null
          primary_restaurant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string
          full_name: string
          email: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          key: string
          name: string
          description: string | null
          is_all_restaurants: boolean
          is_system_role: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['roles']['Row']> & { key: string; name: string }
        Update: Partial<Database['public']['Tables']['roles']['Row']>
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          key: string
          name: string
          category: string
          description: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['permissions']['Row']> & {
          key: string
          name: string
          category: string
        }
        Update: Partial<Database['public']['Tables']['permissions']['Row']>
        Relationships: []
      }
      role_permissions: {
        Row: { role_id: string; permission_id: string }
        Insert: { role_id: string; permission_id: string }
        Update: Partial<{ role_id: string; permission_id: string }>
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          profile_id: string
          role_id: string
          granted_by: string | null
          granted_at: string
        }
        Insert: Partial<Database['public']['Tables']['user_roles']['Row']> & {
          profile_id: string
          role_id: string
        }
        Update: Partial<Database['public']['Tables']['user_roles']['Row']>
        Relationships: []
      }
      user_restaurants: {
        Row: {
          id: string
          profile_id: string
          restaurant_id: string
          granted_by: string | null
          granted_at: string
        }
        Insert: Partial<Database['public']['Tables']['user_restaurants']['Row']> & {
          profile_id: string
          restaurant_id: string
        }
        Update: Partial<Database['public']['Tables']['user_restaurants']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_permissions: {
        Args: Record<string, never>
        Returns: { permission_key: string }[]
      }
      get_my_context: {
        Args: Record<string, never>
        Returns: {
          profile_id: string
          full_name: string
          email: string
          is_all_restaurants: boolean
          restaurant_ids: string[]
          role_keys: string[]
          permission_keys: string[]
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
