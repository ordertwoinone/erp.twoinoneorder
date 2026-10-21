import { callGemini, fileParts } from './gemini.js'

/**
 * One person on a MOHRE "List of Employees". Current lists print: Passport
 * Number | Person Name (with the 14-digit MOHRE person code under it) | Card
 * Type | Job Name | Nationality | Card Number (with the card expiry under it)
 * | Contract Type. Older lists had Person Number / Job Type / Civil ID columns
 * instead — those map onto person_code / card_type / civil_id_number.
 */
export interface ExtractedLabourListItem {
  passport_number: string | null
  person_name: string
  person_code: string | null
  card_type: string | null
  job_name: string | null
  nationality: string | null
  card_number: string | null
  card_expiry: string | null
  card_status: string | null
  contract_type: string | null
  civil_id_number: string | null
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedLabourList {
  establishment_name: string | null
  establishment_number: string | null
  category: string | null
  total_employees: number | null
  items: ExtractedLabourListItem[]
}

const nullableString = (description: string) => ({ type: ['string', 'null'], description })

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    establishment_name: nullableString('Establishment name in English, from the header'),
    establishment_number: nullableString('Establishment Number from the header'),
    category: nullableString('Establishment Category from the header, e.g. "1"'),
    total_employees: { type: ['number', 'null'], description: '"Total Number of Employees" printed at the end, else null' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passport_number: nullableString('Passport Number column, exactly as printed'),
          person_name: { type: 'string', description: 'Person name in English / Latin script (ignore the Arabic line)' },
          person_code: nullableString(
            'MOHRE person code: the long number (usually 14 digits) printed under the name. On older lists, the Person Number column',
          ),
          card_type: nullableString('Card Type in English, e.g. "NEW ELECTRONIC WORK PERMIT" (older lists: Job Type)'),
          job_name: nullableString('Job Name in English, e.g. "Waiter"'),
          nationality: nullableString('Nationality / country in English exactly as printed, e.g. "INDIA", "NIPAL", "EGYPT"'),
          card_number: nullableString('Card Number: the work permit / labour card number (first line of the Card Number column)'),
          card_expiry: nullableString('The date printed under the card number (card expiry), ISO 8601 YYYY-MM-DD. Dates are printed DD/MM/YYYY'),
          card_status: nullableString('Any extra note under the card number, e.g. "Temporary work permits received", else null'),
          contract_type: nullableString('Contract Type in English, e.g. "Limited"'),
          civil_id_number: nullableString('Emirates ID / Civil ID number only if a column for it is printed (older lists), else null'),
          confidence: { type: 'number', description: '0-100 confidence this row was read correctly' },
          is_uncertain: { type: 'boolean' },
        },
        required: [
          'passport_number', 'person_name', 'person_code', 'card_type', 'job_name', 'nationality', 'card_number',
          'card_expiry', 'card_status', 'contract_type', 'civil_id_number', 'confidence', 'is_uncertain',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['establishment_name', 'establishment_number', 'category', 'total_employees', 'items'],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You extract every employee row from a UAE Ministry of Human Resources & Emiratisation (MOHRE) "The List Of Employees / كشف العاملين بالمنشأة" document. It is bilingual Arabic/English and usually spans several pages; each page repeats the header and the column titles.

Current layout columns (left to right): Passport Number | Person Name | Card Type | Job Name | Nationality | Card Number | Contract Type.
- The Person Name cell has three lines: the English name, the Arabic name, then a long number (usually 14 digits) — that number is the MOHRE person code (person_code).
- The Card Number cell has the card / work permit number, then a date (DD/MM/YYYY, the card expiry), and sometimes a status note such as "Temporary work permits received".
Older lists may instead have: Person Number | Person Name | Job Type | Job Name | Nationality | Civil ID Number | Contract Type — put Person Number in person_code, Job Type in card_type and Civil ID Number in civil_id_number.

Rules:
- Return one item per person, from ALL pages, in the order printed. Do not repeat header rows or the footer.
- Always use the English/Latin text, never the Arabic line.
- Copy numbers exactly as printed (passport numbers keep their letters and leading zeros).
- Convert dates to YYYY-MM-DD.
- Set confidence 0-100 per row and is_uncertain=true when below 70. Never invent a value you cannot read — use null and lower the confidence.
- Also read the header (establishment name, establishment number, category) and the "Total Number of Employees" from the last page.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string, _fileName: string) {
  return callGemini<ExtractedLabourList>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
