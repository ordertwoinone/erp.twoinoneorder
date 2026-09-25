const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-4o'

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

function extractOutputText(payload: any): string {
  if (typeof payload.output_text === 'string') return payload.output_text
  const messages = Array.isArray(payload.output) ? payload.output : []
  for (const message of messages) {
    if (message.type !== 'message' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text
    }
  }
  throw new Error('OpenAI response did not contain output text')
}

async function callOpenAi(content: Record<string, unknown>[]): Promise<{ raw: unknown; parsed: ExtractedLabourList }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.')
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: INSTRUCTIONS }, ...content],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'labour_list_extraction',
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  })

  const raw = await response.json()
  if (!response.ok) {
    const message = (raw as any)?.error?.message || `OpenAI request failed with status ${response.status}`
    throw new Error(message)
  }

  const text = extractOutputText(raw)
  let parsed: ExtractedLabourList
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('OpenAI returned output that was not valid JSON.')
  }

  return { raw, parsed }
}

export async function extractFromImageOrPdf(base64Data: string, mimeType: string, fileName: string) {
  const isPdf = mimeType === 'application/pdf'
  const content = isPdf
    ? [{ type: 'input_file', filename: fileName, file_data: `data:${mimeType};base64,${base64Data}` }]
    : [{ type: 'input_image', image_url: `data:${mimeType};base64,${base64Data}` }]
  return callOpenAi(content)
}
