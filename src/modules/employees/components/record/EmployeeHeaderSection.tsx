import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { format, intervalToDuration, isValid, parseISO } from 'date-fns'
import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Camera,
  Eye,
  FileWarning,
  IdCard,
  Info,
  Loader2,
  LockKeyhole,
  Pencil,
  Search,
  ShoppingBag,
  Star,
  Stethoscope,
  TrendingUp,
  User,
  UserRound,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { searchEmployees, useSignedFileUrl, validateDocumentFile } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, OptionSelect } from './RecordUi'
import { useRecordLock } from './recordLockContext'
import { daysUntil, num, shortDate } from './recordUtils'

type Match = Awaited<ReturnType<typeof searchEmployees>>[number]

/** Top bar: page title + View / Edit mode switch. */
export function RecordModeBar({ isNew }: { isNew: boolean }) {
  const lock = useRecordLock()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-3 shadow-sm">
      <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
        <UserRound className="size-7 text-primary" /> Employee Details / Renewal &amp; Settlement
      </h1>
      {isNew ? (
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">New employee — all sections editable</span>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border p-0.5">
            <Button type="button" size="sm" variant={lock.anyUnlocked ? 'ghost' : 'default'} onClick={lock.lockAll}>
              <Eye /> View mode
            </Button>
            <Button type="button" size="sm" variant={lock.anyUnlocked ? 'default' : 'ghost'} onClick={() => lock.requestUnlock('all')}>
              <Pencil /> Edit mode <LockKeyhole className="size-3.5" />
            </Button>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 text-primary" /> Password required to edit
          </span>
        </div>
      )}
    </div>
  )
}

function useObjectUrl(file: unknown) {
  const url = useMemo(() => (file instanceof File ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}

export function EmployeeHeaderSection({
  form,
  restaurants,
  photoPath,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  restaurants: RestaurantOption[]
  photoPath: string | null | undefined
}) {
  const navigate = useNavigate()
  const lock = useRecordLock()
  const unlocked = lock.isUnlocked('profile')
  const { register, control, getValues, setValue, watch, formState } = form
  const [matches, setMatches] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)
  const pendingPhoto = useObjectUrl(watch('photo_pending_file'))
  const { data: savedPhoto } = useSignedFileUrl(pendingPhoto ? null : photoPath)
  const photo = pendingPhoto ?? savedPhoto

  async function handleSearch() {
    const term = getValues('employee_code') || getValues('full_name')
    if (!term?.trim()) return void toast.info('Type an employee name or ID to search')
    setSearching(true)
    try {
      const found = await searchEmployees(term, getValues('id'))
      if (found.length === 0) toast.info('No existing employee found — fill in the form to add a new one.')
      else if (found.length === 1) navigate(`/employees/${found[0].id}`)
      else setMatches(found)
    } catch (error) {
      toast.error('Search failed', { description: (error as Error).message })
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <User className="size-6 text-primary" /> Profile
            </h2>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" /> As of {format(new Date(), 'd MMM yyyy')}
            </span>
          </div>
          <fieldset disabled={!unlocked} className="m-0 min-w-0 border-0 p-0">
            <Popover open={matches.length > 0} onOpenChange={(open) => !open && setMatches([])}>
              <PopoverAnchor asChild>
                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
                  <Field label="Employee name" error={formState.errors.full_name?.message}>
                    <IconInput icon={User} placeholder="Full name" {...register('full_name')} />
                  </Field>
                  <Field label="Employee ID">
                    <IconInput icon={IdCard} placeholder="Auto-generated if blank" {...register('employee_code')} />
                  </Field>
                  <Field label="Current role">
                    <IconInput icon={Briefcase} placeholder="e.g. Waiter" {...register('job_title')} />
                  </Field>
                  <Field label="Branch" error={formState.errors.current_restaurant_id?.message}>
                    <Controller
                      control={control}
                      name="current_restaurant_id"
                      render={({ field }) => (
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                          <OptionSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={restaurants.map((r) => ({ value: r.id, label: r.name }))}
                            placeholder="Select branch"
                            className="pl-9"
                          />
                        </div>
                      )}
                    />
                  </Field>
                  <Button type="button" size="icon" className="size-10" onClick={handleSearch} disabled={searching} aria-label="Find employee">
                    {searching ? <Loader2 className="animate-spin" /> : <Search />}
                  </Button>
                </div>
              </PopoverAnchor>
              <PopoverContent align="end" className="w-80 p-1">
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Existing employees matching your search</p>
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => navigate(`/employees/${m.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate font-medium">{m.full_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.employee_code} · {m.restaurants?.name ?? '—'}
                    </span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </fieldset>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {photo ? <img src={photo} alt="Employee" className="size-full object-cover" /> : <UserRound className="size-12 text-muted-foreground/50" />}
          </div>
          <div className="space-y-2">
            {!lock.alwaysUnlocked && (
              <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', unlocked ? 'border-success/30 bg-success/10 text-success' : 'text-muted-foreground')}>
                <span className={cn('size-2 rounded-full', unlocked ? 'bg-success' : 'bg-muted-foreground')} />
                {unlocked ? 'Unlocked' : 'Locked'}
              </span>
            )}
            <label className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border border-primary/40 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5', !unlocked && 'pointer-events-none opacity-50')}>
              <Camera className="size-4" /> {photo ? 'Change photo' : 'Attach passport photo'}
              <input
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={!unlocked}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  if (!file.type.startsWith('image/')) return void toast.error('Choose a JPG, PNG or WebP photo')
                  const problem = validateDocumentFile(file)
                  if (problem) return void toast.error(problem)
                  setValue('photo_pending_file', file, { shouldDirty: true })
                }}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">JPG / PNG (max 2 MB)</p>
          </div>
        </div>
      </div>
    </section>
  )
}

type Tone = 'default' | 'danger' | 'warning' | 'success'

function Kpi({ icon: Icon, label, value, sub, tone = 'default' }: { icon: typeof Star; label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border bg-card p-3 shadow-sm',
        tone === 'danger' && 'border-destructive/30 bg-destructive/5',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn('size-4 text-primary', tone === 'danger' && 'text-destructive')} /> {label}
      </p>
      <p className={cn('mt-1 text-base leading-tight font-bold tabular-nums sm:text-lg', tone === 'danger' && 'text-destructive', tone === 'success' && 'text-success')}>{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function expiryKpi(date: string | undefined, label: string) {
  const days = daysUntil(date)
  if (days === null) return { value: '—', sub: `No ${label} date`, tone: 'default' as Tone }
  if (days < 0) return { value: 'Expired', sub: shortDate(date), tone: 'danger' as Tone }
  return { value: shortDate(date), sub: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: (days <= 30 ? 'warning' : 'default') as Tone }
}

/** Summary cards across the top, all computed live from the form. */
export function EmployeeKpiStrip({ form }: { form: UseFormReturn<EmployeeRecordInput> }) {
  const { watch } = form
  const joining = watch('joining_date')
  const rating = watch('performance_rating')
  const records = watch('monthly_records')
  const latest = useMemo(() => [...records].filter((r) => r.period_month).sort((a, b) => b.period_month.localeCompare(a.period_month))[0], [records])

  const start = joining ? parseISO(joining) : null
  const service = start && isValid(start) ? intervalToDuration({ start, end: new Date() }) : null
  const serviceText = service
    ? [service.years && `${service.years}y`, `${service.months ?? 0} month${service.months === 1 ? '' : 's'}`, `${service.days ?? 0} day${service.days === 1 ? '' : 's'}`].filter(Boolean).join(' ')
    : '—'
  const hasAttendance = !!latest && latest.attendance_days !== '' && latest.attendance_days !== undefined && num(latest.working_days) > 0
  const attendance = hasAttendance ? `${num(latest.attendance_days)} / ${num(latest.working_days)} days` : '—'
  const attendanceRate = hasAttendance ? Math.round((num(latest.attendance_days) / num(latest.working_days)) * 100) : null
  const monthLabel = latest ? shortDate(`${latest.period_month}-01`, 'MMMM yyyy') : 'No monthly record'

  const labour = expiryKpi(watch('labour_permit_expiry'), 'labour permit')
  const eid = expiryKpi(watch('emirates_id_expiry'), 'Emirates ID')
  const medical = expiryKpi(watch('medical_expiry_date'), 'medical')

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      <Kpi icon={CalendarCheck2} label="Service completed" value={serviceText} sub={start && isValid(start) ? `Joining: ${shortDate(joining)}` : 'Set joining date in Probation'} />
      <Kpi icon={BadgeCheck} label="Attendance" value={attendance} sub={attendanceRate !== null ? `${attendanceRate}% attendance rate` : monthLabel} />
      <Kpi icon={Star} label="Performance rating" value={rating === '' || rating === undefined ? '—' : `${num(rating).toFixed(1)} / 5`} sub="Attendance + performance" />
      <Kpi icon={TrendingUp} label="Monthly sales" value={latest && latest.eligible_sales !== '' ? formatCurrency(num(latest.eligible_sales)) : '—'} sub={monthLabel} />
      <Kpi icon={ShoppingBag} label="Total orders" value={latest && latest.orders_count !== '' ? String(num(latest.orders_count)) : '—'} sub={monthLabel} />
      <Kpi icon={FileWarning} label="Labour permit" {...labour} />
      <Kpi icon={IdCard} label="Emirates ID" {...eid} />
      <Kpi icon={Stethoscope} label="Medical" {...medical} />
    </div>
  )
}
