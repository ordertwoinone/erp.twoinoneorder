import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Eye, Lock, LockOpen, Paperclip, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Option } from '../../employeeOptions'
import { sectionAccess } from '../../recordAccess'
import { useRecordLock } from './recordLockContext'

export function SectionCard({
  icon: Icon,
  title,
  actions,
  lockKey,
  className,
  children,
}: {
  icon: LucideIcon
  title: ReactNode
  actions?: ReactNode
  /** Section key from recordAccess — adds Locked/Unlock, "Who can view?" and hides it from users without access. */
  lockKey?: string
  className?: string
  children: ReactNode
}) {
  const lock = useRecordLock()
  if (lockKey && !lock.canView(lockKey)) return null
  const access = lockKey ? sectionAccess(lockKey) : undefined
  const unlocked = !lockKey || lock.isUnlocked(lockKey)
  const editable = !lockKey || lock.canEdit(lockKey)

  return (
    <section className={cn('min-w-0 rounded-2xl border bg-card p-5 shadow-sm', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <Icon className="size-6 text-primary" />
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {unlocked && actions}
          {lockKey && !lock.alwaysUnlocked && editable && (
            unlocked ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                <LockOpen className="size-3.5" /> Unlocked
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Lock className="size-3.5" /> Locked
                </span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => lock.requestUnlock(lockKey)}>
                  Unlock to edit
                </Button>
              </>
            )
          )}
          {access && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-tight text-muted-foreground hover:bg-muted">
                  <Eye className="size-3.5" />
                  <Users className="size-3.5" />
                  <span className="hidden sm:block">
                    Who can view?
                    <br />
                    {access.viewers}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Can view: {access.viewers}. Can edit: {access.editors}.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {/* A disabled fieldset disables every input, select and button inside it in one go.
          Links (<a>) stay clickable, so file chips can still be opened in view mode. */}
      <fieldset disabled={!unlocked} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
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
      {/* <a>, not <button>: must stay usable inside a locked (disabled) section. */}
      <a
        href="#"
        role="button"
        className={cn('min-w-0 flex-1 text-left', !onOpen && 'pointer-events-none')}
        onClick={(e) => {
          e.preventDefault()
          onOpen?.()
        }}
      >
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {[ext, size !== undefined ? formatFileSize(size) : null, pending ? 'Uploads on save' : null].filter(Boolean).join(' • ')}
        </p>
      </a>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${name}`}>
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
