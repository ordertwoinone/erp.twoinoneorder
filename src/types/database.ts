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
      suppliers: {
        Row: {
          id: string
          code: string
          name: string
          trn: string | null
          payment_terms_days: number
          bank_name: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_swift: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['suppliers']['Row']> & { code: string; name: string }
        Update: Partial<Database['public']['Tables']['suppliers']['Row']>
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; parent_id: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['categories']['Row']>
        Relationships: []
      }
      brands: {
        Row: { id: string; name: string; is_active: boolean; created_at: string }
        Insert: Partial<Database['public']['Tables']['brands']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['brands']['Row']>
        Relationships: []
      }
      units: {
        Row: { id: string; code: string; name: string }
        Insert: { id?: string; code: string; name: string }
        Update: Partial<Database['public']['Tables']['units']['Row']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          sku: string | null
          name: string
          description: string | null
          category_id: string | null
          brand_id: string | null
          base_unit_id: string
          pack_size: number | null
          pack_unit_id: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']> & { name: string; base_unit_id: string }
        Update: Partial<Database['public']['Tables']['products']['Row']>
        Relationships: []
      }
      purchases: {
        Row: {
          id: string
          purchase_number: string
          restaurant_id: string
          supplier_id: string
          purchase_order_id: string | null
          invoice_number: string
          invoice_date: string
          status: 'draft' | 'pending_approval' | 'returned' | 'rejected' | 'approved' | 'posted' | 'cancelled'
          payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid'
          source: 'manual' | 'ai_scan'
          ai_scan_job_id: string | null
          subtotal_amount: number
          discount_amount: number
          tax_amount: number
          total_amount: number
          paid_amount: number
          notes: string | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          posted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchases']['Row']> & {
          restaurant_id: string
          supplier_id: string
          invoice_number: string
          invoice_date: string
        }
        Update: Partial<Database['public']['Tables']['purchases']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchases_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          purchase_id: string
          product_id: string
          unit_id: string
          pack_size: number | null
          quantity: number
          unit_price: number
          discount_amount: number
          tax_amount: number
          line_total: number
          agreed_price_at_entry: number | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_items']['Row']> & {
          purchase_id: string
          product_id: string
          unit_id: string
          quantity: number
          unit_price: number
          line_total: number
        }
        Update: Partial<Database['public']['Tables']['purchase_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_unit_id_fkey'
            columns: ['unit_id']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['id']
          },
        ]
      }
      approvals: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'commented' | 'posted' | 'reversed'
          comment: string | null
          actor_id: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['approvals']['Row']> & {
          entity_type: string
          entity_id: string
          action: Database['public']['Tables']['approvals']['Row']['action']
        }
        Update: Partial<Database['public']['Tables']['approvals']['Row']>
        Relationships: [
          {
            foreignKeyName: 'approvals_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sales_channels: {
        Row: { id: string; code: string; name: string; is_active: boolean }
        Insert: { id?: string; code: string; name: string; is_active?: boolean }
        Update: Partial<Database['public']['Tables']['sales_channels']['Row']>
        Relationships: []
      }
      payment_methods: {
        Row: { id: string; code: string; name: string; is_active: boolean }
        Insert: { id?: string; code: string; name: string; is_active?: boolean }
        Update: Partial<Database['public']['Tables']['payment_methods']['Row']>
        Relationships: []
      }
      sales_entries: {
        Row: {
          id: string
          restaurant_id: string
          business_date: string
          shift: 'morning' | 'evening' | 'full_day'
          gross_sales: number
          discounts: number
          refunds: number
          tax_amount: number
          net_sales: number
          status: 'draft' | 'submitted' | 'reviewed' | 'posted'
          submitted_by: string | null
          reviewed_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['sales_entries']['Row']> & {
          restaurant_id: string
          business_date: string
        }
        Update: Partial<Database['public']['Tables']['sales_entries']['Row']>
        Relationships: [
          {
            foreignKeyName: 'sales_entries_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      sales_payment_breakdowns: {
        Row: {
          id: string
          sales_entry_id: string
          sales_channel_id: string | null
          payment_method_id: string
          amount: number
        }
        Insert: Partial<Database['public']['Tables']['sales_payment_breakdowns']['Row']> & {
          sales_entry_id: string
          payment_method_id: string
          amount: number
        }
        Update: Partial<Database['public']['Tables']['sales_payment_breakdowns']['Row']>
        Relationships: [
          {
            foreignKeyName: 'sales_payment_breakdowns_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_payment_breakdowns_sales_channel_id_fkey'
            columns: ['sales_channel_id']
            isOneToOne: false
            referencedRelation: 'sales_channels'
            referencedColumns: ['id']
          },
        ]
      }
      bank_accounts: {
        Row: {
          id: string
          restaurant_id: string | null
          bank_name: string
          account_name: string
          account_number: string
          iban: string | null
          swift: string | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['bank_accounts']['Row']> & {
          bank_name: string
          account_name: string
          account_number: string
        }
        Update: Partial<Database['public']['Tables']['bank_accounts']['Row']>
        Relationships: []
      }
      cash_accounts: {
        Row: { id: string; restaurant_id: string; name: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: Partial<Database['public']['Tables']['cash_accounts']['Row']> & { restaurant_id: string; name: string }
        Update: Partial<Database['public']['Tables']['cash_accounts']['Row']>
        Relationships: []
      }
      expense_categories: {
        Row: { id: string; name: string; is_head_office_only: boolean; is_active: boolean }
        Insert: Partial<Database['public']['Tables']['expense_categories']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['expense_categories']['Row']>
        Relationships: []
      }
      payment_vouchers: {
        Row: {
          id: string
          voucher_number: string
          restaurant_id: string
          payee_type: 'supplier' | 'expense' | 'employee' | 'other'
          supplier_id: string | null
          expense_category_id: string | null
          amount: number
          payment_method: 'bank' | 'cash'
          bank_account_id: string | null
          cash_account_id: string | null
          payment_reference: string | null
          voucher_date: string
          status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'posted' | 'cancelled'
          notes: string | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          posted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payment_vouchers']['Row']> & {
          restaurant_id: string
          payee_type: Database['public']['Tables']['payment_vouchers']['Row']['payee_type']
          amount: number
          payment_method: 'bank' | 'cash'
          voucher_date: string
        }
        Update: Partial<Database['public']['Tables']['payment_vouchers']['Row']>
        Relationships: [
          {
            foreignKeyName: 'payment_vouchers_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_vouchers_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      payment_voucher_items: {
        Row: { id: string; payment_voucher_id: string; description: string; amount: number }
        Insert: { id?: string; payment_voucher_id: string; description: string; amount: number }
        Update: Partial<Database['public']['Tables']['payment_voucher_items']['Row']>
        Relationships: []
      }
      supplier_payments: {
        Row: {
          id: string
          payment_voucher_id: string
          supplier_id: string
          restaurant_id: string
          amount: number
          is_advance: boolean
          payment_date: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['supplier_payments']['Row']> & {
          payment_voucher_id: string
          supplier_id: string
          restaurant_id: string
          amount: number
        }
        Update: Partial<Database['public']['Tables']['supplier_payments']['Row']>
        Relationships: []
      }
      payment_allocations: {
        Row: { id: string; supplier_payment_id: string; purchase_id: string; amount: number; created_at: string }
        Insert: { id?: string; supplier_payment_id: string; purchase_id: string; amount: number }
        Update: Partial<Database['public']['Tables']['payment_allocations']['Row']>
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          employee_code: string
          full_name: string
          job_title: string | null
          joining_date: string | null
          base_salary: number | null
          employment_status: 'active' | 'on_leave' | 'terminated' | 'resigned'
          current_restaurant_id: string | null
          phone: string | null
          email: string | null
          emirates_id: string | null
          passport_number: string | null
          visa_expiry: string | null
          emirates_id_expiry: string | null
          is_shared_employee: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['employees']['Row']> & { employee_code: string; full_name: string }
        Update: Partial<Database['public']['Tables']['employees']['Row']>
        Relationships: [
          {
            foreignKeyName: 'employees_current_restaurant_id_fkey'
            columns: ['current_restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      employee_assignments: {
        Row: {
          id: string
          employee_id: string
          restaurant_id: string
          starts_at: string
          ends_at: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['employee_assignments']['Row']> & {
          employee_id: string
          restaurant_id: string
          starts_at: string
        }
        Update: Partial<Database['public']['Tables']['employee_assignments']['Row']>
        Relationships: []
      }
      operating_expenses: {
        Row: {
          id: string
          expense_number: string
          restaurant_id: string
          expense_category_id: string
          amount: number
          expense_date: string
          status: 'draft' | 'pending_approval' | 'approved' | 'posted' | 'rejected' | 'cancelled'
          payment_voucher_id: string | null
          notes: string | null
          created_by: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['operating_expenses']['Row']> & {
          restaurant_id: string
          expense_category_id: string
          amount: number
          expense_date: string
        }
        Update: Partial<Database['public']['Tables']['operating_expenses']['Row']>
        Relationships: [
          {
            foreignKeyName: 'operating_expenses_expense_category_id_fkey'
            columns: ['expense_category_id']
            isOneToOne: false
            referencedRelation: 'expense_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'operating_expenses_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
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
      save_purchase_draft: {
        Args: { payload: Json }
        Returns: string
      }
      transition_purchase: {
        Args: { p_purchase_id: string; p_action: string; p_comment?: string | null }
        Returns: undefined
      }
      post_purchase: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      save_sales_entry: {
        Args: { payload: Json }
        Returns: string
      }
      transition_sales_entry: {
        Args: { p_sales_entry_id: string; p_action: string }
        Returns: undefined
      }
      save_payment_voucher_draft: {
        Args: { payload: Json }
        Returns: string
      }
      transition_payment_voucher: {
        Args: { p_voucher_id: string; p_action: string; p_comment?: string | null }
        Returns: undefined
      }
      post_payment_voucher: {
        Args: { p_voucher_id: string; p_allocations?: Json }
        Returns: undefined
      }
      transfer_employee: {
        Args: { p_employee_id: string; p_new_restaurant_id: string; p_effective_date?: string }
        Returns: undefined
      }
      save_expense_draft: {
        Args: { payload: Json }
        Returns: string
      }
      transition_expense: {
        Args: { p_expense_id: string; p_action: string; p_comment?: string | null }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
