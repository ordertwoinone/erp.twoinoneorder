import { useRef, useState, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import {
  AlertCircle,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  FileText,
  House,
  IdCard,
  MapPin,
  PenLine,
  Printer,
  ShieldPlus,
  Upload,
  UserRound,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import type { ContractBenefits, EmployeeRecordInput } from '@/schemas/employee'
import { Textarea } from '@/components/ui/textarea'
import {
  CONTRACT_LANGUAGES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  MIN_SERVICE_OPTIONS,
  amountInWords,
  contractProgress,
  defaultEndDate,
  salaryTotal,
  type ContractLanguage,
} from '../../contractUtils'
import { openEmployeeFile, validateDocumentFile } from '../../hooks/useEmployeeRecord'
import { useFilePreview } from '../../hooks/useFilePreview'
import { CameraCaptureDialog, SignaturePadDialog } from './CaptureDialogs'
import { Field, IconInput, SectionCard } from './RecordUi'

interface SavedFile {
  file_name: string
  storage_path: string
}

/** Works while the section is locked (a disabled fieldset swallows real buttons) — used for view / print only. */
function ViewButton({ onClick, className, children }: { onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </span>
  )
}

function Panel({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function ReadOnly({ value }: { value: string }) {
  return <p className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm">{value}</p>
}

export function ContractSection({
  form,
  branchName,
  photoPath,
  contractFile,
  employeeSignaturePath,
  managerSignaturePath,
  onPrint,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  /** Printed as the first party when no employer name is entered. */
  branchName: string
  photoPath: string | null | undefined
  contractFile: SavedFile | null
  employeeSignaturePath: string | null | undefined
  managerSignaturePath: string | null | undefined
  onPrint: (language: ContractLanguage) => void
}) {
  const { register, control, watch, setValue } = form
  const { appContext } = useAuth()
  const [language, setLanguage] = useState<ContractLanguage>('en')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [signing, setSigning] = useState<'employee' | 'manager' | null>(null)
  const contractInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const employeeSigInput = useRef<HTMLInputElement>(null)
  const managerSigInput = useRef<HTMLInputElement>(null)

  const v = watch()
  const progress = contractProgress(v.contract_start_date ?? '', v.contract_end_date ?? '', v.contract_min_service_months)
  const status = CONTRACT_STATUSES.find((s) => s.value === v.contract_status)
  const visaCost = Number(v.company_visa_cost) || 0
  const minMonths = Number(v.contract_min_service_months) || 0
  const benefits = v.contract_benefits
  const setBenefit = <K extends keyof ContractBenefits>(key: K, value: ContractBenefits[K]) =>
    setValue(`contract_benefits.${key}` as const, value as never, { shouldDirty: true })

  const photo = useFilePreview(v.photo_pending_file, v.photo_attachment_id ? photoPath : null)
  const employeeSig = useFilePreview(v.employee_signature_pending_file, v.employee_signature_attachment_id ? employeeSignaturePath : null)
  const managerSig = useFilePreview(v.manager_signature_pending_file, v.manager_signature_attachment_id ? managerSignaturePath : null)
  const pendingContract = v.contract_pending_file instanceof File ? (v.contract_pending_file as File) : null
  const contractShown = pendingContract ? { name: pendingContract.name, size: pendingContract.size } : contractFile && v.contract_attachment_id ? { name: contractFile.file_name, size: null } : null
  const today = format(new Date(), 'yyyy-MM-dd')

  function pickFile(e: React.ChangeEvent<HTMLInputElement>, onFile: (f: File) => void, imagesOnly = false) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (imagesOnly && !file.type.startsWith('image/')) return void toast.error('Choose a JPG, PNG or WebP image')
    const problem = validateDocumentFile(file)
    if (problem) return void toast.error(problem)
    onFile(file)
  }

  function setSignature(who: 'employee' | 'manager', file: File) {
    if (who === 'employee') {
      setValue('employee_signature_pending_file', file, { shouldDirty: true })
      setValue('employee_signed_at', today, { shouldDirty: true })
    } else {
      setValue('manager_signature_pending_file', file, { shouldDirty: true })
      setValue('manager_signed_at', today, { shouldDirty: true })
      if (!form.getValues('manager_signed_by')) setValue('manager_signed_by', appContext?.fullName ?? '', { shouldDirty: true })
    }
  }

  function clearSignature(who: 'employee' | 'manager') {
    if (who === 'employee') {
      setValue('employee_signature_pending_file', undefined, { shouldDirty: true })
      setValue('employee_signature_attachment_id', null, { shouldDirty: true })
      setValue('employee_signed_at', '', { shouldDirty: true })
    } else {
      setValue('manager_signature_pending_file', undefined, { shouldDirty: true })
      setValue('manager_signature_attachment_id', null, { shouldDirty: true })
      setValue('manager_signed_at', '', { shouldDirty: true })
    }
  }

  const benefitRows: { key: keyof ContractBenefits; label: string; icon: LucideIcon; yes: string }[] = [
    { key: 'salary', label: 'Company provides salary', icon: Wallet, yes: 'Yes' },
    { key: 'food', label: 'Free food', icon: Utensils, yes: 'Yes' },
    { key: 'accommodation', label: 'Free accommodation', icon: House, yes: 'Yes' },
    { key: 'transport', label: 'Free transportation', icon: Bus, yes: 'Yes' },
    { key: 'visa_cost', label: 'Employment visa cost (Company)', icon: IdCard, yes: visaCost ? `${formatCurrency(visaCost)} (Covered)` : 'Covered' },
    { key: 'min_service_mandatory', label: minMonths ? `Complete ${minMonths >= 12 && minMonths % 12 === 0 ? `${minMonths / 12} year${minMonths === 12 ? '' : 's'}` : `${minMonths} months`} contract` : 'Complete minimum service', icon: CalendarCheck, yes: 'Mandatory' },
    { key: 'medical_insurance', label: 'Medical insurance', icon: ShieldPlus, yes: 'Yes' },
  ]

  const salary = v.contract_salary
  const total = salaryTotal(salary)
  const currentSalary = Number(v.base_salary) || 0
  const allowanceRows: { key: 'housing' | 'transport' | 'food' | 'other'; flag?: 'housing_by_employer' | 'transport_by_employer' | 'food_by_employer'; label: string; icon: LucideIcon }[] = [
    { key: 'housing', flag: 'housing_by_employer', label: 'Housing allowance', icon: House },
    { key: 'transport', flag: 'transport_by_employer', label: 'Transport allowance', icon: Bus },
    { key: 'food', flag: 'food_by_employer', label: 'Food allowance', icon: Utensils },
    { key: 'other', label: 'Other allowance', icon: Wallet },
  ]

  const signatureBox = (who: 'employee' | 'manager') => {
    const url = who === 'employee' ? employeeSig : managerSig
    const signedAt = who === 'employee' ? v.employee_signed_at : v.manager_signed_at
    const input = who === 'employee' ? employeeSigInput : managerSigInput
    return (
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{who === 'employee' ? 'Employee signature' : 'Manager signature'}</span>
          {url ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Signed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 text-xs font-medium text-white">
              <AlertCircle className="size-3.5" /> Not signed
            </span>
          )}
        </div>
        <div className="flex h-44 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted/20 p-2 text-center">
          {url ? (
            <>
              <img src={url} alt={`${who} signature`} className="max-h-20 max-w-full object-contain" />
              {signedAt && <p className="text-xs text-muted-foreground">Signed on {format(parseISO(signedAt), 'd MMM yyyy')}</p>}
              {who === 'manager' && (
                <Input className="h-7 max-w-44 text-center text-xs" placeholder="Signed by (name)" aria-label="Manager name" {...register('manager_signed_by')} />
              )}
            </>
          ) : (
            <>
              <PenLine className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No signature yet</p>
            </>
          )}
        </div>
        <div className="mt-2 grid gap-1.5">
          <Button type="button" size="sm" onClick={() => setSigning(who)}>
            <PenLine /> {url ? 'Sign again' : 'Sign here'}
          </Button>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => input.current?.click()}>
              <Upload /> {url ? 'Replace' : 'Upload'}
            </Button>
            {url && (
              <Button type="button" size="sm" variant="ghost" onClick={() => clearSignature(who)} aria-label={`Remove ${who} signature`}>
                <X />
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickFile(e, (f) => setSignature(who, f), true)} />
        </div>
      </div>
    )
  }

  return (
    <SectionCard icon={FileText} title="Employment Contract & Company Benefits" lockKey="contract">
      <div className="-mt-2 mb-4 flex flex-wrap items-center justify-end gap-2">
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium">
            <span className={cn('size-2 rounded-full', status.dot)} /> {status.label}
          </span>
        )}
        <ViewButton onClick={() => onPrint(language)} className={buttonVariants({ size: 'sm' })}>
          <Printer /> Print Contract
        </ViewButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel title="Contract Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Contract type">
              <Controller
                control={control}
                name="contract_type"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(t) => {
                      field.onChange(t)
                      const end = defaultEndDate(form.getValues('contract_start_date') ?? '', t)
                      if (end) setValue('contract_end_date', end, { shouldDirty: true })
                      const months = CONTRACT_TYPES.find((c) => c.value === t)?.months
                      if (months && !form.getValues('contract_min_service_months')) setValue('contract_min_service_months', months, { shouldDirty: true })
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Contract start date">
              <IconInput
                icon={CalendarDays}
                type="date"
                {...register('contract_start_date', {
                  onChange: (e) => {
                    const end = defaultEndDate(e.target.value, form.getValues('contract_type') ?? '')
                    if (end) setValue('contract_end_date', end, { shouldDirty: true })
                  },
                })}
              />
            </Field>
            <Field label="Contract end date">
              <IconInput icon={CalendarDays} type="date" {...register('contract_end_date')} />
            </Field>
            <Field label="Contract duration">
              <ReadOnly value={progress?.durationMonths != null ? `${progress.durationMonths} months` : '—'} />
            </Field>
            <Field label="Minimum service required">
              <Controller
                control={control}
                name="contract_min_service_months"
                render={({ field }) => (
                  <Select value={field.value === '' || field.value === undefined ? undefined : String(field.value)} onValueChange={(m) => field.onChange(Number(m))}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {MIN_SERVICE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Contract status">
              <Controller
                control={control}
                name="contract_status"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className={cn('size-2 rounded-full', s.dot)} /> {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Company-paid visa cost (AED)">
              <IconInput icon={IdCard} type="number" step="0.01" min="0" placeholder="0.00" {...register('company_visa_cost')} />
            </Field>
            <Field label="Service completed">
              <ReadOnly value={progress?.completedText ?? '—'} />
            </Field>
            <Field label="Remaining period">
              <ReadOnly value={progress?.remainingText ?? '—'} />
            </Field>
          </div>
          {progress?.ended && v.contract_status === 'active' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
              <CircleAlert className="size-3.5" /> The end date has passed — set the status to Expired or Renewed.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Contract Status">
            {progress ? (
              <>
                <p className="mb-2 text-right text-sm font-medium">
                  {progress.monthsCompleted} / {progress.targetMonths ?? '—'} Months Completed
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className={cn('h-full rounded-full', progress.ended ? 'bg-muted-foreground' : 'bg-success')} style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="mt-2 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-primary">{progress.completedText}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{progress.remainingText}</p>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enter the contract start date to see progress.</p>
            )}
          </Panel>
          {visaCost > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold text-warning-foreground">
                <AlertCircle className="size-4" /> Company Visa Cost Agreement
              </p>
              <p className="text-sm">
                The company has paid <b>{formatCurrency(visaCost)}</b> toward the employee’s visa and employment-related costs.
                {minMonths > 0 && (
                  <>
                    {' '}
                    The employee’s contractual service period is <b>{minMonths >= 12 && minMonths % 12 === 0 ? `${minMonths / 12} year${minMonths === 12 ? '' : 's'} (${minMonths} months)` : `${minMonths} months`}</b>, subject to the
                    signed employment agreement and applicable UAE labour law.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <Panel title="Contract Document">
          {contractShown ? (
            <div className="mb-3 flex items-center gap-3 rounded-lg border p-3">
              <FileText className="size-8 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{contractShown.name}</p>
                <p className="text-xs text-muted-foreground">{contractShown.size ? `${(contractShown.size / 1024 / 1024).toFixed(1)} MB · not saved yet` : 'Saved'}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove contract"
                onClick={() => {
                  setValue('contract_pending_file', undefined, { shouldDirty: true })
                  setValue('contract_attachment_id', null, { shouldDirty: true })
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <p className="mb-3 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No signed contract uploaded yet.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ViewButton
              onClick={() => {
                if (pendingContract) window.open(URL.createObjectURL(pendingContract), '_blank', 'noopener')
                else if (contractFile && v.contract_attachment_id) void openEmployeeFile(contractFile.storage_path)
                else toast.info('Upload the contract first')
              }}
              className={buttonVariants({ size: 'sm' })}
            >
              <FileText /> View contract
            </ViewButton>
            <Button type="button" size="sm" variant="outline" onClick={() => contractInput.current?.click()}>
              <Upload /> {contractShown ? 'Replace' : 'Upload'}
            </Button>
          </div>
          <ViewButton onClick={() => onPrint(language)} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'mt-2 w-full border-success/40 bg-success/5 text-success')}>
            <Printer /> Generate &amp; Print Contract
          </ViewButton>
          <input
            ref={contractInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => pickFile(e, (f) => setValue('contract_pending_file', f, { shouldDirty: true }))}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Panel title={<>First Party <span className="text-sm font-normal text-muted-foreground">(Employer)</span></>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company / employer name" className="sm:col-span-2">
              <IconInput icon={Building2} placeholder={branchName || 'Legal name on the trade licence'} {...register('contract_employer.name')} />
            </Field>
            <Field label="Trade licence no.">
              <Input className="h-10" placeholder="e.g. CN-1234567" {...register('contract_employer.licence_number')} />
            </Field>
            <Field label="MOHRE establishment no.">
              <Input className="h-10" placeholder="e.g. 1234567" {...register('contract_employer.establishment_number')} />
            </Field>
            <Field label="Represented by">
              <Input className="h-10" placeholder="Name" {...register('contract_employer.representative')} />
            </Field>
            <Field label="Representative title">
              <Input className="h-10" placeholder="e.g. Owner / Manager" {...register('contract_employer.representative_title')} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <IconInput icon={MapPin} placeholder="Emirate, area, building" {...register('contract_employer.address')} />
            </Field>
            <Field label="Phone">
              <Input className="h-10" placeholder="+971 …" {...register('contract_employer.phone')} />
            </Field>
            <Field label="MOHRE transaction no.">
              <Input className="h-10" placeholder="e.g. MB123456789AE" {...register('contract_transaction_number')} />
            </Field>
          </div>
          {!v.contract_employer?.name && branchName && <p className="mt-2 text-xs text-muted-foreground">Left blank, the contract prints the branch name “{branchName}”.</p>}
        </Panel>

        <Panel title="Salary Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Basic salary (AED)">
              <IconInput icon={CircleDollarSign} type="number" step="0.01" min="0" placeholder="0.00" {...register('contract_salary.basic')} />
            </Field>
            {allowanceRows.map((a) => {
              const inKind = a.flag ? !!salary?.[a.flag] : false
              return (
                <Field key={a.key} label={`${a.label} (AED)`}>
                  <IconInput
                    icon={a.icon}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={inKind ? 'First party' : '0.00'}
                    readOnly={inKind}
                    className={inKind ? 'bg-muted/50' : undefined}
                    {...register(`contract_salary.${a.key}`)}
                  />
                  {a.flag && (
                    <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        className="scale-75"
                        checked={inKind}
                        onCheckedChange={(on) => {
                          setValue(`contract_salary.${a.flag!}`, on, { shouldDirty: true })
                          if (on) setValue(`contract_salary.${a.key}`, '', { shouldDirty: true })
                        }}
                        aria-label={`${a.label} provided by first party`}
                      />
                      Provided by first party
                    </label>
                  )}
                </Field>
              )
            })}
          </div>
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">Total monthly salary</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
            </div>
            {total > 0 && <p className="text-xs text-muted-foreground">AED {amountInWords(total)}</p>}
          </div>
          {currentSalary > 0 && total > 0 && Math.abs(currentSalary - total) > 0.005 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground">
              <CircleAlert className="size-3.5" /> Current salary in Employment &amp; salary is {formatCurrency(currentSalary)}.
            </p>
          )}
        </Panel>

        <Panel title="Notes">
          <Textarea
            rows={11}
            placeholder="Additional terms or notes to print on the contract, e.g. working hours, leave, notice period…"
            aria-label="Contract notes"
            {...register('contract_notes')}
          />
          <p className="mt-2 text-xs text-muted-foreground">Printed on the contract as “Additional Terms”.</p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title={<>Employee Photo <span className="text-sm font-normal text-muted-foreground">(live capture)</span></>} className="bg-primary/5">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border bg-card">
              {photo ? <img src={photo} alt="Employee" className="size-full object-cover" /> : <UserRound className="size-12 text-muted-foreground/40" />}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-card text-primary hover:bg-primary/5 disabled:opacity-50"
                aria-label="Open camera"
              >
                <Camera className="size-10" />
              </button>
              <Button type="button" size="sm" onClick={() => setCameraOpen(true)}>
                <Camera /> Capture photo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => photoInput.current?.click()}>
                <Upload /> Upload photo
              </Button>
              <input
                ref={photoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e, (f) => setValue('photo_pending_file', f, { shouldDirty: true }), true)}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Signatures">
          <div className="grid gap-4 sm:grid-cols-2">
            {signatureBox('employee')}
            {signatureBox('manager')}
          </div>
        </Panel>

        <Panel title="Contract Terms & Company Benefits">
          <div className="divide-y rounded-lg border">
            {benefitRows.map((row) => (
              <div key={row.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                <row.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{row.label}</span>
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', benefits?.[row.key] ? 'text-success' : 'text-muted-foreground')}>
                  {benefits?.[row.key] ? (
                    <>
                      <CheckCircle2 className="size-4" />
                      {row.key === 'medical_insurance' && benefits.medical_insurance_term ? `${benefits.medical_insurance_term} (provided by company)` : row.yes}
                    </>
                  ) : (
                    'No'
                  )}
                </span>
                <Switch checked={!!benefits?.[row.key]} onCheckedChange={(on) => setBenefit(row.key, on as never)} aria-label={row.label} />
              </div>
            ))}
          </div>
          {benefits?.medical_insurance && (
            <Input className="mt-2 h-8 text-xs" placeholder="Medical insurance term, e.g. 1 Year" aria-label="Medical insurance term" {...register('contract_benefits.medical_insurance_term')} />
          )}
          <Input className="mt-2 h-8 text-xs" placeholder="Other benefits (optional)" aria-label="Other benefits" {...register('contract_benefits.other')} />
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <FileText className="size-7 text-primary" />
          <div>
            <p className="font-semibold">Contract Summary for Print</p>
            <p className="text-sm text-muted-foreground">Generate a complete employment contract with all details, benefits and signatures.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-xs text-muted-foreground">
            Print language
            {/* Pills, not a <select>: they must work while the section is locked. */}
            <div className="mt-1 flex rounded-lg border bg-muted/40 p-0.5" role="radiogroup" aria-label="Print language">
              {CONTRACT_LANGUAGES.map((l) => (
                <ViewButton
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    language === l.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.label}
                </ViewButton>
              ))}
            </div>
          </div>
          <ViewButton onClick={() => onPrint(language)} className={buttonVariants()}>
            <Printer /> Generate &amp; Print Contract
          </ViewButton>
        </div>
      </div>

      <CameraCaptureDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(f) => setValue('photo_pending_file', f, { shouldDirty: true })} />
      <SignaturePadDialog
        open={!!signing}
        title={signing === 'manager' ? 'Manager signature' : 'Employee signature'}
        onClose={() => setSigning(null)}
        onSave={(f) => signing && setSignature(signing, f)}
      />
    </SectionCard>
  )
}
