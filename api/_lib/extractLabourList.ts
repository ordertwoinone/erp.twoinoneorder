import { callGemini, fileParts } from './gemini.js'

export interface ExtractedLabourListItem {
  person_number: string | null
  person_name: string
  job_type: string | null
  job_name: string | null
  nationality: string | null
  civil_id_number: string | null
  contract_type: string | null
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedLabourList {
  establishment_name: string | null
  file_number: string | null
  items: ExtractedLabourListItem[]
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    establishment_name: { type: ['string', 'null'] },
    file_number: { type: ['string', 'null'], description: 'Establishment / labour file number printed in the header, if any' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          person_number: { type: ['string', 'null'] },
          person_name: { type: 'string' },
          job_type: { type: ['string', 'null'] },
          job_name: { type: ['string', 'null'] },
          nationality: { type: ['string', 'null'] },
          civil_id_number: { type: ['string', 'null'], description: 'Emirates ID / civil ID number' },
          contract_type: { type: ['string', 'null'] },
          confidence: { type: 'number', description: '0-100 confidence this row was read correctly' },
          is_uncertain: { type: 'boolean' },
        },
        required: [
          'person_number', 'person_name', 'job_type', 'job_name', 'nationality',
          'civil_id_number', 'contract_type', 'confidence', 'is_uncertain',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['establishment_name', 'file_number', 'items'],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You extract structured rows from a UAE MOHRE-style "List of Employees" (labour list) document. It's usually a table with Arabic/English bilingual headers: Person Number, Person Name, Job Type, Job Name, Nationality, Civil ID Number (Emirates ID number), Contract Type.

For each distinct row (each person), extract: person_number (the row/reference number, verbatim), person_name (the person's full name, prefer the English/Latin transliteration if both scripts are printed), job_type, job_name, nationality, civil_id_number (the Emirates ID / civil ID number, digits and any dashes as printed), contract_type.

Set confidence 0-100 for how sure you are the row was read correctly, and is_uncertain=true when confidence is below 70. Never invent a number or name you cannot actually read — mark it uncertain instead of guessing.

Also extract establishment_name and file_number from the document header if present, else null.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string, _fileName: string) {
  return callGemini<ExtractedLabourList>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
