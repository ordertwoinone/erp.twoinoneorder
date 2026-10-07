import { NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  MapPin,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface Tile {
  label: string
  to: string
  icon: LucideIcon
  tone: string
  permission: string
}

const tiles: Tile[] = [
  { label: 'Location', to: '/inventory/locations', icon: MapPin, tone: 'text-red-500', permission: 'inventory.manage' },
  { label: 'Purchase Order', to: '/purchases/orders', icon: PackageSearch, tone: 'text-amber-600', permission: 'purchase_orders.manage' },
  { label: 'Purchase', to: '/purchases', icon: PackagePlus, tone: 'text-emerald-600', permission: 'purchases.create' },
  { label: 'Purchase Return', to: '/inventory/purchase-returns', icon: PackageMinus, tone: 'text-rose-600', permission: 'purchases.create' },
  { label: 'Wastage', to: '/inventory/wastage', icon: Trash2, tone: 'text-slate-500', permission: 'inventory.manage' },
  { label: 'Stock Adjustments', to: '/inventory/adjustments', icon: SlidersHorizontal, tone: 'text-sky-600', permission: 'inventory.manage' },
  { label: 'Stock Request', to: '/inventory/requests', icon: ClipboardList, tone: 'text-violet-600', permission: 'inventory.manage' },
  { label: 'Stock Transfer', to: '/inventory/transfers', icon: ArrowLeftRight, tone: 'text-orange-500', permission: 'inventory.manage' },
  { label: 'Stock Balances', to: '/inventory', icon: Boxes, tone: 'text-primary', permission: 'inventory.manage' },
]

/** Desktop-style "Inventory Management" ribbon shown on every inventory screen. */
export function InventoryRibbon() {
  const { hasPermission } = useAuth()
  const { pathname } = useLocation()
  const visible = tiles.filter((t) => hasPermission(t.permission))
  const active = visible
    .filter((t) => pathname === t.to || pathname.startsWith(t.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to

  return (
    <div className="rounded-xl border bg-card">
      <div className="no-scrollbar flex gap-1 overflow-x-auto p-1.5">
        {visible.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={cn(
              'flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors hover:bg-muted',
              t.to === active && 'bg-primary/10 text-primary ring-1 ring-primary/30',
            )}
          >
            <t.icon className={cn('size-6', t.tone)} />
            <span className="leading-tight">{t.label}</span>
          </NavLink>
        ))}
      </div>
      <p className="border-t py-0.5 text-center text-[11px] text-muted-foreground">Inventory Management</p>
    </div>
  )
}
