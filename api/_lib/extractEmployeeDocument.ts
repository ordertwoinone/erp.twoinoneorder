import { callGemini, fileParts } from './gemini.js'

export interface ExtractedEmployeeDocument {
  document_type: 'passport' | 'emirates_id' | 'labour_permit' | 'medical' | 'visa' | 'residency' | 'other'
  full_name: string | null
  nationality: string | null
  passport_number: string | null
  passport_issue_date: string | null
  passport_expiry_date: string | null
  passport_type: string | null
  passport_issue_place: string | null
  emirates_id_number: string | null
  emirates_id_expiry: string | null
  unified_number: string | null
  residency_type: string | null
  residency_file_number: string | null
  residency_issue_date: string | null
  residency_expiry_date: string | null
  residency_status: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  place_of_birth: string | null
  birth_country: string | null
  religion: string | null
  mother_name: string | null
  work_permit_number: string | null
  labour_person_number: string | null
  permit_issue_date: string | null
  labour_permit_expiry: string | null
  medical_expiry_date: string | null
  sponsor_name: string | null
  job_title: string | null
  work_permit_salary: number | null
  uae_address: string | null
  uae_mobile: string | null
  uae_phone: string | null
  home_country_address: string | null
  home_country_mobile: string | null
  email: string | null
  confidence: number
}

const nullableString = (description?: string) => ({ type: ['string', 'null'], ...(description ? { description } : {}) })
const date = (description: string) => nullableString(`${description}. ISO 8601 (YYYY-MM-DD), else null`)

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    document_type: {
      type: 'string',
      enum: ['passport', 'emirates_id', 'labour_permit', 'medical', 'visa', 'residency', 'other'],
      description:
        'labour_permit covers MOHRE work permits / labour cards; residency covers ICP / GDRFA residency records and "View residency" screens',
    },
    full_name: nullableString('Holder name in Latin script'),
    nationality: nullableString('Current nationality in English, e.g. "Egyptian", "Indian", "NEPAL"'),
    passport_number: nullableString(),
    passport_issue_date: date('Passport date of issue'),
    passport_expiry_date: date('Passport date of expiry'),
    passport_type: nullableString('Passport type, e.g. "Ordinary passport"'),
    passport_issue_place: nullableString('Passport issue place / issuing country in English'),
    emirates_id_number: nullableString('Emirates ID number as printed, e.g. 784-1990-1234567-1 or 784199012345671'),
    emirates_id_expiry: date('Emirates ID expiry'),
    unified_number: nullableString('UID / "Emirate Unified Number" / unified number'),
    residency_type: nullableString('Residency type, e.g. "Residency - Work - Private Sector"'),
    residency_file_number: nullableString('Residency file number as printed, e.g. "301/2024/2/184836"'),
    residency_issue_date: date('Residency issue date'),
    residency_expiry_date: date('Residency / residence visa expiry date'),
    residency_status: nullableString('Residency status, e.g. "Active"'),
    date_of_birth: date('Date of birth'),
    gender: nullableString('"male" or "female"'),
    marital_status: nullableString('e.g. "Single", "Married"'),
    place_of_birth: nullableString('Place of birth in English'),
    birth_country: nullableString('Birth country in English'),
    religion: nullableString('Religion, if printed'),
    mother_name: nullableString("Mother's name in English, if printed"),
    work_permit_number: nullableString('Work permit / labour card number'),
    labour_person_number: nullableString('MOHRE person code / person number'),
    permit_issue_date: date('Work permit issue date'),
    labour_permit_expiry: date('Work permit / labour card expiry'),
    medical_expiry_date: date('Medical fitness certificate / health card expiry'),
    sponsor_name: nullableString('Employer / sponsor / establishment name'),
    job_title: nullableString('Occupation / profession as printed'),
    work_permit_salary: { type: ['number', 'null'], description: 'Monthly salary in AED printed on the permit, else null' },
    uae_address: nullableString('Address / location inside the UAE'),
    uae_mobile: nullableString('UAE mobile number as printed'),
    uae_phone: nullableString('UAE phone (landline) number as printed'),
    home_country_address: nullableString('Address / location outside the UAE (home country)'),
    home_country_mobile: nullableString('Permanent / home-country mobile number as printed'),
    email: nullableString('Email address'),
    confidence: { type: 'number', description: '0-100 confidence the fields were read correctly' },
  },
  required: [
    'document_type', 'full_name', 'nationality', 'passport_number', 'passport_issue_date', 'passport_expiry_date',
    'passport_type', 'passport_issue_place', 'emirates_id_number', 'emirates_id_expiry', 'unified_number', 'residency_type',
    'residency_file_number', 'residency_issue_date', 'residency_expiry_date', 'residency_status', 'date_of_birth', 'gender',
    'marital_status', 'place_of_birth', 'birth_country', 'religion', 'mother_name', 'work_permit_number',
    'labour_person_number', 'permit_issue_date', 'labour_permit_expiry', 'medical_expiry_date', 'sponsor_name', 'job_title',
    'work_permit_salary', 'uae_address', 'uae_mobile', 'uae_phone', 'home_country_address', 'home_country_mobile', 'email',
    'confidence',
  ],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You read a single UAE employee identity or employment document — a passport, Emirates ID card, MOHRE work permit / labour card, medical fitness certificate, residence visa, or an ICP / GDRFA residency record (for example a "View residency" screen with Residency Information, Personal Information, Passport Information and Addresses Info blocks) — from a photo, screenshot or scan. Documents are often bilingual Arabic/English; always return values in English/Latin script.

Identify document_type, then fill only the fields actually printed on this document. Every field that isn't on this document, or that you can't read with confidence, must be null — never guess, and never copy a value from one field into another (e.g. don't put a passport number into emirates_id_number, or the residency file number into unified_number).

On a residency record: "Residency Expire Date" is residency_expiry_date, "Emirate Unified Number" is unified_number, "Profession" is job_title, "Applicant location inside UAE" is uae_address, "UAE Mobile Number" is uae_mobile, "UAE Phone Number" is uae_phone, "Applicant location outside UAE" is home_country_address and "Permanent Mobile Number" is home_country_mobile.

Dates must be ISO 8601 (YYYY-MM-DD). UAE documents often print dates as DD/MM/YYYY — convert carefully. Copy numbers exactly as printed. Set confidence 0-100 for the overall read.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string) {
  return callGemini<ExtractedEmployeeDocument>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
