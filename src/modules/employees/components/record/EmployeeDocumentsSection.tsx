import { useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { AlertTriangle, CalendarDays, ChevronDown, FileText, Hash, IdCard, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import { DOCUMENT_TYPES, PRESENCE_STATUSES, optionLabel } from '../../employeeOptions'
import { openEmployeeFile } from '../../hooks/useEmployeeRecord'
import { Field, FileChip, IconInput, OptionSelect, SectionCard } from './RecordUi'

const TABS = [{ value: 'all', label: 'All' }, ...DOCUMENT_TYPES.filter((t) => !['visa', 'other'].includes(t.value))]

const EXPIRY_ALERTS: { field: keyof EmployeeRecordInput; label: string; fineNote?: boolean }[] = [
  { field: 'labour_permit_expiry', label: 'Labour permit', fineNote: true },
  { field: 'work_permit_expiry', label: 'Work permit', fineNote: true },
  { field: 'emirates_id_expiry', label: 'Emirates ID' },
  { field: 'passport_expiry_date', label: 'Passport' },
  { field: 'medical_expiry_date', label: 'Medical' },
  { field: 'health_insurance_expiry', label: 'Health insurance' },
]

function expiryMessage(label: string, value: string, today: Date) {
  const date = parseISO(value)
  if (!isValid(date)) return null
  const days = differenceInCalendarDays(date, today)
  if (days < 0) return { tone: 'expired' as const, text: `${label} expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago` }
  if (days === 0) return { tone: 'expired' as const, text: `${label} expires today` }
  if (days <= 30) return { tone: 'soon' as const, text: `${label} expires in ${days} day${days === 1 ? '' : 's'} (${format(date, 'd MMM yyyy')})` }
  return null
}

export function EmployeeDocumentsSection({
  form,
  documents,
  docFilter,
  onDocFilterChange,
  onAttach,
  onRemove,
  onScan,
  scanning,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  documents: EmployeeDocumentItem[]
  docFilter: string
  onDocFilterChange: (value: string) => void
  onAttach: (files: File[], documentType: string) => void
  onRemove: (key: string) => void
  onScan: (files: File[]) => void
  scanning: boolean
}) {
  const { register, control, watch, setValue, getValues } = form
  const attachInputRef = useRef<HTMLInputElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [attachType, setAttachType] = useState('other')
  const [dismissed, setDismissed] = useState<string[]>([])

  const today = new Date()
  const alerts = EXPIRY_ALERTS.flatMap(({ field, label, fineNote }) => {
    const value = watch(field) as string | undefined
    if (!value || (field === 'work_permit_expiry' && !watch('work_permit_expiry_available'))) return []
    const message = expiryMessage(label, value, today)
    if (!message || dismissed.includes(field)) return []
    return [{ field, ...message, fineNote: fineNote && message.tone === 'expired' }]
  })

  const visible = docFilter === 'all' ? documents : documents.filter((d) => d.document_type === docFilter)

  function pickFiles(type: string) {
    setAttachType(type)
    attachInputRef.current?.click()
  }

  return (
    <SectionCard
      icon={FileText}
      title="Employee documents"
      actions={
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <div className="flex">
              <Button type="button" className="rounded-r-none" onClick={() => pickFiles(docFilter === 'all' ? 'other' : docFilter)}>
                <Plus /> Attach document
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" className="rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="Choose document type">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {DOCUMENT_TYPES.map((t) => (
                    <DropdownMenuItem key={t.value} onSelect={() => pickFiles(t.value)}>
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Select multiple files (PDF, JPG, PNG)</p>
          </div>
          <Button type="button" variant="outline" onClick={() => scanInputRef.current?.click()} disabled={scanning}>
            {scanning ? <Loader2 className="animate-spin" /> : <Sparkles className="text-primary" />}
            {scanning ? 'Scanning…' : 'AI Scan documents'}
          </Button>
          <input
            ref={attachInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) onAttach(files, attachType)
              e.target.value = ''
            }}
          />
          <input
            ref={scanInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) onScan(files)
              e.target.value = ''
            }}
          />
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = t.value === 'all' ? documents.length : documents.filter((d) => d.document_type === t.value).length
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onDocFilterChange(t.value)}
              className={cn(
                'rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors',
                docFilter === t.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {visible.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => (
            <div key={d.key}>
              <FileChip
                name={d.file_name}
                size={d.file_size_bytes}
                pending={!!d.pending_file}
                onOpen={d.storage_path ? () => openEmployeeFile(d.storage_path!) : undefined}
                onRemove={() => onRemove(d.key)}
              />
              {docFilter === 'all' && (
                <p className="mt-1 pl-1 text-[11px] text-muted-foreground">{optionLabel(DOCUMENT_TYPES, d.document_type)}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No {docFilter === 'all' ? '' : `${optionLabel(DOCUMENT_TYPES, docFilter).toLowerCase()} `}documents attached yet.
        </p>
      )}

      {alerts.map((alert) => (
        <div
          key={alert.field}
          className={cn(
            'mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium',
            alert.tone === 'expired'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/40 bg-warning/10 text-warning-foreground',
          )}
        >
          <AlertTriangle className="size-5 shrink-0" />
          <span className="flex-1">
            {alert.text}
            {alert.fineNote && <span> • Fine calculation requires verification</span>}
          </span>
          <button type="button" onClick={() => setDismissed((d) => [...d, alert.field])} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Labour expiry date">
          <IconInput icon={CalendarDays} type="date" {...register('labour_permit_expiry')} />
        </Field>
        <Field label="Permit issue date">
          <IconInput icon={CalendarDays} type="date" {...register('permit_issue_date')} />
        </Field>
        <Field label="Medical expiry date">
          <IconInput icon={CalendarDays} type="date" {...register('medical_expiry_date')} />
        </Field>
        <Field label="Emirates ID expiry">
          <IconInput icon={CalendarDays} type="date" {...register('emirates_id_expiry')} />
        </Field>
        <Field label="Last exit date">
          <IconInput icon={CalendarDays} type="date" {...register('last_exit_date')} />
        </Field>
        <Field label="Current status">
          <Controller
            control={control}
            name="presence_status"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={PRESENCE_STATUSES} placeholder="Select status" />
            )}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Emirates ID number">
          <IconInput icon={IdCard} placeholder="784-XXXX-XXXXXXX-X" {...register('emirates_id')} />
        </Field>
        <Field label="Labour list no.">
          <IconInput icon={Hash} placeholder="Person number on MOHRE list" {...register('labour_person_number')} />
        </Field>
        <Field label="Medical entry date">
          <IconInput icon={CalendarDays} type="date" {...register('medical_entry_date')} />
        </Field>
        <Field label="Last in country" hint="Sets Emirates ID expiry to +27 days if that's blank.">
          <IconInput
            icon={CalendarDays}
            type="date"
            {...register('last_in_country_date', {
              onChange: (e) => {
                const value = e.target.value as string
                const parsed = parseISO(value)
                if (value && isValid(parsed) && !getValues('emirates_id_expiry')) {
                  setValue('emirates_id_expiry', format(addDays(parsed, 27), 'yyyy-MM-dd'), { shouldDirty: true })
                }
              },
            })}
          />
        </Field>
      </div>
    </SectionCard>
  )
}
