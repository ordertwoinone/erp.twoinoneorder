import { callGemini, fileParts } from './gemini.js'

export interface ExtractedEmployeeDocument {
  document_type: 'passport' | 'emirates_id' | 'labour_permit' | 'medical' | 'visa' | 'other'
  full_name: string | null
  nationality: string | null
  passport_number: string | null
  passport_issue_date: string | null
  passport_expiry_date: string | null
  emirates_id_number: string | null
  emirates_id_expiry: string | null
  work_permit_number: string | null
  labour_person_number: string | null
  permit_issue_date: string | null
  labour_permit_expiry: string | null
  medical_expiry_date: string | null
  sponsor_name: string | null
  job_title: string | null
  work_permit_salary: number | null
  confidence: number
}

const nullableString = (description?: string) => ({ type: ['string', 'null'], ...(description ? { description } : {}) })
const date = (description: string) => nullableString(`${description}. ISO 8601 (YYYY-MM-DD), else null`)

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    document_type: {
      type: 'string',
      enum: ['passport', 'emirates_id', 'labour_permit', 'medical', 'visa', 'other'],
      description: 'labour_permit covers MOHRE work permits / labour cards',
    },
    full_name: nullableString('Holder name in Latin script'),
    nationality: nullableString('Nationality in English, e.g. "Egyptian", "Indian"'),
    passport_number: nullableString(),
    passport_issue_date: date('Passport date of issue'),
    passport_expiry_date: date('Passport date of expiry'),
    emirates_id_number: nullableString('Emirates ID number as printed, e.g. 784-1990-1234567-1'),
    emirates_id_expiry: date('Emirates ID expiry'),
    work_permit_number: nullableString('Work permit / labour card number'),
    labour_person_number: nullableString('MOHRE person code / person number'),
    permit_issue_date: date('Work permit issue date'),
    labour_permit_expiry: date('Work permit / labour card expiry'),
    medical_expiry_date: date('Medical fitness certificate / health card expiry'),
    sponsor_name: nullableString('Employer / sponsor / establishment name'),
    job_title: nullableString('Occupation / profession as printed'),
    work_permit_salary: { type: ['number', 'null'], description: 'Monthly salary in AED printed on the permit, else null' },
    confidence: { type: 'number', description: '0-100 confidence the fields were read correctly' },
  },
  required: [
    'document_type', 'full_name', 'nationality', 'passport_number', 'passport_issue_date', 'passport_expiry_date',
    'emirates_id_number', 'emirates_id_expiry', 'work_permit_number', 'labour_person_number', 'permit_issue_date',
    'labour_permit_expiry', 'medical_expiry_date', 'sponsor_name', 'job_title', 'work_permit_salary', 'confidence',
  ],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You read a single UAE employee identity or employment document — a passport, Emirates ID card, MOHRE work permit / labour card, medical fitness certificate or residence visa — from a photo or scan. Documents are often bilingual Arabic/English; always return values in English/Latin script.

Identify document_type, then fill only the fields actually printed on this document. Every field that isn't on this document, or that you can't read with confidence, must be null — never guess, and never copy a value from one field into another (e.g. don't put a passport number into emirates_id_number).

Dates must be ISO 8601 (YYYY-MM-DD). UAE documents often print dates as DD/MM/YYYY — convert carefully. Set confidence 0-100 for the overall read.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string) {
  return callGemini<ExtractedEmployeeDocument>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
