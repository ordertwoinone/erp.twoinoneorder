import { useEffect, useRef, useState } from 'react'
import { CheckCheck, Loader2, ScanLine, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { LabourListReviewRow, type LabourListRowState } from '../components/LabourListReviewRow'
import { normalizeNationality, workPermitCategoryFromCardType } from '../employeeOptions'
import {
  useConfirmLabourListItem,
  useIgnoreLabourListItem,
  useLabourListImportItemsQuery,
  useScanLabourList,
} from '../hooks/useLabourListScan'

/** Scan rows saved before the MOHRE layout update used person_number / job_type. */
function toRowState(item: any, defaultRestaurantId: string): LabourListRowState {
  const extracted = item.extracted_data ?? {}
  const matchedEmployee = item.employees
  return {
    itemId: item.id,
    matchStatus: item.match_status,
    reviewed: item.reviewed,
    passportNumber: extracted.passport_number ?? null,
    personName: extracted.person_name ?? '',
    personCode: extracted.person_code ?? extracted.person_number ?? null,
    cardType: extracted.card_type ?? extracted.job_type ?? null,
    jobName: extracted.job_name ?? null,
    nationality: extracted.nationality ?? null,
    cardNumber: extracted.card_number ?? null,
    cardExpiry: extracted.card_expiry ?? null,
    cardStatus: extracted.card_status ?? null,
    contractType: extracted.contract_type ?? null,
    civilIdNumber: extracted.civil_id_number ?? null,
    matchReason: extracted.match_reason ?? null,
    isUncertain: !!extracted.is_uncertain,
    confidence: extracted.confidence ?? 0,
    matchedEmployeeId: item.matched_employee_id,
    matchedEmployeeName: matchedEmployee?.full_name ?? null,
    matchedEmployeeCode: matchedEmployee?.employee_code ?? null,
    forceNew: false,
    employeeCode: '',
    restaurantId: matchedEmployee?.current_restaurant_id ?? defaultRestaurantId,
    emiratesIdExpiry: matchedEmployee?.emirates_id_expiry ?? '',
    medicalEntryDate: '',
    lastInCountryDate: '',
    finalStatus: '',
    baseSalary: matchedEmployee?.base_salary != null ? String(matchedEmployee.base_salary) : '',
    labourFine: matchedEmployee?.labour_fine_amount != null ? String(matchedEmployee.labour_fine_amount) : '',
    settlementProofFile: null,
    vacations: [],
    error: null,
  }
}

function confirmInput(row: LabourListRowState) {
  const linked = row.matchedEmployeeId && !row.forceNew
  return {
    itemId: row.itemId,
    employeeId: linked ? row.matchedEmployeeId : null,
    // Blank = the server assigns the next EMP-… code.
    employeeCode: linked ? '' : row.employeeCode.trim(),
    fullName: row.personName.trim(),
    jobTitle: row.jobName,
    restaurantId: row.restaurantId,
    emiratesId: row.civilIdNumber,
    emiratesIdExpiry: row.emiratesIdExpiry || null,
    medicalEntryDate: row.medicalEntryDate || null,
    lastInCountryDate: row.lastInCountryDate || null,
    finalStatus: row.finalStatus || null,
    baseSalary: row.baseSalary ? Number(row.baseSalary) : null,
    labourPersonNumber: row.personCode,
    nationality: normalizeNationality(row.nationality),
    passportNumber: row.passportNumber,
    workPermitNumber: row.cardNumber,
    workPermitCategory: workPermitCategoryFromCardType(row.cardType),
    cardExpiry: row.cardExpiry,
    labourFineAmount: row.labourFine ? Number(row.labourFine) : null,
    vacations: row.vacations
      .filter((v) => v.start_date)
      .map((v) => ({
        start_date: v.start_date,
        end_date: v.end_date || null,
        paid_by: v.paid_by || null,
        amount: v.amount ? Number(v.amount) : null,
        notes: v.notes || null,
      })),
    settlementProofFile: row.settlementProofFile,
  }
}

export default function LabourListScanPage() {
  const { data: restaurants } = useRestaurantsQuery()
  const { selectedRestaurantId } = useRestaurantScope()
  const [restaurantId, setRestaurantId] = useState(selectedRestaurantId ?? '')
  // The restaurant scope can resolve after the first render — take it once it does.
  const [scopeApplied, setScopeApplied] = useState(!!selectedRestaurantId)
  if (!scopeApplied && selectedRestaurantId) {
    setScopeApplied(true)
    if (!restaurantId) setRestaurantId(selectedRestaurantId)
  }
  const [importId, setImportId] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<LabourListRowState[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scanLabourList = useScanLabourList()
  const { data: items, isLoading: isLoadingItems } = useLabourListImportItemsQuery(importId)
  const confirmItem = useConfirmLabourListItem()
  const confirmQuiet = useConfirmLabourListItem({ quiet: true })
  const [confirmingAll, setConfirmingAll] = useState(false)
  const ignoreItem = useIgnoreLabourListItem()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    if (!items) return
    setRows(items.map((item) => toRowState(item, restaurantId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function handleFileSelected(file: File) {
    if (!restaurantId) {
      toast.error('Select the restaurant first', { description: 'New employees from the list are added to this restaurant.' })
      return
    }
    const result = await scanLabourList.mutateAsync({ restaurantId, file })
    setImportId(result.importId)
  }

  function updateRow(itemId: string, patch: Partial<LabourListRowState>) {
    setRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)))
  }

  async function handleConfirm(row: LabourListRowState) {
    setConfirmingId(row.itemId)
    try {
      await confirmItem.mutateAsync(confirmInput(row))
      updateRow(row.itemId, { reviewed: true, error: null })
    } catch (error) {
      updateRow(row.itemId, { error: (error as Error).message })
    } finally {
      setConfirmingId(null)
    }
  }

  /** Saves every row still waiting, one at a time; failures stay in the table with their error. */
  async function handleConfirmAll() {
    const pending = rows.filter((r) => !r.reviewed && r.restaurantId && r.personName.trim())
    setConfirmingAll(true)
    let saved = 0
    let failed = 0
    for (const row of pending) {
      setConfirmingId(row.itemId)
      try {
        await confirmQuiet.mutateAsync(confirmInput(row))
        updateRow(row.itemId, { reviewed: true, error: null })
        saved++
      } catch (error) {
        updateRow(row.itemId, { error: (error as Error).message })
        failed++
      }
    }
    setConfirmingId(null)
    setConfirmingAll(false)
    if (failed) toast.warning(`Saved ${saved}, ${failed} need attention`, { description: 'The rows that failed show the reason in red.' })
    else toast.success(`Saved ${saved} employee${saved === 1 ? '' : 's'}`)
  }

  const pendingCount = rows.filter((r) => !r.reviewed).length
  const counts = {
    existing: rows.filter((r) => !r.reviewed && r.matchedEmployeeId && !r.forceNew && r.matchStatus === 'matched').length,
    check: rows.filter((r) => !r.reviewed && r.matchedEmployeeId && !r.forceNew && r.matchStatus === 'uncertain').length,
    fresh: rows.filter((r) => !r.reviewed && (!r.matchedEmployeeId || r.forceNew)).length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan Labour List"
        description="Upload a MOHRE labour list and review each person before adding or updating them as an employee."
      />

      {!importId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="w-64 space-y-2">
              <Label>Restaurant</Label>
              <Select value={restaurantId} onValueChange={setRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scanLabourList.isPending ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reading labour list…</p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={!restaurantId}>
                  <ScanLine /> Choose file to scan
                </Button>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP — up to 20 MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
                e.target.value = ''
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <p>{isLoadingItems ? 'Loading…' : `${pendingCount} of ${rows.length} people awaiting review`}</p>
                {pendingCount > 0 && (
                  <p className="text-xs">
                    {counts.fresh} new · {counts.existing} already on file · <span className="text-warning-foreground">{counts.check} to check (similar name)</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleConfirmAll} disabled={confirmingAll || pendingCount === 0}>
                  {confirmingAll ? <Loader2 className="animate-spin" /> : <CheckCheck />} Confirm all ({pendingCount})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={confirmingAll}
                  onClick={() => {
                    setImportId(undefined)
                    setRows([])
                  }}
                >
                  Scan another file
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Name / person code</TableHead>
                    <TableHead>Job / card type</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Card no. / expiry</TableHead>
                    <TableHead>Restaurant / Code</TableHead>
                    <TableHead>Last in country</TableHead>
                    <TableHead>Emirates ID expiry</TableHead>
                    <TableHead>Medical entry</TableHead>
                    <TableHead>Final status / Salary / Labour fine</TableHead>
                    <TableHead>Vacations / Settlement</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <LabourListReviewRow
                      key={row.itemId}
                      row={row}
                      restaurants={restaurants ?? []}
                      onChange={(patch) => updateRow(row.itemId, patch)}
                      onConfirm={() => handleConfirm(row)}
                      onIgnore={() => {
                        ignoreItem.mutate(row.itemId)
                        updateRow(row.itemId, { reviewed: true })
                      }}
                      isConfirming={confirmingId === row.itemId || confirmingAll}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
