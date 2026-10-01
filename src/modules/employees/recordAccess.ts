// Who can see and edit each part of the employee record. Shown on the page
// ("Who can view?" and the Section access permissions table) and used to hide
// sections from users without the permission. Database RLS still applies on
// top: salary history and loans come from payroll tables that require
// payroll.view, so hiding those sections here matches what the server allows.

export interface SectionAccess {
  key: string
  title: string
  viewers: string
  editors: string
  /** The user needs any one of these to see the section. */
  viewAny: string[]
  /** The user needs any one of these to unlock and edit it. */
  editAny: string[]
}

const HR = ['employees.manage']
const STAFF = ['employees.view', 'employees.manage']
const MONEY = ['payroll.view', 'employees.manage']

export const SECTION_ACCESS: SectionAccess[] = [
  { key: 'profile', title: 'Profile & basic information', viewers: 'Owner + HR + Branch manager', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'visa', title: 'Visa & sponsorship', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'documents', title: 'Employee documents', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'typing', title: 'Typing centre payments', viewers: 'Owner + HR + Accountant', editors: 'Owner, HR', viewAny: MONEY, editAny: HR },
  { key: 'passport', title: 'Passport details', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'insurance', title: 'Health & employment insurance', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'salary', title: 'Employment & salary', viewers: 'Owner + HR + Accountant', editors: 'Owner, HR', viewAny: MONEY, editAny: HR },
  { key: 'probation', title: 'Probation period', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'loans', title: 'Employee loans', viewers: 'Owner + HR + Accountant', editors: 'Owner, HR, Accountant', viewAny: ['payroll.view'], editAny: ['payroll.manage', 'employees.manage'] },
  { key: 'vacation', title: 'Vacation & flight tickets', viewers: 'Owner + HR + Branch manager', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'issues', title: 'Complaints & issues', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'items', title: 'Uniform & accommodation items', viewers: 'Owner + HR + Branch manager', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'labour_fine', title: 'Labour fine details', viewers: 'Owner + HR + Accountant', editors: 'Owner, HR', viewAny: MONEY, editAny: HR },
  { key: 'visit_visa', title: 'Visit visa funding', viewers: 'Owner + HR + Accountant', editors: 'Owner, HR', viewAny: MONEY, editAny: HR },
  { key: 'replacements', title: 'Potential replacements', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'transfers', title: 'Branch transfer history', viewers: 'Owner + HR', editors: 'Automatic (branch changes)', viewAny: STAFF, editAny: [] },
  { key: 'incentives', title: 'Monthly sales & incentives', viewers: 'Owner + HR + Branch manager', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
  { key: 'ledger', title: 'Monthly salary & loan ledger', viewers: 'Owner + HR + Accountant', editors: 'From Payroll', viewAny: ['payroll.view'], editAny: [] },
  { key: 'settlement', title: 'Renewal & settlement', viewers: 'Owner + HR', editors: 'Owner, HR', viewAny: STAFF, editAny: HR },
]

export function sectionAccess(key: string) {
  return SECTION_ACCESS.find((s) => s.key === key)
}
