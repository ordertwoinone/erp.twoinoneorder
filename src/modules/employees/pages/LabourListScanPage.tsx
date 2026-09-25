import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanLine, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { LabourListReviewRow, type LabourListRowState } from '../components/LabourListReviewRow'
import {
  useConfirmLabourListItem,
  useIgnoreLabourListItem,
  useLabourListImportItemsQuery,
  useScanLabourList,
} from '../hooks/useLabourListScan'

function toRowState(item: any, defaultRestaurantId: string): LabourListRowState {
  const extracted = item.extracted_data ?? {}
  const matchedEmployee = item.employees
  return {
    itemId: item.id,
    matchStatus: item.match_status,
    reviewed: item.reviewed,
    personNumber: extracted.person_number ?? null,
    personName: extracted.person_name ?? '',
    jobType: extracted.job_type ?? null,
    jobName: extracted.job_name ?? null,
    nationality: extracted.nationality ?? null,
    civilIdNumber: extracted.civil_id_number ?? null,
    contractType: extracted.contract_type ?? null,
    isUncertain: !!extracted.is_uncertain,
    confidence: extracted.confidence ?? 0,
    matchedEmployeeId: item.matched_employee_id,
    matchedEmployeeName: matchedEmployee?.full_name ?? null,
    employeeCode: matchedEmployee?.employee_code ?? extracted.person_number ?? '',
    restaurantId: matchedEmployee?.current_restaurant_id ?? defaultRestaurantId,
    emiratesIdExpiry: matchedEmployee?.emirates_id_expiry ?? '',
    medicalEntryDate: '',
    lastInCountryDate: '',
    finalStatus: '',
    baseSalary: matchedEmployee?.base_salary != null ? String(matchedEmployee.base_salary) : '',
    settlementProofFile: null,
    vacations: [],
  }
}

export default function LabourListScanPage() {
  const { data: restaurants } = useRestaurantsQuery()
  const { selectedRestaurantId } = useRestaurantScope()
  const [restaurantId, setRestaurantId] = useState(selectedRestaurantId ?? '')
  const [importId, setImportId] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<LabourListRowState[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scanLabourList = useScanLabourList()
  const { data: items, isLoading: isLoadingItems } = useLabourListImportItemsQuery(importId)
  const confirmItem = useConfirmLabourListItem()
  const ignoreItem = useIgnoreLabourListItem()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    if (!items) return
    setRows(items.map((item) => toRowState(item, restaurantId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function handleFileSelected(file: File) {
    if (!restaurantId) return
    const result = await scanLabourList.mutateAsync({ restaurantId, file })
    setImportId(result.importId)
  }

  function updateRow(itemId: string, patch: Partial<LabourListRowState>) {
    setRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)))
  }

  async function handleConfirm(row: LabourListRowState) {
    setConfirmingId(row.itemId)
    try {
      await confirmItem.mutateAsync({
        itemId: row.itemId,
        employeeId: row.matchedEmployeeId,
        employeeCode: row.employeeCode || row.personNumber || row.personName,
        fullName: row.personName,
        jobTitle: row.jobName || row.jobType,
        restaurantId: row.restaurantId,
        emiratesId: row.civilIdNumber,
        emiratesIdExpiry: row.emiratesIdExpiry || null,
        medicalEntryDate: row.medicalEntryDate || null,
        lastInCountryDate: row.lastInCountryDate || null,
        finalStatus: row.finalStatus || null,
        baseSalary: row.baseSalary ? Number(row.baseSalary) : null,
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
      })
      updateRow(row.itemId, { reviewed: true })
    } finally {
      setConfirmingId(null)
    }
  }

  const pendingCount = rows.filter((r) => !r.reviewed).length

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
              <p className="text-sm text-muted-foreground">
                {isLoadingItems ? 'Loading…' : `${pendingCount} of ${rows.length} people awaiting review`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportId(undefined)
                  setRows([])
                }}
              >
                Scan another file
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Person #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Civil ID</TableHead>
                    <TableHead>Restaurant / Code</TableHead>
                    <TableHead>Last in country</TableHead>
                    <TableHead>Emirates ID expiry</TableHead>
                    <TableHead>Medical entry</TableHead>
                    <TableHead>Final status / Salary</TableHead>
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
                      isConfirming={confirmingId === row.itemId}
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
