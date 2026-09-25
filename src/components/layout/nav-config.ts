import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Boxes,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Omit for items visible to everyone signed in. */
  permission?: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Purchasing',
    items: [
      { label: 'Purchase Requests', to: '/purchases/requests', icon: ClipboardList, permission: 'purchases.create' },
      { label: 'Purchase Orders', to: '/purchases/orders', icon: PackageSearch, permission: 'purchase_orders.manage' },
      { label: 'Goods Receipts', to: '/purchases/receipts', icon: PackageCheck, permission: 'purchases.create' },
      { label: 'Purchases (Invoices)', to: '/purchases', icon: ShoppingCart, permission: 'purchases.create' },
      { label: 'Suppliers', to: '/suppliers', icon: Truck, permission: 'suppliers.manage' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Sales Entry', to: '/sales', icon: Receipt, permission: 'sales.create' },
      { label: 'Settlements', to: '/settlements', icon: CreditCard, permission: 'settlements.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payments', to: '/payments', icon: Wallet, permission: 'payments.create' },
      { label: 'Expenses', to: '/expenses', icon: Banknote, permission: 'expenses.manage' },
      { label: 'Accounting', to: '/accounting', icon: FileBarChart, permission: 'accounting.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, permission: 'employees.view' },
      { label: 'Payroll', to: '/payroll', icon: CalendarClock, permission: 'payroll.view' },
    ],
  },
  {
    label: 'Operations',
    items: [{ label: 'Inventory', to: '/inventory', icon: Boxes, permission: 'inventory.manage' }],
  },
  {
    label: 'Reports',
    items: [{ label: 'Reports', to: '/reports', icon: FileBarChart, permission: 'reports.view' }],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/settings/users', icon: UserCog, permission: 'users.manage' },
      { label: 'Restaurants', to: '/settings/restaurants', icon: Settings, permission: 'restaurants.manage' },
    ],
  },
]
