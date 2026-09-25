import { useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { CalendarDays, ClipboardList, FileText, Info, Loader2, Paperclip, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EmployeeDocumentItem, EmployeeRecordInput } from '@/schemas/employee'
import { DECISIONS, SETTLEMENT_DOCUMENT_TYPES, SETTLEMENT_STATUSES } from '../../employeeOptions'
import { openEmployeeFile } from '../../hooks/useEmployeeRecord'
import { Field, FileChip, IconInput, OptionSelect, SectionCard } from './RecordUi'

export function RenewalSettlementSection({
  form,
  settlementDocs,
  onAttachProof,
  onRemoveDoc,
  saving,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  settlementDocs: EmployeeDocumentItem[]
  onAttachProof: (files: File[]) => void
  onRemoveDoc: (key: string) => void
  saving: boolean
}) {
  const { register, control, formState } = form
  const proofInputRef = useRef<HTMLInputElement>(null)

  return (
    <SectionCard icon={FileText} title="Renewal & settlement">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Decision date">
          <IconInput icon={CalendarDays} type="date" {...register('decision_date')} />
        </Field>
        <Field label="Decision">
          <Controller
            control={control}
            name="final_status"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={DECISIONS} placeholder="Renew / Cancel" />
            )}
          />
        </Field>
        <Field label="Settlement date">
          <IconInput icon={CalendarDays} type="date" {...register('settlement_date')} />
        </Field>
        <Field label="Settlement amount (AED)" error={formState.errors.settlement_amount?.message}>
          <Input className="h-10" type="number" step="0.01" min="0" placeholder="Enter amount" {...register('settlement_amount')} />
        </Field>
        <Field label="Labour fine amount (AED)" error={formState.errors.labour_fine_amount?.message}>
          <div className="relative">
            <Input className="h-10 pr-9" type="number" step="0.01" min="0" placeholder="Pending verification" {...register('labour_fine_amount')} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" aria-label="About labour fines">
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Enter the fine shown on MOHRE / ICP after verifying it there. The system doesn't calculate fines — leave blank while pending verification.
              </TooltipContent>
            </Tooltip>
          </div>
        </Field>
        <Field label="Settlement status">
          <Controller
            control={control}
            name="settlement_status"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={SETTLEMENT_STATUSES} placeholder="Select status" />
            )}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_2fr]">
        <Field label="Settlement proof (attach multiple files)">
          <button
            type="button"
            onClick={() => proofInputRef.current?.click()}
            className="flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
          >
            <Paperclip className="size-4 shrink-0 text-primary" />
            <span className="flex-1 truncate">Choose receipt, payment proof or settlement agreement</span>
            <Plus className="size-4 text-primary" />
          </button>
          <input
            ref={proofInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) onAttachProof(files)
              e.target.value = ''
            }}
          />
          {settlementDocs.length > 0 && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {settlementDocs.map((d) => (
                <FileChip
                  key={d.key}
                  name={d.file_name}
                  size={d.file_size_bytes}
                  pending={!!d.pending_file}
                  onOpen={d.storage_path ? () => openEmployeeFile(d.storage_path!) : undefined}
                  onRemove={() => onRemoveDoc(d.key)}
                />
              ))}
            </div>
          )}
        </Field>
        <Field label="Document type">
          <Controller
            control={control}
            name="settlement_document_type"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={SETTLEMENT_DOCUMENT_TYPES} placeholder="Select document type" />
            )}
          />
        </Field>
        <Field label="Settlement reference / notes">
          <IconInput icon={ClipboardList} placeholder="Enter transaction number or settlement details" {...register('settlement_reference')} />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 items-end gap-4 lg:grid-cols-[1fr_auto]">
        <Field label="Notes / document remarks">
          <Textarea className="min-h-20" placeholder="Add notes, internal remarks or reason for renewal / cancellation" {...register('renewal_notes')} />
        </Field>
        <Button type="submit" size="lg" className="h-12 px-8" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save record
        </Button>
      </div>
    </SectionCard>
  )
}
