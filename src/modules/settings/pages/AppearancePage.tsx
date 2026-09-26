import type { ReactNode } from 'react'
import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ACCENTS, type FontSizeOption, type RadiusOption, type SidebarStyle, type ThemeMode } from '@/lib/theme/theme'

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

function ChoiceCard({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors hover:bg-muted/50',
        selected ? 'border-primary' : 'border-border',
        className,
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
      {children}
    </button>
  )
}

const MODES: { value: ThemeMode; label: string; icon: LucideIcon; preview: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-neutral-200' },
  { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-neutral-900 border-neutral-700' },
  { value: 'system', label: 'System', icon: Monitor, preview: 'bg-gradient-to-r from-white from-50% to-neutral-900 to-50% border-neutral-300' },
]

const SIDEBARS: { value: SidebarStyle; label: string; hint: string }[] = [
  { value: 'light', label: 'Match page', hint: 'Follows light / dark mode' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
  { value: 'accent', label: 'Accent colour', hint: 'Filled with your accent' },
]

const RADII: { value: RadiusOption; label: string; className: string }[] = [
  { value: 'none', label: 'Sharp', className: 'rounded-[2px]' },
  { value: 'default', label: 'Default', className: 'rounded-md' },
  { value: 'large', label: 'Rounded', className: 'rounded-2xl' },
]

const FONT_SIZES: { value: FontSizeOption; label: string; className: string }[] = [
  { value: 'small', label: 'Compact', className: 'text-sm' },
  { value: 'default', label: 'Default', className: 'text-base' },
  { value: 'large', label: 'Large', className: 'text-lg' },
]

export default function AppearancePage() {
  const { prefs, update, reset } = useTheme()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Appearance"
        description="Choose how the app looks on this device. Changes apply instantly and are saved in this browser."
        actions={
          <Button variant="outline" onClick={reset}>
            <RotateCcw /> Reset to default
          </Button>
        }
      />

      <Section title="Theme" description="Light, dark, or follow your device setting.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <ChoiceCard key={m.value} selected={prefs.mode === m.value} onClick={() => update({ mode: m.value })}>
              <div className={cn('mb-3 h-16 rounded-md border', m.preview)} />
              <span className="flex items-center gap-2">
                <m.icon className="size-4" /> {m.label}
              </span>
            </ChoiceCard>
          ))}
        </div>
      </Section>

      <Section title="Accent colour" description="Used for buttons, links, highlights, selected items and focus rings.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => update({ accent: a.value })}
              aria-pressed={prefs.accent === a.value}
              className="group flex flex-col items-center gap-1.5 text-xs font-medium"
            >
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-full border border-black/10 ring-offset-2 ring-offset-background transition-shadow dark:border-white/25',
                  prefs.accent === a.value ? 'ring-2 ring-foreground' : 'group-hover:ring-2 group-hover:ring-border',
                )}
                style={{ background: a.swatch }}
              >
                {prefs.accent === a.value && <Check className="size-5 text-white mix-blend-difference" />}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sidebar" description="Colour of the navigation sidebar.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SIDEBARS.map((s) => (
            <ChoiceCard key={s.value} selected={prefs.sidebar === s.value} onClick={() => update({ sidebar: s.value })}>
              <div className="mb-3 flex h-16 overflow-hidden rounded-md border">
                <div
                  className={cn(
                    'w-1/3 space-y-1.5 p-2',
                    s.value === 'light' && 'bg-card',
                    s.value === 'dark' && 'bg-neutral-800',
                    s.value === 'accent' && 'bg-primary',
                  )}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn('h-1.5 rounded-full', s.value === 'light' ? 'bg-muted-foreground/30' : s.value === 'dark' ? 'bg-white/40' : 'bg-primary-foreground/50')}
                    />
                  ))}
                </div>
                <div className="flex-1 bg-background" />
              </div>
              <span className="block">{s.label}</span>
              <span className="block text-xs font-normal text-muted-foreground">{s.hint}</span>
            </ChoiceCard>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Corners" description="How rounded buttons, fields and cards are.">
          <div className="grid grid-cols-3 gap-3">
            {RADII.map((r) => (
              <ChoiceCard key={r.value} selected={prefs.radius === r.value} onClick={() => update({ radius: r.value })}>
                <div className={cn('mb-2 h-10 w-full border-2 border-primary/60 bg-primary/10', r.className)} />
                {r.label}
              </ChoiceCard>
            ))}
          </div>
        </Section>

        <Section title="Text size" description="Scales text and spacing across the whole app.">
          <div className="grid grid-cols-3 gap-3">
            {FONT_SIZES.map((f) => (
              <ChoiceCard key={f.value} selected={prefs.fontSize === f.value} onClick={() => update({ fontSize: f.value })}>
                <span className={cn('mb-2 block font-semibold', f.className)}>Aa</span>
                {f.label}
              </ChoiceCard>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Preview" description="How common elements look with your choices.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary button</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Delete</Button>
          <Badge>Badge</Badge>
          <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Paid</span>
          <span className="rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">Pending</span>
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Overdue</span>
          <Input className="max-w-56" placeholder="Text field" />
          <a className="text-sm font-medium text-primary hover:underline" href="#preview" onClick={(e) => e.preventDefault()}>
            A link
          </a>
        </div>
      </Section>
    </div>
  )
}
