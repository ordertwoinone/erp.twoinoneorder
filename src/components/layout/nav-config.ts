import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FilePlus2,
  FileSignature,
  History,
  IdCard,
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
      { label: 'New Purchase', to: '/purchases/new', icon: FilePlus2, permission: 'purchases.create' },
      { label: 'Purchase Requests', to: '/purchases/requests', icon: ClipboardList, permission: 'purchases.create' },
      { label: 'Purchase Orders', to: '/purchases/orders', icon: PackageSearch, permission: 'purchase_orders.manage' },
      { label: 'Goods Receiving', to: '/purchases/receipts', icon: PackageCheck, permission: 'purchases.create' },
      { label: 'Invoices', to: '/purchases', icon: ShoppingCart, permission: 'purchases.create' },
      { label: 'Suppliers', to: '/suppliers', icon: Truck, permission: 'suppliers.manage' },
      { label: 'Price Contracts', to: '/suppliers/price-contracts', icon: FileSignature, permission: 'purchases.create' },
      { label: 'Supplier Rankings', to: '/suppliers/rankings', icon: BarChart3, permission: 'reports.view' },
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
    items: [
      { label: 'Reports', to: '/reports', icon: FileBarChart, permission: 'reports.view' },
      { label: 'Employees Report', to: '/reports/employees', icon: IdCard, permission: 'employees.view' },
      { label: 'Audit Log', to: '/reports/audit-log', icon: History, permission: 'audit.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/settings/users', icon: UserCog, permission: 'users.manage' },
      { label: 'Restaurants', to: '/settings/restaurants', icon: Settings, permission: 'restaurants.manage' },
    ],
  },
]
