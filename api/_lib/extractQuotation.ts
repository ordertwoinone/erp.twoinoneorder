const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-4o'

export interface ExtractedQuotationItem {
  description: string
  uom: string | null
  quantity: number
  unit_price: number
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedQuotation {
  supplier_name: string | null
  quotation_number: string | null
  quotation_date: string | null
  items: ExtractedQuotationItem[]
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: ['string', 'null'] },
    quotation_number: { type: ['string', 'null'] },
    quotation_date: { type: ['string', 'null'], description: 'ISO 8601 date (YYYY-MM-DD) if determinable, else null' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          uom: { type: ['string', 'null'], description: 'Unit of measure / packing, e.g. CAR, BAG, EA, BDL' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
          confidence: { type: 'number', description: '0-100 confidence this line was read correctly' },
          is_uncertain: { type: 'boolean' },
        },
        required: ['description', 'uom', 'quantity', 'unit_price', 'confidence', 'is_uncertain'],
        additionalProperties: false,
      },
    },
  },
  required: ['supplier_name', 'quotation_number', 'quotation_date', 'items'],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You extract structured line-item data from restaurant supplier quotations, price lists, and order slips. These documents vary widely in layout (formal quotation PDFs, plain price lists, POS-style order slips) and may be a photo, a scanned PDF, or a spreadsheet export.

For each distinct product/line item, extract: description (verbatim item name/spec as printed), uom (the unit of measure or packing, e.g. CAR/CTN/BAG/EA/BDL — null if absent), quantity (numeric; if absent for a price-list-only document, use 1), unit_price (the per-unit price, not a line total — if only a total is given for qty 1, that total is unit_price).

Set confidence 0-100 for how sure you are the line was read correctly, and is_uncertain=true when confidence is below 70 (blurry text, ambiguous numbers, merged columns, etc). Never invent a price or quantity you cannot actually read — mark it uncertain instead of guessing.

Also extract supplier_name, quotation_number and quotation_date from the document header if present, else null.`

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

async function callOpenAi(content: Record<string, unknown>[]): Promise<{ raw: unknown; parsed: ExtractedQuotation }> {
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
          name: 'quotation_extraction',
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
  let parsed: ExtractedQuotation
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

export async function extractFromText(text: string) {
  return callOpenAi([{ type: 'input_text', text: `Document content (converted from spreadsheet):\n\n${text}` }])
}
