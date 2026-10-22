import type { EmployeeRecordInput } from '@/schemas/employee'
import type { ScannedEmployeeFields } from './hooks/useEmployeeRecord'
import { normalizeNationality } from './employeeOptions'

export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** One field a scan would change on the employee record, for the review dialog. */
export interface ScanFieldChange {
  name: keyof EmployeeRecordInput
  label: string
  group: string
  kind: 'text' | 'date' | 'number'
  current: string
  scanned: string | number
  /** Ticked by default: empty fields and plain data. Name / position / sponsor stay as they are unless ticked. */
  defaultOn: boolean
}

type Mapping = {
  name: keyof EmployeeRecordInput
  label: string
  group: string
  kind: ScanFieldChange['kind']
  value: (f: ScannedEmployeeFields) => string | number | null | undefined
  /** Only suggested ticked when the record has no value yet. */
  onlyIfEmpty?: boolean
}

const titleCase = (v: string | null | undefined) => (v ? v.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : null)

function normalizeGender(v: string | null | undefined) {
  const t = v?.trim().toLowerCase()
  if (!t) return null
  if (t === 'm' || t.startsWith('male')) return 'male'
  if (t === 'f' || t.startsWith('female')) return 'female'
  return null
}

const MAPPINGS: Mapping[] = [
  { name: 'full_name', label: 'Full name', group: 'Profile', kind: 'text', value: (f) => f.full_name, onlyIfEmpty: true },
  { name: 'nationality', label: 'Nationality', group: 'Profile', kind: 'text', value: (f) => normalizeNationality(f.nationality) },
  { name: 'job_title', label: 'Position', group: 'Profile', kind: 'text', value: (f) => f.job_title, onlyIfEmpty: true },
  { name: 'sponsor_name', label: 'Sponsor', group: 'Visa', kind: 'text', value: (f) => f.sponsor_name, onlyIfEmpty: true },

  { name: 'residency_type', label: 'Residency type', group: 'Residency', kind: 'text', value: (f) => f.residency_type },
  { name: 'residency_file_number', label: 'Residency file number', group: 'Residency', kind: 'text', value: (f) => f.residency_file_number },
  { name: 'unified_number', label: 'Unified number (UID)', group: 'Residency', kind: 'text', value: (f) => f.unified_number },
  { name: 'residency_issue_date', label: 'Residency issue date', group: 'Residency', kind: 'date', value: (f) => f.residency_issue_date },
  { name: 'visa_expiry', label: 'Residency expiry date', group: 'Residency', kind: 'date', value: (f) => f.residency_expiry_date },
  { name: 'residency_status', label: 'Residency status', group: 'Residency', kind: 'text', value: (f) => titleCase(f.residency_status) },

  { name: 'emirates_id', label: 'Emirates ID', group: 'Emirates ID', kind: 'text', value: (f) => f.emirates_id_number },
  { name: 'emirates_id_expiry', label: 'Emirates ID expiry', group: 'Emirates ID', kind: 'date', value: (f) => f.emirates_id_expiry },

  { name: 'passport_number', label: 'Passport number', group: 'Passport', kind: 'text', value: (f) => f.passport_number },
  { name: 'passport_type', label: 'Passport type', group: 'Passport', kind: 'text', value: (f) => titleCase(f.passport_type) },
  { name: 'passport_issue_date', label: 'Passport issue date', group: 'Passport', kind: 'date', value: (f) => f.passport_issue_date },
  { name: 'passport_expiry_date', label: 'Passport expiry date', group: 'Passport', kind: 'date', value: (f) => f.passport_expiry_date },
  { name: 'passport_issue_place', label: 'Passport issue place', group: 'Passport', kind: 'text', value: (f) => titleCase(f.passport_issue_place) },

  { name: 'date_of_birth', label: 'Date of birth', group: 'Personal', kind: 'date', value: (f) => f.date_of_birth },
  { name: 'gender', label: 'Gender', group: 'Personal', kind: 'text', value: (f) => normalizeGender(f.gender) },
  { name: 'marital_status', label: 'Marital status', group: 'Personal', kind: 'text', value: (f) => titleCase(f.marital_status) },
  { name: 'place_of_birth', label: 'Place of birth', group: 'Personal', kind: 'text', value: (f) => titleCase(f.place_of_birth) },
  { name: 'birth_country', label: 'Birth country', group: 'Personal', kind: 'text', value: (f) => titleCase(f.birth_country) },
  { name: 'religion', label: 'Religion', group: 'Personal', kind: 'text', value: (f) => titleCase(f.religion) },
  { name: 'mother_name', label: 'Mother’s name', group: 'Personal', kind: 'text', value: (f) => f.mother_name },

  { name: 'work_permit_number', label: 'Work permit number', group: 'Work permit', kind: 'text', value: (f) => f.work_permit_number },
  { name: 'labour_person_number', label: 'Labour person number', group: 'Work permit', kind: 'text', value: (f) => f.labour_person_number },
  { name: 'permit_issue_date', label: 'Permit issue date', group: 'Work permit', kind: 'date', value: (f) => f.permit_issue_date },
  { name: 'labour_permit_expiry', label: 'Labour card expiry', group: 'Work permit', kind: 'date', value: (f) => f.labour_permit_expiry },
  { name: 'work_permit_expiry', label: 'Work permit expiry', group: 'Work permit', kind: 'date', value: (f) => f.labour_permit_expiry, onlyIfEmpty: true },
  { name: 'work_permit_salary', label: 'Work permit salary', group: 'Work permit', kind: 'number', value: (f) => f.work_permit_salary },
  { name: 'medical_expiry_date', label: 'Medical expiry', group: 'Medical', kind: 'date', value: (f) => f.medical_expiry_date },

  { name: 'phone', label: 'UAE mobile', group: 'Contact', kind: 'text', value: (f) => f.uae_mobile },
  { name: 'alternate_phone', label: 'UAE phone', group: 'Contact', kind: 'text', value: (f) => f.uae_phone },
  { name: 'email', label: 'Email', group: 'Contact', kind: 'text', value: (f) => f.email?.toLowerCase() },
  { name: 'uae_address', label: 'Address in UAE', group: 'Contact', kind: 'text', value: (f) => f.uae_address },
  { name: 'home_country_address', label: 'Home country address', group: 'Contact', kind: 'text', value: (f) => f.home_country_address },
  { name: 'home_country_mobile', label: 'Home country mobile', group: 'Contact', kind: 'text', value: (f) => f.home_country_mobile },
]

const comparable = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '')

/** Everything this scan would add or change, given the record's current values. */
export function scannedChanges(fields: ScannedEmployeeFields, current: (name: keyof EmployeeRecordInput) => unknown): ScanFieldChange[] {
  const changes: ScanFieldChange[] = []
  for (const m of MAPPINGS) {
    const raw = m.value(fields)
    if (raw === null || raw === undefined || raw === '') continue
    if (m.kind === 'date' && !isIsoDate(raw)) continue
    if (m.kind === 'number' && !(typeof raw === 'number' && Number.isFinite(raw))) continue
    const scanned = typeof raw === 'string' ? raw.trim() : raw
    const now = current(m.name)
    const currentText = now === null || now === undefined ? '' : String(now)
    if (comparable(currentText) === comparable(scanned)) continue
    changes.push({
      name: m.name,
      label: m.label,
      group: m.group,
      kind: m.kind,
      current: currentText,
      scanned,
      defaultOn: !m.onlyIfEmpty || currentText.trim() === '',
    })
  }
  return changes
}

export const SCANNED_DOCUMENT_LABELS: Record<string, string> = {
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  labour_permit: 'Work permit / labour card',
  medical: 'Medical certificate',
  visa: 'Visa',
  residency: 'Residency record',
  other: 'Document',
}
