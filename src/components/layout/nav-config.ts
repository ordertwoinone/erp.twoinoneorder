import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
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
  Layers,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  PackageMinus,
  Palette,
  Receipt,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Tags,
  Trash2,
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
      { label: 'Expense Heads', to: '/expenses/heads', icon: Tags, permission: 'expenses.manage' },
      { label: 'Accounting', to: '/accounting', icon: FileBarChart, permission: 'accounting.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, permission: 'employees.view' },
      { label: 'Company Categories', to: '/employees/company-categories', icon: Layers, permission: 'employees.manage' },
      { label: 'Payroll', to: '/payroll', icon: CalendarClock, permission: 'payroll.view' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Stock Balances', to: '/inventory', icon: Boxes, permission: 'inventory.manage' },
      { label: 'Locations', to: '/inventory/locations', icon: MapPin, permission: 'inventory.manage' },
      { label: 'Purchase Returns', to: '/inventory/purchase-returns', icon: PackageMinus, permission: 'purchases.create' },
      { label: 'Wastage', to: '/inventory/wastage', icon: Trash2, permission: 'inventory.manage' },
      { label: 'Stock Adjustments', to: '/inventory/adjustments', icon: SlidersHorizontal, permission: 'inventory.manage' },
      { label: 'Stock Requests', to: '/inventory/requests', icon: ClipboardList, permission: 'inventory.manage' },
      { label: 'Stock Transfers', to: '/inventory/transfers', icon: ArrowLeftRight, permission: 'inventory.manage' },
    ],
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
      { label: 'Appearance', to: '/settings/appearance', icon: Palette },
    ],
  },
]
