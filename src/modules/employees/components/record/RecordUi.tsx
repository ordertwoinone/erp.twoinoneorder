import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Paperclip, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Option } from '../../employeeOptions'

export function SectionCard({
  icon: Icon,
  title,
  actions,
  children,
}: {
  icon: LucideIcon
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <Icon className="size-6 text-primary" />
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, error, hint, className, children }: { label: ReactNode; error?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-[13px] font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function IconInput({ icon: Icon, className, ...props }: ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn('h-10 pl-9', className)} {...props} />
    </div>
  )
}

export function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string | undefined
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
  className?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={cn('h-10 w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Two-option pill toggle (Yes/No, Claimed/Not claimed). */
export function SegmentedToggle({
  value,
  onChange,
  options,
}: {
  value: boolean
  onChange: (value: boolean) => void
  options: [{ label: string; value: true }, { label: string; value: false }] | [{ label: string; value: false }, { label: string; value: true }]
}) {
  return (
    <div className="grid h-10 grid-cols-2 rounded-lg border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md text-sm font-medium transition-colors',
            value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function FileChip({
  name,
  size,
  pending,
  onOpen,
  onRemove,
}: {
  name: string
  size?: number
  pending?: boolean
  onOpen?: () => void
  onRemove?: () => void
}) {
  const ext = name.split('.').pop()?.toUpperCase()
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <Paperclip className="size-5 shrink-0 text-primary" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen} disabled={!onOpen}>
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {[ext, size !== undefined ? formatFileSize(size) : null, pending ? 'Uploads on save' : null].filter(Boolean).join(' • ')}
        </p>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${name}`}>
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
