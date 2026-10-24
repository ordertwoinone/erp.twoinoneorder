import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { UseFormReturn } from 'react-hook-form'
import { format, parseISO, isValid } from 'date-fns'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { CONTRACT_STATUSES, CONTRACT_TYPES, contractProgress, type ContractLanguage } from '../../contractUtils'

type Bi = readonly [en: string, ar: string]

const T = {
  title: ['Employment Contract', 'عقد عمل'],
  subtitle: ['Summary of the agreed terms and company benefits', 'ملخص الشروط المتفق عليها والمزايا المقدمة من الشركة'],
  parties: ['1. Parties', '١. أطراف العقد'],
  employer: ['First party (Employer)', 'الطرف الأول (صاحب العمل)'],
  employee: ['Second party (Employee)', 'الطرف الثاني (الموظف)'],
  name: ['Name', 'الاسم'],
  employeeId: ['Employee ID', 'الرقم الوظيفي'],
  nationality: ['Nationality', 'الجنسية'],
  passport: ['Passport No.', 'رقم جواز السفر'],
  emiratesId: ['Emirates ID No.', 'رقم الهوية الإماراتية'],
  uid: ['Unified No. (UID)', 'الرقم الموحد'],
  dob: ['Date of birth', 'تاريخ الميلاد'],
  jobTitle: ['Job title', 'المسمى الوظيفي'],
  mobile: ['Mobile', 'رقم الهاتف المتحرك'],
  terms: ['2. Contract terms', '٢. شروط العقد'],
  type: ['Contract type', 'نوع العقد'],
  start: ['Start date', 'تاريخ بداية العقد'],
  end: ['End date', 'تاريخ انتهاء العقد'],
  duration: ['Duration', 'مدة العقد'],
  minService: ['Minimum service', 'الحد الأدنى لمدة الخدمة'],
  salary: ['Monthly basic salary', 'الراتب الأساسي الشهري'],
  status: ['Status', 'حالة العقد'],
  benefits: ['3. Company benefits', '٣. المزايا التي تقدمها الشركة'],
  bSalary: ['Salary paid by the company', 'راتب تدفعه الشركة'],
  bFood: ['Free food', 'طعام مجاني'],
  bAccommodation: ['Free accommodation', 'سكن مجاني'],
  bTransport: ['Free transportation', 'مواصلات مجانية'],
  bVisa: ['Employment visa cost paid by the company', 'تتحمل الشركة تكلفة تأشيرة العمل'],
  bMinService: ['Completing the minimum service period is mandatory', 'إتمام الحد الأدنى لمدة الخدمة إلزامي'],
  bMedical: ['Medical insurance', 'تأمين صحي'],
  bOther: ['Other benefits', 'مزايا أخرى'],
  yes: ['Yes', 'نعم'],
  no: ['No', 'لا'],
  visaClause: ['4. Visa cost agreement', '٤. اتفاقية تكلفة التأشيرة'],
  general: ['5. General', '٥. أحكام عامة'],
  law: [
    'This contract is governed by Federal Decree-Law No. 33 of 2021 on the Regulation of Labour Relations and its Executive Regulations.',
    'يخضع هذا العقد لأحكام المرسوم بقانون اتحادي رقم ٣٣ لسنة ٢٠٢١ بشأن تنظيم علاقات العمل ولائحته التنفيذية.',
  ],
  ack: [
    'Both parties confirm that they have read and understood this contract and agree to its terms.',
    'يقر الطرفان بأنهما قرأا هذا العقد وفهماه ووافقا على ما ورد فيه.',
  ],
  prevails: [
    'This document summarises the agreed terms; the employment contract registered with the Ministry of Human Resources and Emiratisation prevails.',
    'هذا المستند ملخص للشروط المتفق عليها، ويُعتد بعقد العمل المسجل لدى وزارة الموارد البشرية والتوطين.',
  ],
  sigEmployee: ['Employee signature', 'توقيع الموظف'],
  sigManager: ['Manager signature', 'توقيع المدير'],
  date: ['Date', 'التاريخ'],
  printed: ['Printed', 'تاريخ الطباعة'],
} satisfies Record<string, Bi>

const TYPE_AR: Record<string, string> = {
  '2_year': 'عقد عمل لمدة سنتين',
  '1_year': 'عقد عمل لمدة سنة واحدة',
  '3_year': 'عقد عمل لمدة ثلاث سنوات',
  limited: 'عقد محدد المدة',
  unlimited: 'عقد غير محدد المدة',
  part_time: 'عقد عمل بدوام جزئي',
  probation: 'عقد فترة تجربة',
}
const STATUS_AR: Record<string, string> = { draft: 'مسودة', active: 'ساري', renewed: 'مجدد', expired: 'منتهي', terminated: 'منتهٍ بالإنهاء' }

const day = (v: string | null | undefined) => {
  const d = v ? parseISO(v) : null
  return d && isValid(d) ? format(d, 'dd/MM/yyyy') : '—'
}
const aed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const LanguageContext = createContext<ContractLanguage>('en')

/** A label in the chosen language(s). */
function Label({ text: [en, ar] }: { text: Bi }) {
  const language = useContext(LanguageContext)
  if (language === 'both')
    return (
      <>
        {en}
        <span dir="rtl" className="block text-[8pt] text-neutral-500">
          {ar}
        </span>
      </>
    )
  return <>{language === 'ar' ? ar : en}</>
}

function Row({ label, children }: { label: Bi; children: ReactNode }) {
  return (
    <tr className="break-inside-avoid">
      <th className="w-[42%] border border-neutral-300 bg-neutral-50 px-2 py-1 text-start align-top font-medium">
        <Label text={label} />
      </th>
      <td className="border border-neutral-300 px-2 py-1 align-top">{children}</td>
    </tr>
  )
}

function Heading({ text }: { text: Bi }) {
  return (
    <h2 className="mt-4 mb-1.5 border-b-2 border-neutral-800 pb-0.5 text-[11pt] font-bold">
      <Label text={text} />
    </h2>
  )
}

function Paragraph({ en, ar }: { en: string; ar: string }) {
  const language = useContext(LanguageContext)
  return (
    <div className="mb-1.5 text-[9pt] leading-relaxed">
      {language !== 'ar' && <p dir="ltr">{en}</p>}
      {language !== 'en' && (
        <p dir="rtl" className={language === 'both' ? 'mt-0.5 text-neutral-700' : undefined}>
          {ar}
        </p>
      )}
    </div>
  )
}

/**
 * Printable employment contract (A4) in English, Arabic or both. Hidden on
 * screen; rendered only while printing a contract (see EmployeeRecordPage).
 */
export function ContractPrintSheet({
  form,
  employerName,
  language,
  photoUrl,
  employeeSignatureUrl,
  managerSignatureUrl,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  employerName: string
  language: ContractLanguage
  photoUrl: string | null
  employeeSignatureUrl: string | null
  managerSignatureUrl: string | null
}) {
  const v = form.getValues()
  const showEn = language !== 'ar'
  const showAr = language !== 'en'
  const rtl = language === 'ar'
  const b = v.contract_benefits
  const progress = contractProgress(v.contract_start_date ?? '', v.contract_end_date ?? '', v.contract_min_service_months)
  const visaCost = Number(v.company_visa_cost) || 0
  const minMonths = Number(v.contract_min_service_months) || 0
  const typeEn = CONTRACT_TYPES.find((t) => t.value === v.contract_type)?.label ?? v.contract_type ?? '—'
  const statusEn = CONTRACT_STATUSES.find((s) => s.value === v.contract_status)?.label ?? '—'

  const L = (text: Bi) => <Label text={text} />
  /** A value that differs by language. */
  const V = (en: string, ar: string) =>
    language === 'both' ? (
      <>
        {en}
        {ar !== en && (
          <span dir="rtl" className="block text-[8.5pt] text-neutral-600">
            {ar}
          </span>
        )}
      </>
    ) : showAr ? (
      ar
    ) : (
      en
    )
  const months = (n: number) => V(`${n} months`, `${n} شهراً`)
  const yesNo = (on: boolean) => (on ? V(T.yes[0], T.yes[1]) : V(T.no[0], T.no[1]))

  const visaEn = `The company has paid AED ${aed(visaCost)} toward the employee's visa and employment-related costs.${
    minMonths ? ` The employee agrees to complete a minimum service period of ${minMonths} months from the contract start date.` : ''
  }`
  const visaAr = `دفعت الشركة مبلغ ${aed(visaCost)} درهم إماراتي لتغطية تكاليف التأشيرة والتكاليف المتعلقة بالتوظيف.${
    minMonths ? ` ويلتزم الموظف بإتمام مدة خدمة لا تقل عن ${minMonths} شهراً من تاريخ بداية العقد.` : ''
  }`

  return createPortal(
    <LanguageContext.Provider value={language}>
    <div className="print-sheet bg-white text-[9.5pt] text-neutral-900" dir={rtl ? 'rtl' : 'ltr'} lang={rtl ? 'ar' : 'en'}>
      <header className="mb-3 flex items-start justify-between gap-4 border-b-4 border-neutral-900 pb-3">
        <div>
          <p className="text-[8pt] tracking-widest text-neutral-500 uppercase">{employerName}</p>
          <h1 className="text-[18pt] leading-tight font-bold">{L(T.title)}</h1>
          <p className="text-[8.5pt] text-neutral-600">{L(T.subtitle)}</p>
          <p className="mt-1 text-[8pt] text-neutral-500">
            {showEn ? T.printed[0] : T.printed[1]}: {format(new Date(), 'dd/MM/yyyy')} · {v.employee_code || '—'}
          </p>
        </div>
        <div className="flex size-[30mm] shrink-0 items-center justify-center overflow-hidden border border-neutral-400 bg-neutral-50">
          {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : <span className="text-[7pt] text-neutral-400">Photo</span>}
        </div>
      </header>

      <Heading text={T.parties} />
      <table className="w-full border-collapse text-[9pt]">
        <tbody>
          <Row label={T.employer}>{employerName}</Row>
          <Row label={T.employee}>
            <b>{v.full_name || '—'}</b>
          </Row>
          <Row label={T.employeeId}>{v.employee_code || '—'}</Row>
          <Row label={T.nationality}>{v.nationality || '—'}</Row>
          <Row label={T.passport}>{v.passport_number || '—'}</Row>
          <Row label={T.emiratesId}>{v.emirates_id || '—'}</Row>
          {v.unified_number && <Row label={T.uid}>{v.unified_number}</Row>}
          {v.date_of_birth && <Row label={T.dob}>{day(v.date_of_birth)}</Row>}
          <Row label={T.jobTitle}>{v.job_title || '—'}</Row>
          {v.phone && <Row label={T.mobile}>{v.phone}</Row>}
        </tbody>
      </table>

      <Heading text={T.terms} />
      <table className="w-full border-collapse text-[9pt]">
        <tbody>
          <Row label={T.type}>{V(typeEn, TYPE_AR[v.contract_type ?? ''] ?? typeEn)}</Row>
          <Row label={T.start}>{day(v.contract_start_date)}</Row>
          <Row label={T.end}>{day(v.contract_end_date)}</Row>
          <Row label={T.duration}>{progress?.durationMonths != null ? months(progress.durationMonths) : '—'}</Row>
          <Row label={T.minService}>{minMonths ? months(minMonths) : V('Not required', 'غير مطلوب')}</Row>
          <Row label={T.salary}>{v.base_salary !== '' && v.base_salary != null ? V(`AED ${aed(Number(v.base_salary))}`, `${aed(Number(v.base_salary))} درهم إماراتي`) : '—'}</Row>
          <Row label={T.status}>{V(statusEn, STATUS_AR[v.contract_status ?? ''] ?? statusEn)}</Row>
        </tbody>
      </table>

      <Heading text={T.benefits} />
      <table className="w-full border-collapse text-[9pt]">
        <tbody>
          <Row label={T.bSalary}>{yesNo(!!b?.salary)}</Row>
          <Row label={T.bFood}>{yesNo(!!b?.food)}</Row>
          <Row label={T.bAccommodation}>{yesNo(!!b?.accommodation)}</Row>
          <Row label={T.bTransport}>{yesNo(!!b?.transport)}</Row>
          <Row label={T.bVisa}>{b?.visa_cost ? V(`Yes — AED ${aed(visaCost)}`, `نعم — ${aed(visaCost)} درهم إماراتي`) : yesNo(false)}</Row>
          <Row label={T.bMinService}>{yesNo(!!b?.min_service_mandatory)}</Row>
          <Row label={T.bMedical}>{b?.medical_insurance ? (b.medical_insurance_term ? V(`Yes — ${b.medical_insurance_term}`, `نعم — ${b.medical_insurance_term}`) : yesNo(true)) : yesNo(false)}</Row>
          {b?.other && <Row label={T.bOther}>{b.other}</Row>}
        </tbody>
      </table>

      {visaCost > 0 && (
        <>
          <Heading text={T.visaClause} />
          <Paragraph en={visaEn} ar={visaAr} />
        </>
      )}

      <Heading text={T.general} />
      <Paragraph en={T.law[0]} ar={T.law[1]} />
      <Paragraph en={T.ack[0]} ar={T.ack[1]} />
      <Paragraph en={T.prevails[0]} ar={T.prevails[1]} />

      <section className="mt-6 grid grid-cols-2 gap-8 break-inside-avoid">
        {[
          { label: T.sigEmployee, url: employeeSignatureUrl, who: v.full_name, date: v.employee_signed_at },
          { label: T.sigManager, url: managerSignatureUrl, who: v.manager_signed_by, date: v.manager_signed_at },
        ].map((s) => (
          <div key={s.label[0]} className="text-[9pt]">
            <p className="font-semibold">{L(s.label)}</p>
            <div className="flex h-20 items-end border-b border-neutral-700 pb-1">
              {s.url && <img src={s.url} alt="" className="max-h-[18mm] max-w-full object-contain" />}
            </div>
            <p className="mt-1">{s.who || ' '}</p>
            <p className="text-neutral-600">
              {showEn ? T.date[0] : T.date[1]}: {day(s.date)}
            </p>
          </div>
        ))}
      </section>
    </div>
    </LanguageContext.Provider>,
    document.body,
  )
}
