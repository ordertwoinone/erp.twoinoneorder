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
          salesman_name: string | null
          credit_limit_amount: number | null
          credit_limit_currency: 'AED' | 'USD' | 'EUR' | 'INR' | 'EGP' | null
          supplier_type: 'distributor' | 'manufacturer' | 'wholesaler' | 'farm' | 'importer' | 'other' | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['suppliers']['Row']> & { code: string; name: string }
        Update: Partial<Database['public']['Tables']['suppliers']['Row']>
        Relationships: []
      }
      supplier_categories: {
        Row: { supplier_id: string; category_id: string }
        Insert: { supplier_id: string; category_id: string }
        Update: Partial<Database['public']['Tables']['supplier_categories']['Row']>
        Relationships: [
          {
            foreignKeyName: 'supplier_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      supplier_price_locks: {
        Row: {
          id: string
          supplier_id: string
          product_id: string
          unit_id: string
          pack_size: number | null
          agreed_price: number
          valid_from: string
          valid_to: string | null
          source_quotation_id: string | null
          is_current: boolean
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['supplier_price_locks']['Row']> & {
          supplier_id: string
          product_id: string
          unit_id: string
          agreed_price: number
          valid_from: string
        }
        Update: Partial<Database['public']['Tables']['supplier_price_locks']['Row']>
        Relationships: [
          {
            foreignKeyName: 'supplier_price_locks_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_price_locks_unit_id_fkey'
            columns: ['unit_id']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['id']
          },
        ]
      }
      supplier_price_lock_restaurants: {
        Row: { price_lock_id: string; restaurant_id: string }
        Insert: { price_lock_id: string; restaurant_id: string }
        Update: Partial<Database['public']['Tables']['supplier_price_lock_restaurants']['Row']>
        Relationships: [
          {
            foreignKeyName: 'supplier_price_lock_restaurants_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      exchange_rates: {
        Row: { currency_code: string; rate_to_aed: number; updated_by: string | null; updated_at: string }
        Insert: { currency_code: string; rate_to_aed: number; updated_by?: string | null }
        Update: Partial<Database['public']['Tables']['exchange_rates']['Row']>
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
          barcode: string | null
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
      purchase_orders: {
        Row: {
          id: string
          order_number: string
          restaurant_id: string
          supplier_id: string
          purchase_request_id: string | null
          status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'closed' | 'cancelled'
          order_date: string
          expected_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_orders']['Row']> & {
          order_number: string
          restaurant_id: string
          supplier_id: string
        }
        Update: Partial<Database['public']['Tables']['purchase_orders']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_orders_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          unit_id: string
          pack_size: number | null
          quantity: number
          unit_price: number
          quantity_received: number
        }
        Insert: Partial<Database['public']['Tables']['purchase_order_items']['Row']> & {
          purchase_order_id: string
          product_id: string
          unit_id: string
          quantity: number
          unit_price: number
        }
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchase_order_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      goods_receipts: {
        Row: {
          id: string
          receipt_number: string
          restaurant_id: string
          purchase_order_id: string | null
          purchase_id: string | null
          status: 'draft' | 'confirmed' | 'cancelled'
          received_date: string
          received_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['goods_receipts']['Row']> & {
          receipt_number: string
          restaurant_id: string
        }
        Update: Partial<Database['public']['Tables']['goods_receipts']['Row']>
        Relationships: [
          {
            foreignKeyName: 'goods_receipts_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goods_receipts_purchase_order_id_fkey'
            columns: ['purchase_order_id']
            isOneToOne: false
            referencedRelation: 'purchase_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goods_receipts_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          id: string
          goods_receipt_id: string
          product_id: string
          unit_id: string
          quantity_received: number
          quantity_shortage: number
          notes: string | null
        }
        Insert: Partial<Database['public']['Tables']['goods_receipt_items']['Row']> & {
          goods_receipt_id: string
          product_id: string
          unit_id: string
          quantity_received: number
        }
        Update: Partial<Database['public']['Tables']['goods_receipt_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'goods_receipt_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
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
      salary_entries: {
        Row: {
          id: string
          employee_id: string
          restaurant_id: string
          period_month: string
          basic_salary: number
          allowances_total: number
          overtime_amount: number
          deductions_total: number
          advances_deducted: number
          net_salary: number
          payment_status: 'pending' | 'partially_paid' | 'paid'
          status: 'draft' | 'pending_approval' | 'approved' | 'posted' | 'cancelled'
          created_by: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['salary_entries']['Row']> & {
          employee_id: string
          restaurant_id: string
          period_month: string
        }
        Update: Partial<Database['public']['Tables']['salary_entries']['Row']>
        Relationships: [
          {
            foreignKeyName: 'salary_entries_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'salary_entries_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      salary_payments: {
        Row: {
          id: string
          salary_entry_id: string
          amount: number
          payment_date: string
          payment_method: 'bank' | 'cash'
          bank_account_id: string | null
          cash_account_id: string | null
          reference: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['salary_payments']['Row']> & {
          salary_entry_id: string
          amount: number
          payment_method: 'bank' | 'cash'
        }
        Update: Partial<Database['public']['Tables']['salary_payments']['Row']>
        Relationships: []
      }
      purchase_requests: {
        Row: {
          id: string
          request_number: string
          restaurant_id: string
          status: 'requested' | 'under_review' | 'approved' | 'rejected' | 'ordered' | 'received' | 'invoiced' | 'cancelled'
          notes: string | null
          requested_by: string | null
          reviewed_by: string | null
          requested_at: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_requests']['Row']> & { restaurant_id: string }
        Update: Partial<Database['public']['Tables']['purchase_requests']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchase_requests_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_request_items: {
        Row: { id: string; purchase_request_id: string; product_id: string; unit_id: string; quantity: number; notes: string | null }
        Insert: Partial<Database['public']['Tables']['purchase_request_items']['Row']> & {
          purchase_request_id: string
          product_id: string
          unit_id: string
          quantity: number
        }
        Update: Partial<Database['public']['Tables']['purchase_request_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'purchase_request_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_request_items_unit_id_fkey'
            columns: ['unit_id']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['id']
          },
        ]
      }
      stock_balances: {
        Row: { restaurant_id: string; product_id: string; quantity_on_hand: number; average_cost: number; updated_at: string }
        Insert: { restaurant_id: string; product_id: string; quantity_on_hand?: number; average_cost?: number }
        Update: Partial<Database['public']['Tables']['stock_balances']['Row']>
        Relationships: [
          {
            foreignKeyName: 'stock_balances_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      branch_transfers: {
        Row: {
          id: string
          transfer_number: string
          from_restaurant_id: string
          to_restaurant_id: string
          status: 'dispatched' | 'in_transit' | 'received' | 'cancelled'
          dispatch_date: string
          received_date: string | null
          dispatched_by: string | null
          received_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['branch_transfers']['Row']> & {
          from_restaurant_id: string
          to_restaurant_id: string
        }
        Update: Partial<Database['public']['Tables']['branch_transfers']['Row']>
        Relationships: [
          {
            foreignKeyName: 'branch_transfers_from_restaurant_id_fkey'
            columns: ['from_restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'branch_transfers_to_restaurant_id_fkey'
            columns: ['to_restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      branch_transfer_items: {
        Row: {
          id: string
          branch_transfer_id: string
          product_id: string
          unit_id: string
          quantity: number
          unit_cost: number
        }
        Insert: Partial<Database['public']['Tables']['branch_transfer_items']['Row']> & {
          branch_transfer_id: string
          product_id: string
          unit_id: string
          quantity: number
          unit_cost: number
        }
        Update: Partial<Database['public']['Tables']['branch_transfer_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'branch_transfer_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'branch_transfer_items_unit_id_fkey'
            columns: ['unit_id']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['id']
          },
        ]
      }
      card_machines: {
        Row: {
          id: string
          machine_name: string
          terminal_id: string
          provider: string
          linked_bank_account_id: string | null
          status: 'active' | 'inactive' | 'retired'
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['card_machines']['Row']> & { machine_name: string; terminal_id: string; provider: string }
        Update: Partial<Database['public']['Tables']['card_machines']['Row']>
        Relationships: []
      }
      card_settlements: {
        Row: {
          id: string
          card_machine_id: string
          bank_account_id: string
          credit_date: string
          bank_reference: string | null
          amount: number
          status: 'unmatched' | 'partially_matched' | 'matched' | 'disputed'
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['card_settlements']['Row']> & {
          card_machine_id: string
          bank_account_id: string
          credit_date: string
          amount: number
        }
        Update: Partial<Database['public']['Tables']['card_settlements']['Row']>
        Relationships: [
          {
            foreignKeyName: 'card_settlements_card_machine_id_fkey'
            columns: ['card_machine_id']
            isOneToOne: false
            referencedRelation: 'card_machines'
            referencedColumns: ['id']
          },
        ]
      }
      card_settlement_allocations: {
        Row: {
          id: string
          card_settlement_id: string
          restaurant_id: string
          amount: number
          covers_from: string
          covers_to: string
        }
        Insert: Partial<Database['public']['Tables']['card_settlement_allocations']['Row']> & {
          card_settlement_id: string
          restaurant_id: string
          amount: number
          covers_from: string
          covers_to: string
        }
        Update: Partial<Database['public']['Tables']['card_settlement_allocations']['Row']>
        Relationships: [
          {
            foreignKeyName: 'card_settlement_allocations_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      delivery_platforms: {
        Row: { id: string; code: string; name: string; integration_status: string; is_active: boolean; created_at: string }
        Insert: { id?: string; code: string; name: string; integration_status?: string; is_active?: boolean }
        Update: Partial<Database['public']['Tables']['delivery_platforms']['Row']>
        Relationships: []
      }
      delivery_settlements: {
        Row: {
          id: string
          delivery_platform_id: string
          restaurant_id: string
          bank_account_id: string | null
          credit_date: string
          bank_reference: string | null
          amount: number
          covers_from: string
          covers_to: string
          status: 'unmatched' | 'partially_matched' | 'matched' | 'disputed'
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['delivery_settlements']['Row']> & {
          delivery_platform_id: string
          restaurant_id: string
          credit_date: string
          amount: number
          covers_from: string
          covers_to: string
        }
        Update: Partial<Database['public']['Tables']['delivery_settlements']['Row']>
        Relationships: [
          {
            foreignKeyName: 'delivery_settlements_delivery_platform_id_fkey'
            columns: ['delivery_platform_id']
            isOneToOne: false
            referencedRelation: 'delivery_platforms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'delivery_settlements_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      accounting_accounts: {
        Row: { id: string; code: string; name: string; account_type: string; parent_id: string | null; is_active: boolean }
        Insert: { id?: string; code: string; name: string; account_type: string; parent_id?: string | null; is_active?: boolean }
        Update: Partial<Database['public']['Tables']['accounting_accounts']['Row']>
        Relationships: []
      }
      accounting_periods: {
        Row: {
          id: string
          restaurant_id: string | null
          period_month: string
          status: 'open' | 'locked'
          locked_by: string | null
          locked_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['accounting_periods']['Row']> & { period_month: string }
        Update: Partial<Database['public']['Tables']['accounting_periods']['Row']>
        Relationships: []
      }
      journal_entries: {
        Row: {
          id: string
          entry_number: string
          restaurant_id: string
          entry_date: string
          status: 'posted' | 'reversed'
          source_type: string
          source_id: string | null
          reversed_entry_id: string | null
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['journal_entries']['Row']> & { restaurant_id: string; entry_date: string; source_type: string }
        Update: Partial<Database['public']['Tables']['journal_entries']['Row']>
        Relationships: [
          {
            foreignKeyName: 'journal_entries_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
        ]
      }
      journal_lines: {
        Row: { id: string; journal_entry_id: string; accounting_account_id: string; debit_amount: number; credit_amount: number; memo: string | null }
        Insert: Partial<Database['public']['Tables']['journal_lines']['Row']> & { journal_entry_id: string; accounting_account_id: string }
        Update: Partial<Database['public']['Tables']['journal_lines']['Row']>
        Relationships: [
          {
            foreignKeyName: 'journal_lines_accounting_account_id_fkey'
            columns: ['accounting_account_id']
            isOneToOne: false
            referencedRelation: 'accounting_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      attachments: {
        Row: {
          id: string
          restaurant_id: string | null
          entity_type: string
          entity_id: string
          category: string
          storage_bucket: string
          storage_path: string
          file_name: string
          mime_type: string
          file_size_bytes: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['attachments']['Row']> & {
          entity_type: string
          entity_id: string
          category: string
          storage_bucket: string
          storage_path: string
          file_name: string
          mime_type: string
          file_size_bytes: number
        }
        Update: Partial<Database['public']['Tables']['attachments']['Row']>
        Relationships: []
      }
      ai_scan_jobs: {
        Row: {
          id: string
          restaurant_id: string | null
          supplier_id: string | null
          job_type: 'invoice' | 'labour_list' | 'sales_document' | 'quotation'
          status: 'queued' | 'processing' | 'completed' | 'failed' | 'reviewed'
          attachment_id: string | null
          error_message: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['ai_scan_jobs']['Row']> & {
          job_type: Database['public']['Tables']['ai_scan_jobs']['Row']['job_type']
        }
        Update: Partial<Database['public']['Tables']['ai_scan_jobs']['Row']>
        Relationships: [
          {
            foreignKeyName: 'ai_scan_jobs_attachment_id_fkey'
            columns: ['attachment_id']
            isOneToOne: false
            referencedRelation: 'attachments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_scan_jobs_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      ai_scan_results: {
        Row: {
          id: string
          ai_scan_job_id: string
          raw_response: Json
          parsed_data: Json | null
          review_status: 'pending_review' | 'confirmed' | 'discarded'
          reviewed_by: string | null
          reviewed_at: string | null
          resulting_entity_type: 'purchase' | 'employee' | 'sales_entry' | 'price_lock' | null
          resulting_entity_id: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['ai_scan_results']['Row']> & { ai_scan_job_id: string }
        Update: Partial<Database['public']['Tables']['ai_scan_results']['Row']>
        Relationships: [
          {
            foreignKeyName: 'ai_scan_results_ai_scan_job_id_fkey'
            columns: ['ai_scan_job_id']
            isOneToOne: false
            referencedRelation: 'ai_scan_jobs'
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
      save_salary_entry_draft: {
        Args: { payload: Json }
        Returns: string
      }
      transition_salary_entry: {
        Args: { p_salary_entry_id: string; p_action: string }
        Returns: undefined
      }
      post_salary_payment: {
        Args: {
          p_salary_entry_id: string
          p_amount: number
          p_payment_method: string
          p_bank_account_id?: string | null
          p_cash_account_id?: string | null
        }
        Returns: undefined
      }
      save_purchase_request: {
        Args: { payload: Json }
        Returns: string
      }
      review_purchase_request: {
        Args: { p_request_id: string; p_action: string; p_comment?: string | null }
        Returns: undefined
      }
      create_branch_transfer: {
        Args: { payload: Json }
        Returns: string
      }
      receive_branch_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      create_card_settlement: {
        Args: { payload: Json }
        Returns: string
      }
      get_pnl_report: {
        Args: { p_restaurant_id: string; p_period_start: string; p_period_end: string }
        Returns: {
          net_sales: number
          opening_stock_value: number | null
          purchases_value: number
          closing_stock_value: number | null
          transfers_net: number
          cogs: number | null
          gross_profit: number | null
          salaries_total: number
          opex_total: number
          card_fees: number
          delivery_commissions: number
          net_profit: number | null
          is_provisional: boolean
        }[]
      }
      set_accounting_period_status: {
        Args: { p_restaurant_id: string; p_period_month: string; p_status: string }
        Returns: undefined
      }
      set_exchange_rate: {
        Args: { p_currency_code: string; p_rate_to_aed: number }
        Returns: undefined
      }
      create_quotation_scan_job: {
        Args: {
          p_supplier_id: string
          p_storage_path: string
          p_file_name: string
          p_mime_type: string
          p_file_size_bytes: number
        }
        Returns: string
      }
      quick_create_product: {
        Args: {
          p_name: string
          p_base_unit_id: string
          p_sku?: string | null
          p_brand_id?: string | null
          p_barcode?: string | null
        }
        Returns: string
      }
      search_items_for_purchase: {
        Args: { p_supplier_id: string; p_restaurant_id: string; p_search: string | null; p_limit?: number }
        Returns: {
          product_id: string
          name: string
          sku: string | null
          barcode: string | null
          brand_name: string | null
          category_name: string | null
          base_unit_id: string
          base_unit_code: string
          pack_size: number | null
          pack_unit_code: string | null
          agreed_price: number | null
          last_purchase_price: number | null
          last_purchase_date: string | null
        }[]
      }
      create_invoice_scan_job: {
        Args: {
          p_restaurant_id: string
          p_supplier_id: string | null
          p_storage_path: string
          p_file_name: string
          p_mime_type: string
          p_file_size_bytes: number
        }
        Returns: string
      }
      confirm_purchase_scan: {
        Args: { p_scan_result_id: string; payload: Json }
        Returns: string
      }
      save_price_lock: {
        Args: { payload: Json }
        Returns: string
      }
      confirm_supplier_price_locks: {
        Args: { p_scan_result_id: string; p_items: Json }
        Returns: undefined
      }
      get_dashboard_pipeline_counts: {
        Args: { p_restaurant_ids: string[] | null; p_period_start: string; p_period_end: string }
        Returns: {
          request_count: number
          order_count: number
          receive_count: number
          invoice_count: number
          approve_awaiting_count: number
          pay_awaiting_count: number
          reconcile_count: number | null
        }[]
      }
      get_dashboard_kpis: {
        Args: { p_restaurant_ids: string[] | null; p_period_start: string; p_period_end: string }
        Returns: {
          purchases_total: number
          purchases_prior: number
          sales_total: number
          sales_prior: number
          payables_total: number
          payables_prior: number
          exceptions_count: number
          exceptions_prior_count: number
        }[]
      }
      get_dashboard_exceptions: {
        Args: { p_restaurant_ids: string[] | null; p_period_start: string; p_period_end: string; p_limit?: number }
        Returns: {
          purchase_id: string
          restaurant_id: string
          restaurant_name: string
          supplier_id: string
          supplier_name: string
          invoice_number: string
          invoice_date: string
          total_amount: number
          exception_type: 'price_above_contract' | 'missing_goods_receipt' | 'duplicate_invoice'
          variance_pct: number | null
          owner_name: string | null
          status: string
        }[]
      }
      get_supplier_performance: {
        Args: { p_restaurant_ids: string[] | null; p_period_start: string; p_period_end: string; p_limit?: number }
        Returns: {
          supplier_id: string
          supplier_name: string
          supplier_type: string | null
          purchase_volume: number
          price_increase_count: number
          price_increase_value: number
          price_decrease_count: number
          price_decrease_value: number
          has_sufficient_data: boolean
        }[]
      }
      get_dashboard_accounting_overview: {
        Args: { p_restaurant_ids: string[] | null; p_period_start: string; p_period_end: string }
        Returns: {
          bank_reconciled_count: number | null
          bank_total_count: number | null
          vat_payable: number | null
          unsettled_card_amount: number | null
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
