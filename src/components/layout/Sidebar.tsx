import { NavLink, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { navSections } from './nav-config'

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { hasPermission } = useAuth()
  const { pathname } = useLocation()

  // Highlight only the most specific matching item, so /purchases/new lights
  // up "New Purchase" and not "Invoices" (/purchases) as well.
  const activeTo = navSections
    .flatMap((s) => s.items)
    .filter((item) => (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
      {navSections.map((section) => {
        const items = section.items.filter((item) => !item.permission || hasPermission(item.permission))
        if (items.length === 0) return null
        return (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-2 pb-1 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={() =>
                    cn(
                      'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      item.to === activeTo && 'bg-sidebar-accent text-sidebar-accent-foreground',
                      collapsed && 'justify-center px-0',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <UtensilsCrossed className="size-4" />
        </div>
        {!collapsed && <span className="truncate text-sm font-semibold text-sidebar-foreground">TWOINONEORDER</span>}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-sidebar-foreground/70"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  )
}
