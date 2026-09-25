import { callGemini, fileParts } from './gemini.js'

export interface ExtractedInvoiceItem {
  description: string
  sku: string | null
  uom: string | null
  pack_size: number | null
  quantity: number
  unit_price: number
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedInvoice {
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  items: ExtractedInvoiceItem[]
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: ['string', 'null'] },
    invoice_number: { type: ['string', 'null'] },
    invoice_date: { type: ['string', 'null'], description: 'ISO 8601 date (YYYY-MM-DD) if determinable, else null' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          sku: { type: ['string', 'null'], description: 'Supplier item code / SKU if printed, else null' },
          uom: { type: ['string', 'null'], description: 'Unit of measure / packing, e.g. CAR, BAG, EA, BDL' },
          pack_size: { type: ['number', 'null'], description: 'Pack size in base units if printed (e.g. 2 for a 2kg pack), else null' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
          confidence: { type: 'number', description: '0-100 confidence this line was read correctly' },
          is_uncertain: { type: 'boolean' },
        },
        required: ['description', 'sku', 'uom', 'pack_size', 'quantity', 'unit_price', 'confidence', 'is_uncertain'],
        additionalProperties: false,
      },
    },
  },
  required: ['supplier_name', 'invoice_number', 'invoice_date', 'items'],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You extract structured line-item data from restaurant supplier invoices/bills. These are a photo or scanned PDF of a printed or handwritten supplier invoice.

For each distinct product/line item, extract: description (verbatim item name/spec as printed), sku (the supplier's item code if printed, else null), uom (the unit of measure or packing, e.g. CAR/CTN/BAG/EA/BDL — null if absent), pack_size (numeric pack size if printed, e.g. 2 for "2kg" — null if absent), quantity (numeric), unit_price (the per-unit price, not the line total — if only a line total is given, divide by quantity to get unit_price).

Set confidence 0-100 for how sure you are the line was read correctly, and is_uncertain=true when confidence is below 70 (blurry text, ambiguous numbers, merged columns, etc). Never invent a price or quantity you cannot actually read — mark it uncertain instead of guessing.

Also extract supplier_name, invoice_number and invoice_date from the document header if present, else null.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string, _fileName: string) {
  return callGemini<ExtractedInvoice>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
